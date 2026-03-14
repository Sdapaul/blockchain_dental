// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DentalInsurance
 * @dev 덴탈보험 스마트 컨트랙트 - 보험료 납입 및 보험금 지급 처리
 *      스테이블코인(USDC)으로 모든 거래 처리
 */
contract DentalInsurance is Ownable, ReentrancyGuard {

    IERC20 public immutable stablecoin;

    // ─────────────────────────────────────────
    //  Data Structures
    // ─────────────────────────────────────────

    struct Policy {
        uint256 id;
        address patient;
        string  patientName;
        uint256 monthlyPremium;   // USDC (6 decimals)
        uint256 coverageLimit;    // USDC (6 decimals)
        uint256 totalPaid;        // 누적 납입 보험료
        uint256 lastPaymentTime;  // 마지막 납입 시각
        uint256 nextDueTime;      // 다음 납입 기한
        bool    active;
        uint256 createdAt;
        uint256 maturityDate;     // 만기일 (timestamp)
        uint256 maturityRefundRate; // 만기환급율 (0~100, totalPaid 대비 %)
        bool    maturityPaid;     // 만기환급 지급 완료 여부
    }

    struct Claim {
        uint256 id;
        uint256 policyId;
        address patient;
        uint256 amount;           // 청구 금액 USDC
        string  treatmentCode;    // 치료 코드 (예: D0120, D2140)
        string  description;      // 치료 설명
        ClaimStatus status;
        uint256 submittedAt;
        uint256 processedAt;
        string  rejectReason;
    }

    enum ClaimStatus { Pending, Approved, Rejected, Paid }

    // ─────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────

    uint256 public nextPolicyId = 1;
    uint256 public nextClaimId  = 1;

    mapping(uint256 => Policy) public policies;
    mapping(uint256 => Claim)  public claims;
    mapping(address => uint256[]) private _patientPolicies;
    mapping(address => uint256[]) private _patientClaims;

    uint256[] private _allPolicyIds;
    uint256[] private _allClaimIds;

    uint256 public totalPremiumsCollected;
    uint256 public totalClaimsPaid;
    uint256 public totalPoliciesCreated;
    uint256 public totalClaimsSubmitted;

    // ─────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────

    event PolicyCreated(
        uint256 indexed policyId,
        address indexed patient,
        string  patientName,
        uint256 monthlyPremium,
        uint256 coverageLimit,
        uint256 timestamp
    );
    event PremiumPaid(
        uint256 indexed policyId,
        address indexed patient,
        uint256 amount,
        uint256 totalPaid,
        uint256 timestamp
    );
    event ClaimSubmitted(
        uint256 indexed claimId,
        uint256 indexed policyId,
        address indexed patient,
        uint256 amount,
        string  treatmentCode,
        uint256 timestamp
    );
    event ClaimApproved(
        uint256 indexed claimId,
        uint256 indexed policyId,
        uint256 amount,
        uint256 timestamp
    );
    event ClaimRejected(
        uint256 indexed claimId,
        uint256 indexed policyId,
        string  reason,
        uint256 timestamp
    );
    event ClaimPaid(
        uint256 indexed claimId,
        uint256 indexed policyId,
        address indexed patient,
        uint256 amount,
        uint256 timestamp
    );
    event PolicyDeactivated(uint256 indexed policyId, uint256 timestamp);
    event FundsDeposited(address indexed depositor, uint256 amount, uint256 timestamp);
    event MaturityRefundPaid(
        uint256 indexed policyId,
        address indexed patient,
        uint256 refundAmount,
        uint256 timestamp
    );

    // ─────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────

    constructor(address _stablecoin) Ownable(msg.sender) {
        require(_stablecoin != address(0), "Invalid stablecoin address");
        stablecoin = IERC20(_stablecoin);
    }

    // ─────────────────────────────────────────
    //  Admin: Policy Management
    // ─────────────────────────────────────────

    /**
     * @dev 보험증권 생성 (관리자 전용)
     * @param patient 피보험자 지갑 주소
     * @param patientName 피보험자 이름
     * @param monthlyPremium 월 보험료 (USDC, 6 decimals)
     * @param coverageLimit 최대 보장 한도 (USDC, 6 decimals)
     */
    function createPolicy(
        address patient,
        string  calldata patientName,
        uint256 monthlyPremium,
        uint256 coverageLimit,
        uint256 maturityDate,
        uint256 maturityRefundRate
    ) external onlyOwner returns (uint256) {
        require(patient != address(0), "Invalid patient address");
        require(bytes(patientName).length > 0, "Patient name required");
        require(monthlyPremium > 0, "Premium must be > 0");
        require(coverageLimit > 0, "Coverage limit must be > 0");
        require(maturityDate > block.timestamp, "Maturity date must be in the future");
        require(maturityRefundRate <= 100, "Refund rate must be <= 100");

        uint256 policyId = nextPolicyId++;

        policies[policyId] = Policy({
            id:                policyId,
            patient:           patient,
            patientName:       patientName,
            monthlyPremium:    monthlyPremium,
            coverageLimit:     coverageLimit,
            totalPaid:         0,
            lastPaymentTime:   0,
            nextDueTime:       block.timestamp + 30 days,
            active:            true,
            createdAt:         block.timestamp,
            maturityDate:      maturityDate,
            maturityRefundRate: maturityRefundRate,
            maturityPaid:      false
        });

        _patientPolicies[patient].push(policyId);
        _allPolicyIds.push(policyId);
        totalPoliciesCreated++;

        emit PolicyCreated(policyId, patient, patientName, monthlyPremium, coverageLimit, block.timestamp);
        return policyId;
    }

    /**
     * @dev 보험증권 비활성화 (관리자 전용)
     */
    function deactivatePolicy(uint256 policyId) external onlyOwner {
        require(policies[policyId].id != 0, "Policy not found");
        policies[policyId].active = false;
        emit PolicyDeactivated(policyId, block.timestamp);
    }

    /**
     * @dev 컨트랙트에 준비금 입금 (관리자 전용)
     */
    function depositFunds(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be > 0");
        require(stablecoin.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit FundsDeposited(msg.sender, amount, block.timestamp);
    }

    // ─────────────────────────────────────────
    //  Patient: Premium Payment
    // ─────────────────────────────────────────

    /**
     * @dev 보험료 납입 (피보험자)
     *      사전에 USDC approve 필요
     */
    function payPremium(uint256 policyId) external nonReentrant {
        Policy storage policy = policies[policyId];
        require(policy.id != 0,              "Policy not found");
        require(policy.active,               "Policy not active");
        require(policy.patient == msg.sender, "Not the policy holder");

        uint256 amount = policy.monthlyPremium;
        require(
            stablecoin.transferFrom(msg.sender, address(this), amount),
            "USDC transfer failed - check allowance"
        );

        policy.totalPaid       += amount;
        policy.lastPaymentTime  = block.timestamp;
        policy.nextDueTime      = block.timestamp + 30 days;
        totalPremiumsCollected += amount;

        emit PremiumPaid(policyId, msg.sender, amount, policy.totalPaid, block.timestamp);
    }

    // ─────────────────────────────────────────
    //  Patient: Claim Submission
    // ─────────────────────────────────────────

    /**
     * @dev 보험금 청구 제출 (피보험자)
     * @param policyId 보험증권 ID
     * @param amount 청구 금액 (USDC, 6 decimals)
     * @param treatmentCode 치료 코드 (예: D0120=정기검진, D2140=아말감충전)
     * @param description 치료 상세 설명
     */
    function submitClaim(
        uint256 policyId,
        uint256 amount,
        string  calldata treatmentCode,
        string  calldata description
    ) external returns (uint256) {
        Policy storage policy = policies[policyId];
        require(policy.id != 0,               "Policy not found");
        require(policy.active,                "Policy not active");
        require(policy.patient == msg.sender,  "Not the policy holder");
        require(policy.totalPaid > 0,          "No premiums paid yet");
        require(amount > 0,                   "Claim amount must be > 0");
        require(amount <= policy.coverageLimit, "Exceeds coverage limit");
        require(bytes(treatmentCode).length > 0, "Treatment code required");

        uint256 claimId = nextClaimId++;

        claims[claimId] = Claim({
            id:            claimId,
            policyId:      policyId,
            patient:       msg.sender,
            amount:        amount,
            treatmentCode: treatmentCode,
            description:   description,
            status:        ClaimStatus.Pending,
            submittedAt:   block.timestamp,
            processedAt:   0,
            rejectReason:  ""
        });

        _patientClaims[msg.sender].push(claimId);
        _allClaimIds.push(claimId);
        totalClaimsSubmitted++;

        emit ClaimSubmitted(claimId, policyId, msg.sender, amount, treatmentCode, block.timestamp);
        return claimId;
    }

    // ─────────────────────────────────────────
    //  Admin: Claim Processing
    // ─────────────────────────────────────────

    /**
     * @dev 보험금 청구 승인 (관리자 전용)
     */
    function approveClaim(uint256 claimId) external onlyOwner {
        Claim storage claim = claims[claimId];
        require(claim.id != 0,                        "Claim not found");
        require(claim.status == ClaimStatus.Pending,  "Claim not in pending status");

        claim.status      = ClaimStatus.Approved;
        claim.processedAt = block.timestamp;

        emit ClaimApproved(claimId, claim.policyId, claim.amount, block.timestamp);
    }

    /**
     * @dev 보험금 청구 거절 (관리자 전용)
     */
    function rejectClaim(uint256 claimId, string calldata reason) external onlyOwner {
        Claim storage claim = claims[claimId];
        require(claim.id != 0,                        "Claim not found");
        require(claim.status == ClaimStatus.Pending,  "Claim not in pending status");

        claim.status       = ClaimStatus.Rejected;
        claim.processedAt  = block.timestamp;
        claim.rejectReason = reason;

        emit ClaimRejected(claimId, claim.policyId, reason, block.timestamp);
    }

    /**
     * @dev 보험금 지급 실행 (관리자 전용)
     *      승인된 청구건에 대해 USDC 지급
     */
    function payClaim(uint256 claimId) external onlyOwner nonReentrant {
        Claim storage claim = claims[claimId];
        require(claim.id != 0,                         "Claim not found");
        require(claim.status == ClaimStatus.Approved,  "Claim not approved");
        require(
            stablecoin.balanceOf(address(this)) >= claim.amount,
            "Insufficient contract balance"
        );

        claim.status = ClaimStatus.Paid;
        totalClaimsPaid += claim.amount;

        require(
            stablecoin.transfer(claim.patient, claim.amount),
            "USDC transfer failed"
        );

        emit ClaimPaid(claimId, claim.policyId, claim.patient, claim.amount, block.timestamp);
    }

    // ─────────────────────────────────────────
    //  Maturity Refund
    // ─────────────────────────────────────────

    /**
     * @dev 만기환급금 지급 (관리자 전용)
     *      만기일 도달 + 미지급 상태인 증권에 대해 환급금 자동 지급
     */
    function processMaturityRefund(uint256 policyId) external onlyOwner nonReentrant {
        Policy storage policy = policies[policyId];
        require(policy.id != 0,               "Policy not found");
        require(policy.active,                "Policy not active");
        require(!policy.maturityPaid,         "Maturity refund already paid");
        require(block.timestamp >= policy.maturityDate, "Policy not yet matured");
        require(policy.totalPaid > 0,         "No premiums paid");

        uint256 refundAmount = (policy.totalPaid * policy.maturityRefundRate) / 100;
        require(refundAmount > 0,             "Refund amount is 0");
        require(
            stablecoin.balanceOf(address(this)) >= refundAmount,
            "Insufficient contract balance"
        );

        policy.maturityPaid = true;
        policy.active       = false;

        require(stablecoin.transfer(policy.patient, refundAmount), "Transfer failed");

        emit MaturityRefundPaid(policyId, policy.patient, refundAmount, block.timestamp);
        emit PolicyDeactivated(policyId, block.timestamp);
    }

    /**
     * @dev 만기 도달 여부 조회
     */
    function isMatured(uint256 policyId) external view returns (bool) {
        Policy storage policy = policies[policyId];
        return (
            policy.id != 0 &&
            policy.active &&
            !policy.maturityPaid &&
            block.timestamp >= policy.maturityDate
        );
    }

    // ─────────────────────────────────────────
    //  View Functions
    // ─────────────────────────────────────────

    function getPolicy(uint256 policyId) external view returns (Policy memory) {
        return policies[policyId];
    }

    function getClaim(uint256 claimId) external view returns (Claim memory) {
        return claims[claimId];
    }

    function getPatientPolicies(address patient) external view returns (uint256[] memory) {
        return _patientPolicies[patient];
    }

    function getPatientClaims(address patient) external view returns (uint256[] memory) {
        return _patientClaims[patient];
    }

    function getAllPolicyIds() external view returns (uint256[] memory) {
        return _allPolicyIds;
    }

    function getAllClaimIds() external view returns (uint256[] memory) {
        return _allClaimIds;
    }

    function getContractBalance() external view returns (uint256) {
        return stablecoin.balanceOf(address(this));
    }

    function getStats() external view returns (
        uint256 premiumsCollected,
        uint256 claimsPaid,
        uint256 contractBalance,
        uint256 policiesCount,
        uint256 claimsCount
    ) {
        return (
            totalPremiumsCollected,
            totalClaimsPaid,
            stablecoin.balanceOf(address(this)),
            totalPoliciesCreated,
            totalClaimsSubmitted
        );
    }
}
