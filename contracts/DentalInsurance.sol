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

    // ─── Application (청약 심사) ───────────────────────────────

    struct Application {
        uint256 id;
        address applicant;
        string  applicantName;
        uint256 age;               // 나이
        uint256 monthlyPremium;
        uint256 coverageLimit;
        uint256 maturityDays;
        uint256 maturityRefundRate;
        ApplicationStatus status;
        uint256 submittedAt;
        uint256 processedAt;
        string  rejectReason;
        uint256 policyId;          // 승인 시 생성된 증권 ID
        uint8   riskScore;         // 자동 심사 위험 점수 (0~100)
    }

    enum ApplicationStatus { Pending, Approved, Rejected }

    // ─── Policy Loan (약관대출) ────────────────────────────────

    struct PolicyLoan {
        uint256 policyId;
        uint256 loanAmount;        // 대출 원금 (USDC 6 decimals)
        uint256 borrowedAt;        // 대출 시각
        uint256 interestRate;      // 연 이자율 (basis points, 500 = 5%)
        bool    active;
    }

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

    // ─── Application State ─────────────────────────────────────
    uint256 public nextApplicationId = 1;
    mapping(uint256 => Application) public applications;
    uint256[] private _allApplicationIds;
    mapping(address => uint256[]) private _applicantApplications;

    // 자동 심사 룰 파라미터 (관리자 변경 가능)
    uint256 public minAge                    = 18;
    uint256 public maxAge                    = 75;
    uint256 public maxCoverageRatio          = 100;  // coverageLimit / monthlyPremium 최대 배율
    uint256 public minMonthlyPremium         = 1_000000; // 최소 1 USDC
    uint256 public maxActivePoliciesPerPerson = 3;

    // ─── Policy Loan State ─────────────────────────────────────
    mapping(uint256 => PolicyLoan) public policyLoans;
    uint256 public loanInterestRate = 500;  // 연 5% (basis points)
    uint256 public maxLoanRatio     = 80;   // 해지환급금의 80% 한도

    // ─── Oracle State ──────────────────────────────────────────
    address public oracleAddress;
    bool    public oracleModeEnabled;

    struct OracleVerification {
        bool    exists;
        bool    approved;
        bytes32 dataHash;        // keccak256(진료내역 JSON)
        uint256 verifiedAt;
        string  hospitalName;
        string  verificationCode; // 검증 결과 코드 (예: VERIFIED, AMOUNT_EXCEEDED, UNKNOWN_CODE)
    }
    mapping(uint256 => OracleVerification) public oracleVerifications;

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

    // ─── Application Events ────────────────────────────────────
    event ApplicationSubmitted(
        uint256 indexed appId,
        address indexed applicant,
        string  applicantName,
        uint256 riskScore,
        uint256 timestamp
    );
    event ApplicationApproved(
        uint256 indexed appId,
        uint256 indexed policyId,
        uint256 timestamp
    );
    event ApplicationRejected(
        uint256 indexed appId,
        address indexed applicant,
        string  reason,
        uint256 timestamp
    );

    // ─── Policy Loan Events ────────────────────────────────────
    event PolicyLoanTaken(
        uint256 indexed policyId,
        address indexed patient,
        uint256 loanAmount,
        uint256 timestamp
    );
    event PolicyLoanRepaid(
        uint256 indexed policyId,
        address indexed patient,
        uint256 principal,
        uint256 interest,
        uint256 timestamp
    );
    event MaturityRefundPaid(
        uint256 indexed policyId,
        address indexed patient,
        uint256 refundAmount,
        uint256 timestamp
    );
    event PremiumAutoCollected(
        uint256 indexed policyId,
        address indexed patient,
        uint256 amount,
        uint256 totalPaid,
        uint256 timestamp
    );

    // ─── Oracle Events ─────────────────────────────────────────
    event OracleAddressSet(address indexed oracle);
    event OracleModeSet(bool enabled);
    event ClaimOracleVerified(
        uint256 indexed claimId,
        bool    approved,
        bytes32 dataHash,
        string  hospitalName,
        uint256 timestamp
    );

    // ─────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────

    modifier onlyOracle() {
        require(oracleAddress != address(0), "Oracle not configured");
        require(msg.sender == oracleAddress, "Caller is not oracle");
        _;
    }

    constructor(address _stablecoin) Ownable(msg.sender) {
        require(_stablecoin != address(0), "Invalid stablecoin address");
        stablecoin = IERC20(_stablecoin);
    }

    // ─────────────────────────────────────────
    //  Oracle Management (Admin)
    // ─────────────────────────────────────────

    /**
     * @dev 오라클 주소 설정 (관리자 전용)
     * @param _oracle 오라클 서비스 지갑 주소
     */
    function setOracleAddress(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Invalid oracle address");
        oracleAddress = _oracle;
        emit OracleAddressSet(_oracle);
    }

    /**
     * @dev 오라클 모드 활성화/비활성화 (관리자 전용)
     *      활성화 시: 청구 제출 후 오라클이 자동 검증
     *      비활성화 시: 기존 수동 승인/거절 방식 유지
     */
    function setOracleMode(bool _enabled) external onlyOwner {
        oracleModeEnabled = _enabled;
        emit OracleModeSet(_enabled);
    }

    /**
     * @dev 오라클 진료내역 검증 후 청구 자동 처리 (오라클 전용)
     *      승인 시: Approved + 즉시 USDC 지급 (원자적 처리)
     *      거절 시: Rejected + 거절 사유 기록
     * @param claimId       처리할 청구 ID
     * @param approved      승인 여부
     * @param dataHash      진료내역 JSON의 keccak256 해시 (감사 추적용)
     * @param hospitalName  검증된 병원명
     * @param verificationCode 검증 결과 코드 (VERIFIED / AMOUNT_EXCEEDED / UNKNOWN_CODE 등)
     */
    function oracleVerifyAndProcess(
        uint256 claimId,
        bool    approved,
        bytes32 dataHash,
        string  calldata hospitalName,
        string  calldata verificationCode
    ) external onlyOracle nonReentrant {
        Claim storage claim = claims[claimId];
        require(claim.id != 0,                       "Claim not found");
        require(claim.status == ClaimStatus.Pending, "Claim not pending");

        oracleVerifications[claimId] = OracleVerification({
            exists:           true,
            approved:         approved,
            dataHash:         dataHash,
            verifiedAt:       block.timestamp,
            hospitalName:     hospitalName,
            verificationCode: verificationCode
        });

        claim.processedAt = block.timestamp;

        if (approved) {
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
            emit ClaimApproved(claimId, claim.policyId, claim.amount, block.timestamp);
            emit ClaimPaid(claimId, claim.policyId, claim.patient, claim.amount, block.timestamp);
        } else {
            claim.status      = ClaimStatus.Rejected;
            claim.rejectReason = string(abi.encodePacked("Oracle: ", verificationCode));
            emit ClaimRejected(claimId, claim.policyId, claim.rejectReason, block.timestamp);
        }

        emit ClaimOracleVerified(claimId, approved, dataHash, hospitalName, block.timestamp);
    }

    /**
     * @dev 오라클 검증 결과 조회
     */
    function getOracleVerification(uint256 claimId) external view returns (OracleVerification memory) {
        return oracleVerifications[claimId];
    }

    // ─────────────────────────────────────────
    //  Admin: Policy Management
    // ─────────────────────────────────────────

    /**
     * @dev 보험증권 생성 (관리자 전용 직접 생성)
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
        return _createPolicyInternal(patient, patientName, monthlyPremium, coverageLimit, maturityDate, maturityRefundRate);
    }

    /**
     * @dev 내부 증권 생성 (createPolicy + approveApplication 공용)
     */
    function _createPolicyInternal(
        address patient,
        string  memory patientName,
        uint256 monthlyPremium,
        uint256 coverageLimit,
        uint256 maturityDate,
        uint256 maturityRefundRate
    ) internal returns (uint256) {
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

    // ─────────────────────────────────────────
    //  Underwriting: Application (청약 심사)
    // ─────────────────────────────────────────

    /**
     * @dev 보험 청약 신청 (누구나 호출 가능)
     *      스마트 컨트랙트가 자동으로 심사 룰을 체크한다.
     *      - 심사 통과: Pending → 관리자가 최종 승인/거절
     *      - 심사 실패: 즉시 Rejected (트랜잭션은 성공, revert 아님)
     */
    function submitApplication(
        string  calldata applicantName,
        uint256 age,
        uint256 monthlyPremium,
        uint256 coverageLimit,
        uint256 maturityDays,
        uint256 maturityRefundRate
    ) external returns (uint256) {
        require(bytes(applicantName).length > 0, "Name required");
        require(monthlyPremium > 0, "Premium must be > 0");
        require(coverageLimit > 0, "Coverage must be > 0");
        require(maturityDays > 0, "Maturity days must be > 0");
        require(maturityRefundRate <= 100, "Refund rate must be <= 100");

        (bool passed, string memory rejectReason, uint8 score) =
            _underwrite(msg.sender, age, monthlyPremium, coverageLimit);

        uint256 appId = nextApplicationId++;

        applications[appId] = Application({
            id:                appId,
            applicant:         msg.sender,
            applicantName:     applicantName,
            age:               age,
            monthlyPremium:    monthlyPremium,
            coverageLimit:     coverageLimit,
            maturityDays:      maturityDays,
            maturityRefundRate: maturityRefundRate,
            status:            passed ? ApplicationStatus.Pending : ApplicationStatus.Rejected,
            submittedAt:       block.timestamp,
            processedAt:       passed ? 0 : block.timestamp,
            rejectReason:      rejectReason,
            policyId:          0,
            riskScore:         score
        });

        _applicantApplications[msg.sender].push(appId);
        _allApplicationIds.push(appId);

        emit ApplicationSubmitted(appId, msg.sender, applicantName, score, block.timestamp);
        if (!passed) {
            emit ApplicationRejected(appId, msg.sender, rejectReason, block.timestamp);
        }

        return appId;
    }

    /**
     * @dev 내부 자동 심사 룰 엔진
     *      반환: (통과여부, 거절사유, 위험점수 0~100)
     */
    function _underwrite(
        address applicant,
        uint256 age,
        uint256 monthlyPremium,
        uint256 coverageLimit
    ) internal view returns (bool passed, string memory reason, uint8 score) {
        // ① 연령 체크
        if (age < minAge)
            return (false, unicode"청약 불가: 만 18세 미만 가입 불가", 100);
        if (age > maxAge)
            return (false, unicode"청약 불가: 만 75세 초과 가입 불가", 100);

        // ② 최소 보험료 체크
        if (monthlyPremium < minMonthlyPremium)
            return (false, unicode"청약 불가: 월 보험료가 최소 기준(1 USDC) 미달", 90);

        // ③ 보장/보험료 비율 체크
        uint256 ratio = coverageLimit / monthlyPremium;
        if (ratio > maxCoverageRatio)
            return (false, unicode"청약 불가: 보장한도/월보험료 비율이 100배 초과", 80);

        // ④ 1인 최대 활성 증권 수 체크
        uint256[] storage patPolicies = _patientPolicies[applicant];
        uint256 activeCount = 0;
        for (uint256 i = 0; i < patPolicies.length; i++) {
            if (policies[patPolicies[i]].active) activeCount++;
        }
        if (activeCount >= maxActivePoliciesPerPerson)
            return (false, unicode"청약 불가: 1인 최대 가입 한도(3건) 초과", 90);

        // ⑤ 위험 점수 계산
        uint8 riskScore = 0;
        if      (age >= 65) riskScore += 40;
        else if (age >= 50) riskScore += 25;
        else if (age >= 40) riskScore += 15;

        if (ratio > 50) riskScore += 20;
        if (ratio > 80) riskScore += 10;

        if (riskScore > 100) riskScore = 100;

        return (true, "", riskScore);
    }

    /**
     * @dev 청약 최종 승인 (관리자) → 보험증권 자동 생성
     */
    function approveApplication(uint256 appId) external onlyOwner returns (uint256) {
        Application storage app = applications[appId];
        require(app.id != 0,                                "Application not found");
        require(app.status == ApplicationStatus.Pending,    "Application not pending");

        app.status      = ApplicationStatus.Approved;
        app.processedAt = block.timestamp;

        uint256 maturityDate = block.timestamp + app.maturityDays * 1 days;
        uint256 policyId = _createPolicyInternal(
            app.applicant,
            app.applicantName,
            app.monthlyPremium,
            app.coverageLimit,
            maturityDate,
            app.maturityRefundRate
        );

        app.policyId = policyId;
        emit ApplicationApproved(appId, policyId, block.timestamp);
        return policyId;
    }

    /**
     * @dev 청약 거절 (관리자)
     */
    function rejectApplication(uint256 appId, string calldata reason) external onlyOwner {
        Application storage app = applications[appId];
        require(app.id != 0,                                "Application not found");
        require(app.status == ApplicationStatus.Pending,    "Application not pending");

        app.status       = ApplicationStatus.Rejected;
        app.processedAt  = block.timestamp;
        app.rejectReason = reason;

        emit ApplicationRejected(appId, app.applicant, reason, block.timestamp);
    }

    /**
     * @dev 심사 룰 파라미터 변경 (관리자)
     */
    function setUnderwritingRules(
        uint256 _minAge,
        uint256 _maxAge,
        uint256 _maxCoverageRatio,
        uint256 _minMonthlyPremium,
        uint256 _maxActivePolicies
    ) external onlyOwner {
        minAge                     = _minAge;
        maxAge                     = _maxAge;
        maxCoverageRatio           = _maxCoverageRatio;
        minMonthlyPremium          = _minMonthlyPremium;
        maxActivePoliciesPerPerson = _maxActivePolicies;
    }

    // ─────────────────────────────────────────
    //  Policy Loan (약관대출)
    // ─────────────────────────────────────────

    /**
     * @dev 최대 대출 가능 금액 조회
     *      해지환급금(totalPaid × refundRate%) × maxLoanRatio%
     */
    function getMaxLoanAmount(uint256 policyId) public view returns (uint256) {
        Policy storage policy = policies[policyId];
        if (policy.id == 0 || !policy.active || policy.totalPaid == 0) return 0;
        uint256 surrenderValue = (policy.totalPaid * policy.maturityRefundRate) / 100;
        return (surrenderValue * maxLoanRatio) / 100;
    }

    /**
     * @dev 현재 대출 이자 조회 (단순 이자)
     */
    function getCurrentInterest(uint256 policyId) public view returns (uint256) {
        PolicyLoan storage loan = policyLoans[policyId];
        if (!loan.active || loan.loanAmount == 0) return 0;
        uint256 elapsed = block.timestamp - loan.borrowedAt;
        // 단순 이자: 원금 × 연이율(bps) × 경과초 / (365일 × 10000)
        return (loan.loanAmount * loan.interestRate * elapsed) / (365 days * 10000);
    }

    /**
     * @dev 현재 상환해야 할 총 금액 (원금 + 이자)
     */
    function getLoanRepayAmount(uint256 policyId) external view returns (uint256 principal, uint256 interest, uint256 total) {
        PolicyLoan storage loan = policyLoans[policyId];
        if (!loan.active) return (0, 0, 0);
        principal = loan.loanAmount;
        interest  = getCurrentInterest(policyId);
        total     = principal + interest;
    }

    /**
     * @dev 약관대출 신청 (피보험자)
     *      대출 한도: 해지환급금(totalPaid × refundRate%)의 maxLoanRatio%
     */
    function requestPolicyLoan(uint256 policyId, uint256 amount) external nonReentrant {
        Policy storage policy = policies[policyId];
        require(policy.id != 0,                "Policy not found");
        require(policy.active,                 "Policy not active");
        require(policy.patient == msg.sender,  "Not the policy holder");
        require(policy.totalPaid > 0,          "No premiums paid yet");
        require(!policyLoans[policyId].active, "Existing loan not yet repaid");

        uint256 maxAmount = getMaxLoanAmount(policyId);
        require(maxAmount > 0,         "Surrender value is zero - pay more premiums first");
        require(amount > 0,            "Loan amount must be > 0");
        require(amount <= maxAmount,   "Exceeds max loan amount");
        require(
            stablecoin.balanceOf(address(this)) >= amount,
            "Insufficient contract balance"
        );

        policyLoans[policyId] = PolicyLoan({
            policyId:     policyId,
            loanAmount:   amount,
            borrowedAt:   block.timestamp,
            interestRate: loanInterestRate,
            active:       true
        });

        require(stablecoin.transfer(msg.sender, amount), "Transfer failed");
        emit PolicyLoanTaken(policyId, msg.sender, amount, block.timestamp);
    }

    /**
     * @dev 약관대출 상환 (피보험자) — 원금 + 이자 전액 일시 상환
     *      사전에 USDC approve 필요
     */
    function repayPolicyLoan(uint256 policyId) external nonReentrant {
        PolicyLoan storage loan = policyLoans[policyId];
        require(loan.active, "No active loan for this policy");

        Policy storage policy = policies[policyId];
        require(policy.patient == msg.sender, "Not the policy holder");

        uint256 principal = loan.loanAmount;
        uint256 interest  = getCurrentInterest(policyId);
        uint256 total     = principal + interest;

        require(
            stablecoin.transferFrom(msg.sender, address(this), total),
            "Transfer failed - check USDC allowance"
        );

        loan.active      = false;
        loan.loanAmount  = 0;

        emit PolicyLoanRepaid(policyId, msg.sender, principal, interest, block.timestamp);
    }

    /**
     * @dev 대출 이자율 변경 (관리자, basis points 단위)
     */
    function setLoanInterestRate(uint256 bps) external onlyOwner {
        require(bps <= 3000, "Rate cannot exceed 30%");
        loanInterestRate = bps;
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

    // ─────────────────────────────────────────
    //  Auto Premium Collection
    // ─────────────────────────────────────────

    /**
     * @dev 자동 보험료 수납 (관리자 전용)
     *      피보험자가 이 컨트랙트에 충분한 USDC approve를 미리 해둔 경우에만 성공
     *      납입 기한(nextDueTime) 도달 후에만 실행 가능
     */
    function collectPremium(uint256 policyId) external onlyOwner nonReentrant {
        Policy storage policy = policies[policyId];
        require(policy.id != 0,                "Policy not found");
        require(policy.active,                 "Policy not active");
        require(block.timestamp >= policy.nextDueTime, "Premium not yet due");

        uint256 amount = policy.monthlyPremium;
        require(
            stablecoin.allowance(policy.patient, address(this)) >= amount,
            "Insufficient allowance - patient must approve auto-pay"
        );
        require(
            stablecoin.balanceOf(policy.patient) >= amount,
            "Insufficient patient balance"
        );
        require(
            stablecoin.transferFrom(policy.patient, address(this), amount),
            "Auto-collection failed"
        );

        policy.totalPaid       += amount;
        policy.lastPaymentTime  = block.timestamp;
        policy.nextDueTime      = block.timestamp + 30 days;
        totalPremiumsCollected += amount;

        emit PremiumPaid(policyId, policy.patient, amount, policy.totalPaid, block.timestamp);
        emit PremiumAutoCollected(policyId, policy.patient, amount, policy.totalPaid, block.timestamp);
    }

    /**
     * @dev 납입 기한 도달 여부 조회
     */
    function isDue(uint256 policyId) external view returns (bool) {
        Policy storage policy = policies[policyId];
        return (
            policy.id != 0 &&
            policy.active &&
            block.timestamp >= policy.nextDueTime
        );
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

    // ─── Application View ──────────────────────────────────────

    function getApplication(uint256 appId) external view returns (Application memory) {
        return applications[appId];
    }

    function getAllApplicationIds() external view returns (uint256[] memory) {
        return _allApplicationIds;
    }

    function getApplicantApplications(address applicant) external view returns (uint256[] memory) {
        return _applicantApplications[applicant];
    }

    // ─── Policy Loan View ──────────────────────────────────────

    function getPolicyLoan(uint256 policyId) external view returns (PolicyLoan memory) {
        return policyLoans[policyId];
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
