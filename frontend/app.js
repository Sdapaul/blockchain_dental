/**
 * 덴탈보험 블록체인 UI - app.js
 * ethers.js v6 | 전체 행위 로깅 + 에러 상세 분석
 */

// ── ABIs ─────────────────────────────────────────────────────
const USDC_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function faucet(uint256 amount)",
  "function mint(address to, uint256 amount)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event FaucetUsed(address indexed user, uint256 amount)"
];

const INSURANCE_ABI = [
  "function stablecoin() view returns (address)",
  "function owner() view returns (address)",
  "function nextPolicyId() view returns (uint256)",
  "function nextClaimId() view returns (uint256)",
  "function totalPremiumsCollected() view returns (uint256)",
  "function totalClaimsPaid() view returns (uint256)",
  "function createPolicy(address patient, string patientName, uint256 monthlyPremium, uint256 coverageLimit, uint256 maturityDate, uint256 maturityRefundRate) returns (uint256)",
  "function deactivatePolicy(uint256 policyId)",
  "function depositFunds(uint256 amount)",
  "function payPremium(uint256 policyId)",
  "function submitClaim(uint256 policyId, uint256 amount, string treatmentCode, string description) returns (uint256)",
  "function approveClaim(uint256 claimId)",
  "function rejectClaim(uint256 claimId, string reason)",
  "function payClaim(uint256 claimId)",
  "function getPolicy(uint256 policyId) view returns (tuple(uint256 id, address patient, string patientName, uint256 monthlyPremium, uint256 coverageLimit, uint256 totalPaid, uint256 lastPaymentTime, uint256 nextDueTime, bool active, uint256 createdAt, uint256 maturityDate, uint256 maturityRefundRate, bool maturityPaid))",
  "function processMaturityRefund(uint256 policyId)",
  "function isMatured(uint256 policyId) view returns (bool)",
  "function getClaim(uint256 claimId) view returns (tuple(uint256 id, uint256 policyId, address patient, uint256 amount, string treatmentCode, string description, uint8 status, uint256 submittedAt, uint256 processedAt, string rejectReason))",
  "function getPatientPolicies(address patient) view returns (uint256[])",
  "function getPatientClaims(address patient) view returns (uint256[])",
  "function getAllPolicyIds() view returns (uint256[])",
  "function getAllClaimIds() view returns (uint256[])",
  "function getContractBalance() view returns (uint256)",
  "function getStats() view returns (uint256 premiumsCollected, uint256 claimsPaid, uint256 contractBalance, uint256 policiesCount, uint256 claimsCount)",
  "event PolicyCreated(uint256 indexed policyId, address indexed patient, string patientName, uint256 monthlyPremium, uint256 coverageLimit, uint256 timestamp)",
  "event PremiumPaid(uint256 indexed policyId, address indexed patient, uint256 amount, uint256 totalPaid, uint256 timestamp)",
  "event ClaimSubmitted(uint256 indexed claimId, uint256 indexed policyId, address indexed patient, uint256 amount, string treatmentCode, uint256 timestamp)",
  "event ClaimApproved(uint256 indexed claimId, uint256 indexed policyId, uint256 amount, uint256 timestamp)",
  "event ClaimRejected(uint256 indexed claimId, uint256 indexed policyId, string reason, uint256 timestamp)",
  "event ClaimPaid(uint256 indexed claimId, uint256 indexed policyId, address indexed patient, uint256 amount, uint256 timestamp)",
  "event PolicyDeactivated(uint256 indexed policyId, uint256 timestamp)",
  "event FundsDeposited(address indexed depositor, uint256 amount, uint256 timestamp)",
  "event MaturityRefundPaid(uint256 indexed policyId, address indexed patient, uint256 refundAmount, uint256 timestamp)",
  // Oracle
  "function oracleAddress() view returns (address)",
  "function oracleModeEnabled() view returns (bool)",
  "function setOracleAddress(address _oracle)",
  "function setOracleMode(bool _enabled)",
  "function getOracleVerification(uint256 claimId) view returns (tuple(bool exists, bool approved, bytes32 dataHash, uint256 verifiedAt, string hospitalName, string verificationCode))",
  "event ClaimOracleVerified(uint256 indexed claimId, bool approved, bytes32 dataHash, string hospitalName, uint256 timestamp)",
  // 자동납부
  "function collectPremium(uint256 policyId)",
  "function isDue(uint256 policyId) view returns (bool)",
  "event PremiumAutoCollected(uint256 indexed policyId, address indexed patient, uint256 amount, uint256 totalPaid, uint256 timestamp)",
  // ─── 청약 심사 (Underwriting) ──────────────────────────────
  "function submitApplication(string applicantName, uint256 age, uint256 monthlyPremium, uint256 coverageLimit, uint256 maturityDays, uint256 maturityRefundRate) returns (uint256)",
  "function approveApplication(uint256 appId) returns (uint256)",
  "function rejectApplication(uint256 appId, string reason)",
  "function getApplication(uint256 appId) view returns (tuple(uint256 id, address applicant, string applicantName, uint256 age, uint256 monthlyPremium, uint256 coverageLimit, uint256 maturityDays, uint256 maturityRefundRate, uint8 status, uint256 submittedAt, uint256 processedAt, string rejectReason, uint256 policyId, uint8 riskScore))",
  "function getAllApplicationIds() view returns (uint256[])",
  "function getApplicantApplications(address applicant) view returns (uint256[])",
  "function nextApplicationId() view returns (uint256)",
  "event ApplicationSubmitted(uint256 indexed appId, address indexed applicant, string applicantName, uint256 riskScore, uint256 timestamp)",
  "event ApplicationApproved(uint256 indexed appId, uint256 indexed policyId, uint256 timestamp)",
  "event ApplicationRejected(uint256 indexed appId, address indexed applicant, string reason, uint256 timestamp)",
  // ─── 약관대출 (Policy Loan) ────────────────────────────────
  "function requestPolicyLoan(uint256 policyId, uint256 amount)",
  "function repayPolicyLoan(uint256 policyId)",
  "function getMaxLoanAmount(uint256 policyId) view returns (uint256)",
  "function getCurrentInterest(uint256 policyId) view returns (uint256)",
  "function getLoanRepayAmount(uint256 policyId) view returns (uint256 principal, uint256 interest, uint256 total)",
  "function getPolicyLoan(uint256 policyId) view returns (tuple(uint256 policyId, uint256 loanAmount, uint256 borrowedAt, uint256 interestRate, bool active))",
  "function loanInterestRate() view returns (uint256)",
  "function maxLoanRatio() view returns (uint256)",
  "event PolicyLoanTaken(uint256 indexed policyId, address indexed patient, uint256 loanAmount, uint256 timestamp)",
  "event PolicyLoanRepaid(uint256 indexed policyId, address indexed patient, uint256 principal, uint256 interest, uint256 timestamp)"
];

// ── Hardhat 계정 이름 매핑 ────────────────────────────────────
const KNOWN_ACCOUNTS = {
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266": { name: "관리자",  account: "#0" },
  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8": { name: "김덴탈",  account: "#1" },
  "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc": { name: "이치과",  account: "#2" },
  "0x90f79bf6eb2c4f870365e785982e1f101e93b906": { name: "오라클",  account: "#3" },
  "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65": { name: "박청약",  account: "#4" },
  "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc": { name: "최이십",  account: "#5" },
  "0x976ea74026e726554db657fa54763abd0c3a0aa9": { name: "노거절",  account: "#6" },
};

function getAccountInfo(addr) {
  if (!addr) return null;
  return KNOWN_ACCOUNTS[addr.toLowerCase()] || null;
}

// ── 전역 상태 ─────────────────────────────────────────────────
let provider  = null;
let signer    = null;
let userAddr  = null;
let usdcAddr  = null;
let insAddr   = null;
let usdcCtx   = null;
let insCtx    = null;
let usdcSign  = null;
let insSign   = null;
let isOwner   = false;
let eventListenersAttached = false;

// ── 통화 모드 ─────────────────────────────────────────────────
let currencyMode = 'USDC';   // 'USDC' | 'KRW'
let configCache  = null;     // config.json 캐시

function stableDecimals() { return currencyMode === 'KRW' ? 0 : 6; }
function stableSymbol()   { return currencyMode === 'KRW' ? '₩' : '$'; }
function stableName()     { return currencyMode === 'KRW' ? 'KRW' : 'USDC'; }

// 로그 상태
let logEntries    = [];
let logSeq        = 0;
let logFilter     = "all";
let logSearch     = "";
let logAutoScroll = true;
const LOG_MAX     = 500;

const CLAIM_STATUS       = ["대기중", "승인됨", "거절됨", "지급완료"];
const CLAIM_STATUS_CLASS = ["badge-pending", "badge-approved", "badge-rejected", "badge-paid"];

// ═══════════════════════════════════════════════════════════════
//  유틸
// ═══════════════════════════════════════════════════════════════
function fmt(amount) {
  if (amount === undefined || amount === null) return currencyMode === 'KRW' ? "0" : "0.00";
  const n = typeof amount === "bigint" ? amount : BigInt(amount.toString());
  return ethers.formatUnits(n, stableDecimals());
}
function fmtUsdc(amount) {
  if (currencyMode === 'KRW') {
    const n = typeof amount === "bigint" ? amount : BigInt((amount || 0).toString());
    return "₩" + Number(n).toLocaleString("ko-KR");
  }
  return `$${parseFloat(fmt(amount)).toLocaleString("ko-KR", {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  })}`;
}
function shortAddr(addr) {
  if (!addr) return "-";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
function tsToDate(ts) {
  if (!ts || ts === 0n) return "-";
  return new Date(Number(ts) * 1000).toLocaleString("ko-KR");
}
function nowFull() {
  return new Date().toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function el(id) { return document.getElementById(id); }
function parseUsdc(val) {
  try { return ethers.parseUnits(String(parseFloat(val || 0)), stableDecimals()); }
  catch { return 0n; }
}

// ═══════════════════════════════════════════════════════════════
//  에러 파싱 (핵심 - 모든 에러 유형 처리)
// ═══════════════════════════════════════════════════════════════
function parseError(err) {
  if (!err) return "알 수 없는 오류";

  const lines = [];

  // ── MetaMask 사용자 거절
  if (err.code === 4001 || err.code === "ACTION_REJECTED") {
    return "🚫 사용자가 MetaMask 서명을 거절했습니다.";
  }

  // ── Solidity revert 사유 (가장 중요)
  if (err.reason) {
    lines.push(`⛔ Revert 사유: "${err.reason}"`);
  }

  // ── ethers shortMessage
  if (err.shortMessage && err.shortMessage !== err.reason) {
    lines.push(`📋 오류 요약: ${err.shortMessage}`);
  }

  // ── 에러 코드
  if (err.code && err.code !== 4001 && err.code !== "ACTION_REJECTED") {
    lines.push(`🔢 에러 코드: ${err.code}`);
  }

  // ── 중첩 에러 (MetaMask → RPC 노드 → Solidity)
  const nested =
    err.info?.error?.data?.message ||
    err.info?.error?.message       ||
    err.error?.data?.message       ||
    err.error?.message             ||
    err.cause?.message;
  if (nested && nested !== err.message && nested !== err.shortMessage) {
    lines.push(`🔗 내부 오류: ${nested}`);
  }

  // ── 트랜잭션 정보
  if (err.transaction) {
    const tx = err.transaction;
    lines.push(`📤 To: ${tx.to || "-"}`);
    lines.push(`📤 From: ${tx.from || "-"}`);
    if (tx.data && tx.data.length > 10) {
      lines.push(`📤 Data: ${tx.data.slice(0, 42)}...`);
    }
  }

  // ── receipt (트랜잭션 실패 후)
  if (err.receipt) {
    lines.push(`🧾 블록: ${err.receipt.blockNumber}`);
    lines.push(`🧾 Gas Used: ${err.receipt.gasUsed}`);
    lines.push(`🧾 Status: ${err.receipt.status === 0 ? "실패(0)" : "성공(1)"}`);
  }

  // ── 에러 데이터
  if (err.data && err.data !== "0x") {
    lines.push(`💾 Error data: ${String(err.data).slice(0, 66)}`);
  }

  // ── 기본 메시지 (위에서 아무것도 없을 때)
  if (lines.length === 0) {
    lines.push(`❌ ${err.message || String(err)}`);
  }

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════
//  로그 시스템
// ═══════════════════════════════════════════════════════════════
const TYPE_ICON  = { success:"✅", error:"❌", event:"📡", info:"ℹ️", warning:"⚠️", step:"🔄", call:"📞" };
const TYPE_LABEL = { success:"성공", error:"오류", event:"이벤트", info:"정보", warning:"경고", step:"단계", call:"조회" };

function addLog(type, msg, detail = "", hash = "") {
  const seq   = ++logSeq;
  const entry = { seq, type, msg, detail, hash, time: nowFull() };
  logEntries.unshift(entry);

  // 최대 개수 유지
  if (logEntries.length > LOG_MAX) logEntries.pop();

  // 카운터 업데이트
  updateLogCounters();

  // DOM 렌더
  renderLogEntry(entry, true);

  // 자동 스크롤
  if (logAutoScroll) {
    const c = el("txLog");
    if (c) c.scrollTop = 0;
  }
}

function renderLogEntry(entry, prepend = false) {
  const container = el("txLog");
  if (!container) return;

  // 필터 적용
  if (logFilter !== "all" && entry.type !== logFilter) return;
  if (logSearch && !entry.msg.toLowerCase().includes(logSearch) &&
      !entry.detail.toLowerCase().includes(logSearch)) return;

  const div = document.createElement("div");
  div.className    = `tx-entry tx-${entry.type}`;
  div.dataset.seq  = entry.seq;
  div.dataset.type = entry.type;

  const hashHtml = entry.hash
    ? `<div class="tx-hash" onclick="copyToClip('${entry.hash}')" title="클릭 → 복사">
         🔗 ${entry.hash.slice(0, 14)}...${entry.hash.slice(-8)}
       </div>`
    : "";

  // detail 줄바꿈 처리
  const detailSafe = entry.detail
    ? `<div class="tx-detail">${entry.detail.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/\n/g,"<br>")}</div>`
    : "";

  div.innerHTML = `
    <div class="tx-header">
      <span class="tx-type">${TYPE_ICON[entry.type] || "•"} [${String(entry.seq).padStart(3,"0")}] ${TYPE_LABEL[entry.type] || entry.type}</span>
      <span class="tx-time">${entry.time}</span>
    </div>
    <div class="tx-msg">${entry.msg.replace(/&/g,"&amp;").replace(/</g,"&lt;")}</div>
    ${hashHtml}
    ${detailSafe}
  `;

  if (prepend) {
    container.prepend(div);
    // 최대 DOM 노드 수 제한
    while (container.children.length > LOG_MAX) {
      container.removeChild(container.lastChild);
    }
  } else {
    container.appendChild(div);
  }
}

function updateLogCounters() {
  const counts = { all:logEntries.length, success:0, error:0, event:0, info:0, warning:0, step:0, call:0 };
  logEntries.forEach(e => { if (counts[e.type] !== undefined) counts[e.type]++; });

  // 필터 버튼 배지
  Object.keys(counts).forEach(k => {
    [`logCount_${k}`, `logCount_${k}2`].forEach(id => {
      const e2 = el(id);
      if (e2) e2.textContent = counts[k];
    });
  });
}

// 필터 변경
function setLogFilter(type) {
  logFilter = type;
  document.querySelectorAll(".log-filter-btn").forEach(b => b.classList.remove("active"));
  const active = document.querySelector(`[data-filter="${type}"]`);
  if (active) active.classList.add("active");
  rebuildLogView();
}

// 검색
function onLogSearch(val) {
  logSearch = val.toLowerCase().trim();
  rebuildLogView();
}

// DOM 전체 재구성 (필터/검색 변경 시)
function rebuildLogView() {
  const container = el("txLog");
  if (!container) return;
  container.innerHTML = "";
  // 최신순 (이미 unshift로 앞에 추가되므로 순서 그대로)
  logEntries.forEach(entry => renderLogEntry(entry, false));
}

// 전체 로그 지우기
function clearLog() {
  logEntries = [];
  logSeq     = 0;
  const c = el("txLog");
  if (c) c.innerHTML = "";
  updateLogCounters();
  addLog("info", "로그 초기화됨");
}

// 로그 파일로 내보내기
function exportLog() {
  const lines = logEntries.map(e =>
    `[${e.time}] [${e.seq}] [${e.type.toUpperCase()}] ${e.msg}` +
    (e.detail ? `\n  └ ${e.detail.replace(/\n/g, "\n    ")}` : "") +
    (e.hash   ? `\n  🔗 TxHash: ${e.hash}` : "")
  ).join("\n\n");

  const blob = new Blob([lines], { type: "text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `dental_insurance_log_${new Date().toISOString().slice(0,19).replace(/:/g,"-")}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  addLog("info", `로그 내보내기 완료 (총 ${logEntries.length}건)`);
}

// 자동 스크롤 토글
function toggleAutoScroll() {
  logAutoScroll = !logAutoScroll;
  const btn = el("autoScrollBtn");
  if (btn) btn.textContent = logAutoScroll ? "⬆ 자동스크롤 ON" : "⬆ 자동스크롤 OFF";
  btn.style.opacity = logAutoScroll ? "1" : "0.5";
  addLog("info", `자동 스크롤 ${logAutoScroll ? "켜짐" : "꺼짐"}`);
}

// 클립보드 복사
function copyToClip(text) {
  navigator.clipboard.writeText(text)
    .then(() => showToast("복사됨: " + text.slice(0, 30) + "..."))
    .catch(() => showToast("복사 실패", "error"));
}

// ── 전역 에러 캐치 ─────────────────────────────────────────────
window.onerror = function(msg, src, line, col, err) {
  addLog("error", `[JS 전역 오류] ${msg}`,
    `파일: ${src}\n위치: ${line}:${col}\n${err ? parseError(err) : ""}`);
};
window.addEventListener("unhandledrejection", (e) => {
  addLog("error", `[미처리 Promise 거절] ${e.reason?.message || e.reason}`,
    e.reason ? parseError(e.reason) : "");
});

// ── 토스트 ────────────────────────────────────────────────────
function showToast(msg, type = "info") {
  const colors = { info:"#2f81f7", success:"#3fb950", error:"#f85149", warning:"#d29922" };
  const t = document.createElement("div");
  t.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:${colors[type]||colors.info};color:#fff;
    padding:10px 18px;border-radius:8px;font-size:13px;
    box-shadow:0 4px 16px rgba(0,0,0,0.4);max-width:360px;word-break:break-all;
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// ═══════════════════════════════════════════════════════════════
//  네트워크 전환 (Hardhat Local, chainId 31337)
// ═══════════════════════════════════════════════════════════════
const HARDHAT_CHAIN_ID     = "0x7A69";   // 31337
const HARDHAT_CHAIN_ID_DEC = 31337n;

function showNetworkModal() {
  const m = document.getElementById("networkModal");
  if (m) m.classList.remove("hidden");
}

function hideNetworkModal() {
  const m = document.getElementById("networkModal");
  if (m) m.classList.add("hidden");
}

async function switchToHardhat() {
  addLog("step", "[네트워크 전환] Hardhat Local(31337)로 전환 시도 (wallet_switchEthereumChain)");
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: HARDHAT_CHAIN_ID }]
    });
    addLog("success", "네트워크 전환 성공 → Hardhat Local (31337)");
    return true;
  } catch (switchErr) {
    addLog("warning", "wallet_switchEthereumChain 실패",
      `코드: ${switchErr.code}\n사유: ${switchErr.message}\n→ 수동 전환 안내 모달 표시`);
    // 어떤 오류든 수동 안내 모달을 띄운다
    showNetworkModal();
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
//  MetaMask 연결
// ═══════════════════════════════════════════════════════════════
async function connectWallet() {
  addLog("step", "[1] MetaMask 연결 시작");

  if (!window.ethereum) {
    addLog("error", "MetaMask 미설치",
      "window.ethereum 객체가 없습니다.\n→ https://metamask.io 에서 설치 후 새로고침");
    showToast("MetaMask를 설치해주세요!", "error");
    return;
  }
  addLog("info", "window.ethereum 감지됨", `isMetaMask: ${window.ethereum.isMetaMask}`);

  try {
    el("connectBtn").disabled  = true;
    el("connectBtn").innerHTML = `<span class="spinner"></span> 연결 중...`;

    // ── [2] 계정 연결
    addLog("step", "[2] eth_requestAccounts 요청 중 (MetaMask 팝업 확인)");
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer   = await provider.getSigner();
    userAddr = await signer.getAddress();
    addLog("success", "[3] 계정 연결됨", `주소: ${userAddr}`);

    // ── [3] 현재 네트워크 확인
    const network = await provider.getNetwork();
    addLog("info", "[4] 현재 네트워크 확인",
      `이름    : ${network.name}\nChain ID: ${network.chainId}\n` +
      (network.chainId === HARDHAT_CHAIN_ID_DEC
        ? "→ ✅ Hardhat Local 정상"
        : `→ ❌ 잘못된 네트워크 (mainnet/기타)\n   필요: 31337 / 현재: ${network.chainId}\n   → 자동 전환 시도 중...`)
    );

    // ── [4] Mainnet 등 다른 네트워크면 자동 전환
    if (network.chainId !== HARDHAT_CHAIN_ID_DEC) {
      addLog("warning", `현재 네트워크: ${network.name} (${network.chainId}) → 31337로 전환 필요`);
      showToast("Hardhat Local 네트워크로 전환 중...", "warning");

      const switched = await switchToHardhat();
      if (!switched) {
        // 모달이 이미 표시됨 — 사용자가 수동 전환 후 "다시 연결" 클릭 유도
        addLog("warning", "네트워크 수동 전환 필요",
          "화면의 안내 모달을 참고해 MetaMask에서 Hardhat Local(127.0.0.1:8545, chainId 31337)로\n직접 전환 후 [전환 완료 → 다시 연결] 버튼을 클릭하세요.");
        return;
      }

      // 전환 후 provider/signer 재초기화 (chainChanged 이벤트 전에 직접 재초기화)
      addLog("step", "[5] 네트워크 전환 완료 → provider 재초기화");
      provider = new ethers.BrowserProvider(window.ethereum);
      signer   = await provider.getSigner();
      userAddr = await signer.getAddress();
    }

    // ── [5] 전환 후 네트워크 최종 확인
    const finalNetwork = await provider.getNetwork();
    addLog("success", "[6] 네트워크 최종 확인",
      `이름    : ${finalNetwork.name}\nChain ID: ${finalNetwork.chainId}\n→ ✅ Hardhat Local 정상`);

    updateWalletUI(finalNetwork);

    // ── [6] config.json → 컨트랙트 자동 연결
    addLog("step", "[7] config.json 로드 시도");
    await tryLoadConfig();

    const usdcIn = el("usdcAddr").value.trim();
    const insIn  = el("insAddr").value.trim();

    if (ethers.isAddress(usdcIn) && ethers.isAddress(insIn)) {
      addLog("step", "[8] 컨트랙트 자동 연결 시작",
        `USDC: ${usdcIn}\n보험: ${insIn}`);
      await loadContracts(usdcIn, insIn);
    } else {
      addLog("warning", "[8] 컨트랙트 주소 없음 - 수동 입력 필요",
        `→ Setup 패널에 주소 입력 후 [컨트랙트 연결] 클릭\n` +
        `  MockUSDC       : 0x5FbDB2315678afecb367f032d93F642f64180aa3\n` +
        `  DentalInsurance: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`);
      await updateStatusPanel(null, false);
    }

    window.ethereum.on("accountsChanged", (accounts) => {
      addLog("warning", "MetaMask 계정 변경 감지 - 페이지 새로고침",
        `새 계정: ${accounts[0] || "(없음)"}`);
      location.reload();
    });
    window.ethereum.on("chainChanged", (chainId) => {
      addLog("warning", "네트워크 변경 감지 - 페이지 새로고침",
        `새 Chain ID: ${parseInt(chainId, 16)}`);
      location.reload();
    });

  } catch (err) {
    addLog("error", "MetaMask 연결 실패", parseError(err));
    showToast("연결 실패: " + (err.shortMessage || err.message), "error");
  } finally {
    el("connectBtn").disabled  = false;
    el("connectBtn").innerHTML = userAddr
      ? `<span class="pulse-dot"></span> 연결됨`
      : `🦊 MetaMask 연결`;
  }
}

function updateWalletUI(network) {
  const badge    = el("networkBadge");
  const isHardhat = network.chainId === HARDHAT_CHAIN_ID_DEC;

  badge.textContent = isHardhat
    ? `Hardhat Local (31337)`
    : `⚠️ ${network.name || network.chainId} (잘못된 네트워크)`;
  badge.className   = isHardhat ? "network-badge connected" : "network-badge wrong-network";

  renderHeaderName();  // 우선 KNOWN_ACCOUNTS로 표시
}

// 헤더 이름 렌더 — KNOWN_ACCOUNTS 우선, 없으면 컨트랙트 조회
async function renderHeaderName() {
  const addrEl = el("walletAddr");
  if (!addrEl || !userAddr) return;

  const info = getAccountInfo(userAddr);
  let name = info ? info.name : null;

  // KNOWN_ACCOUNTS에 없으면 컨트랙트에서 피보험자명 조회
  if (!name && insCtx) {
    try {
      const ids = await insCtx.getPatientPolicies(userAddr);
      if (ids.length > 0) {
        const policy = await insCtx.getPolicy(ids[0]);
        name = policy.patientName;
      }
    } catch { /* 무시 */ }
  }

  addrEl.textContent = name
    ? `${name} (${shortAddr(userAddr)})`
    : shortAddr(userAddr);
  addrEl.title = userAddr;
}

// ── 연결 상태 패널 ─────────────────────────────────────────────
async function updateStatusPanel(ownerAddr, contractOk) {
  const panel = el("statusPanel");
  if (!panel) return;
  panel.classList.remove("hidden");

  // ① KNOWN_ACCOUNTS 조회
  const info = getAccountInfo(userAddr);
  let displayName = info ? info.name : null;
  let accountTag  = info ? `Account ${info.account}` : null;

  // ② KNOWN_ACCOUNTS에 없으면 컨트랙트에서 피보험자명 조회
  let policyLabel = null;
  if (insCtx && contractOk && !isOwner) {
    try {
      const ids = await insCtx.getPatientPolicies(userAddr);
      if (ids.length > 0) {
        const policy = await insCtx.getPolicy(ids[0]);
        policyLabel = `${policy.patientName} (증권 #${policy.id})`;
        if (!displayName) displayName = policy.patientName;
      }
    } catch { /* 무시 */ }
  }

  const nameHtml = displayName
    ? `<strong style="color:var(--accent-yellow)">${displayName}</strong>${accountTag ? ` <span style="color:var(--text-muted);font-size:10px">${accountTag}</span>` : ""} · `
    : "";

  const addrEl = el("statusMyAddr");
  if (addrEl) {
    addrEl.innerHTML = `${nameHtml}<span style="cursor:pointer" onclick="navigator.clipboard.writeText('${userAddr}').then(()=>showToast('복사됨'))">${shortAddr(userAddr)}</span>`;
  }

  if (el("statusOwner"))    el("statusOwner").textContent    = ownerAddr ? shortAddr(ownerAddr) : "-";
  if (el("statusContract")) el("statusContract").textContent = contractOk ? "✅ 연결됨" : "❌ 미연결";

  const roleEl = el("statusRole");
  if (roleEl) {
    if (!contractOk) {
      roleEl.textContent = "컨트랙트 미연결";
      roleEl.style.color = "var(--text-muted)";
    } else if (isOwner) {
      roleEl.innerHTML = `<span style="color:var(--accent-green)">⚙️ 관리자 (오너)</span>`;
    } else {
      roleEl.innerHTML = `<span style="color:var(--accent-blue)">👤 피보험자</span>`;
    }
  }

  // 피보험자명 표시
  const nameEl = el("statusPolicyName");
  if (nameEl) {
    if (policyLabel) {
      nameEl.style.display = "flex";
      el("statusPolicyNameVal").textContent = policyLabel;
    } else {
      nameEl.style.display = "none";
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  컨트랙트 로드
// ═══════════════════════════════════════════════════════════════
async function loadContracts(usdcAddress, insAddress) {
  addLog("step", "컨트랙트 로드 시작");
  try {
    if (!provider) {
      addLog("error", "컨트랙트 로드 실패", "provider 없음 - MetaMask를 먼저 연결하세요.");
      showToast("먼저 MetaMask를 연결해주세요.", "warning");
      return;
    }
    if (!ethers.isAddress(usdcAddress)) {
      addLog("error", "USDC 주소 오류", `입력값: "${usdcAddress}"\n→ 올바른 0x 주소가 아닙니다.`);
      showToast("올바른 USDC 주소를 입력하세요.", "error");
      return;
    }
    if (!ethers.isAddress(insAddress)) {
      addLog("error", "보험 컨트랙트 주소 오류", `입력값: "${insAddress}"\n→ 올바른 0x 주소가 아닙니다.`);
      showToast("올바른 보험 컨트랙트 주소를 입력하세요.", "error");
      return;
    }

    usdcAddr = usdcAddress;
    insAddr  = insAddress;

    addLog("info", "컨트랙트 인스턴스 생성",
      `USDC : ${usdcAddr}\n보험 : ${insAddr}`);

    usdcCtx  = new ethers.Contract(usdcAddr, USDC_ABI, provider);
    insCtx   = new ethers.Contract(insAddr,  INSURANCE_ABI, provider);
    usdcSign = new ethers.Contract(usdcAddr, USDC_ABI, signer);
    insSign  = new ethers.Contract(insAddr,  INSURANCE_ABI, signer);

    // 오너 조회
    addLog("call", "owner() 조회 중...");
    const ownerAddr = await insCtx.owner();
    isOwner = ownerAddr.toLowerCase() === userAddr.toLowerCase();

    addLog("success", "컨트랙트 오너 확인",
      `오너 주소 : ${ownerAddr}\n내   주소 : ${userAddr}\n일치 여부 : ${isOwner ? "✅ 일치 → 관리자" : "❌ 불일치 → 피보험자"}`);

    el("usdcAddr").value = usdcAddr;
    el("insAddr").value  = insAddr;

    if (isOwner) {
      el("adminBadge").classList.remove("hidden");
      addLog("success", "✅ 관리자 권한 활성화됨 - 보험증권 생성·청구 심사·보험금 지급 가능");
    } else {
      el("adminBadge").classList.add("hidden");
      addLog("info", `👤 피보험자 모드 활성화\n관리자 주소: ${shortAddr(ownerAddr)}\n→ 관리자 기능 사용 시 Account #0 으로 전환 후 새로고침`);
    }

    await updateStatusPanel(ownerAddr, true);
    await renderHeaderName();   // 컨트랙트 연결 후 이름 재조회

    if (!eventListenersAttached) {
      attachEventListeners();
      eventListenersAttached = true;
      addLog("info", "📡 실시간 이벤트 리스너 활성화됨");
    }

    addLog("step", "컨트랙트 데이터 로드 중...");
    await refreshAll();
    showToast(isOwner ? "✅ 관리자로 연결됨!" : "✅ 컨트랙트 연결 완료!", "success");

  } catch (err) {
    addLog("error", "컨트랙트 로드 실패", parseError(err));
    showToast("로드 실패: " + (err.shortMessage || err.message), "error");
    await updateStatusPanel(null, false);
  }
}

async function loadContractsFromInputs() {
  addLog("step", "[컨트랙트 연결] 버튼 클릭됨");
  await loadContracts(el("usdcAddr").value.trim(), el("insAddr").value.trim());
}

// ── config.json 로드 ─────────────────────────────────────────
async function tryLoadConfig() {
  try {
    addLog("call", "config.json 로드 시도...");
    const res = await fetch("config.json?t=" + Date.now());
    if (!res.ok) {
      addLog("warning", "config.json 없음 또는 로드 실패",
        `HTTP ${res.status}: ${res.statusText}\n→ 먼저 배포를 실행하세요.`);
      return;
    }
    const cfg = await res.json();
    configCache = cfg;
    if (cfg.contracts) {
      applyConfigForCurrency();
      addLog("success", "config.json 로드 완료",
        `네트워크  : ${cfg.network} (chainId: ${cfg.chainId})\n` +
        `배포자    : ${cfg.deployer}\n` +
        `배포일    : ${cfg.deployedAt}\n` +
        `MockUSDC  : ${cfg.contracts.MockUSDC}\n` +
        `MockKRW   : ${cfg.contracts.MockKRW || "없음"}\n` +
        `Insurance(USDC) : ${cfg.contracts.DentalInsurance}\n` +
        `Insurance(KRW)  : ${cfg.contracts.DentalInsuranceKRW || "없음"}`);
    } else {
      addLog("warning", "config.json 에 contracts 항목 없음", JSON.stringify(cfg, null, 2));
    }
  } catch (err) {
    addLog("warning", "config.json 파싱 오류", parseError(err));
  }
}

// ── 통화별 컨트랙트 주소 적용 ────────────────────────────────
function applyConfigForCurrency() {
  if (!configCache?.contracts) return;
  if (currencyMode === 'KRW') {
    el("usdcAddr").value = configCache.contracts.MockKRW            || "";
    el("insAddr").value  = configCache.contracts.DentalInsuranceKRW || "";
    if (el("tokenAddrLabel")) el("tokenAddrLabel").textContent = "📄 MockKRW 컨트랙트 주소";
    if (el("insAddrLabel"))   el("insAddrLabel").textContent   = "🏥 DentalInsurance(KRW) 컨트랙트 주소";
  } else {
    el("usdcAddr").value = configCache.contracts.MockUSDC        || "";
    el("insAddr").value  = configCache.contracts.DentalInsurance || "";
    if (el("tokenAddrLabel")) el("tokenAddrLabel").textContent = "📄 MockUSDC 컨트랙트 주소";
    if (el("insAddrLabel"))   el("insAddrLabel").textContent   = "🏥 DentalInsurance 컨트랙트 주소";
  }
}

// ── 통화별 UI 레이블 갱신 ────────────────────────────────────
function updateCurrencyLabels() {
  const isKrw = currencyMode === 'KRW';
  const sym   = stableName();

  // 버튼 활성화 상태
  const btnUSDC = document.getElementById("btnCurrUSDC");
  const btnKRW  = document.getElementById("btnCurrKRW");
  if (btnUSDC) btnUSDC.classList.toggle("active", !isKrw);
  if (btnKRW)  btnKRW.classList.toggle("active",   isKrw);

  // 헤더 배지
  const badge = document.getElementById("currencyVersionBadge");
  if (badge) badge.textContent = isKrw ? '🇰🇷 원화 KRW' : '💵 USDC';

  // 파우셋 섹션
  if (el("faucetCardTitle")) el("faucetCardTitle").textContent =
    `💰 테스트 ${sym} 수령 (파우셋)`;
  if (el("faucetLabel")) el("faucetLabel").textContent = `수령 금액 (${sym})`;
  if (el("faucetBtnText")) el("faucetBtnText").textContent = `${sym} 수령하기`;
  if (el("faucetDesc")) el("faucetDesc").textContent = isKrw
    ? "이것은 테스트용 가상 원화(KRW)입니다. 최대 1회 1,000만원 수령 가능하며, 보험료 납입 및 테스트에 사용됩니다."
    : "이것은 테스트용 가상 USDC입니다. 최대 1회 10,000 USDC 수령 가능하며, 보험료 납입 및 테스트에 사용됩니다.";

  // 파우셋 빠른 금액 버튼
  const quickBtns = el("faucetQuickBtns");
  if (quickBtns) {
    if (isKrw) {
      quickBtns.innerHTML = `
        <button class="btn btn-ghost" onclick="el('faucetAmount').value='100000'">100,000원</button>
        <button class="btn btn-ghost" onclick="el('faucetAmount').value='500000'">500,000원</button>
        <button class="btn btn-ghost" onclick="el('faucetAmount').value='1000000'">100만원</button>
        <button class="btn btn-ghost" onclick="el('faucetAmount').value='5000000'">500만원</button>
        <button class="btn btn-ghost" onclick="el('faucetAmount').value='10000000'">1,000만원</button>`;
    } else {
      quickBtns.innerHTML = `
        <button class="btn btn-ghost" onclick="el('faucetAmount').value='100'">100 USDC</button>
        <button class="btn btn-ghost" onclick="el('faucetAmount').value='500'">500 USDC</button>
        <button class="btn btn-ghost" onclick="el('faucetAmount').value='1000'">1,000 USDC</button>
        <button class="btn btn-ghost" onclick="el('faucetAmount').value='5000'">5,000 USDC</button>
        <button class="btn btn-ghost" onclick="el('faucetAmount').value='10000'">10,000 USDC</button>`;
    }
  }

  // 잔액 표시
  if (el("balanceCurrencyLabel"))    el("balanceCurrencyLabel").textContent    = sym;
  if (el("balanceCurrencySubLabel")) el("balanceCurrencySubLabel").textContent = `${sym} (Mock)`;

  // 청구 금액 레이블
  if (el("claimAmountLabel")) el("claimAmountLabel").textContent =
    isKrw ? "청구 금액 (원화 KRW)" : "청구 금액 (USDC)";

  // ── 계약 심사 탭 ──────────────────────────────────────────
  if (el("appPremiumLabel"))  el("appPremiumLabel").textContent  =
    isKrw ? "월 보험료 (원화 KRW)" : "월 보험료 (USDC)";
  if (el("appCoverageLabel")) el("appCoverageLabel").textContent =
    isKrw ? "보장 한도 (원화 KRW)" : "보장 한도 (USDC)";
  if (el("appMinPremiumRule")) el("appMinPremiumRule").innerHTML  =
    isKrw
      ? `최소 월 보험료: <strong style="color:var(--text-primary)">10,000원 이상</strong>`
      : `최소 월 보험료: <strong style="color:var(--text-primary)">1 USDC 이상</strong>`;
  if (el("appApproveNote")) el("appApproveNote").textContent =
    isKrw
      ? `승인 시 보험증권이 자동 생성됩니다. 피보험자에게 KRW가 사전에 있어야 보험료 납입이 가능합니다.`
      : `승인 시 보험증권이 자동 생성됩니다. 피보험자에게 USDC가 사전에 있어야 보험료 납입이 가능합니다.`;

  // ── 약관대출 탭 ───────────────────────────────────────────
  if (el("loanAmountLabel")) el("loanAmountLabel").textContent =
    isKrw ? "대출 금액 (원화 KRW)" : "대출 금액 (USDC)";
  if (el("loanRepayNote")) el("loanRepayNote").innerHTML =
    isKrw
      ? `상환 전 KRW 잔액을 확인하세요. 원금 + 이자를 한 번에 상환합니다.<br>상환 시 KRW approve → repay 순으로 처리됩니다.`
      : `상환 전 USDC 잔액을 확인하세요. 원금 + 이자를 한 번에 상환합니다.<br>상환 시 USDC approve → repay 순으로 처리됩니다.`;
  if (el("loanExampleBox")) el("loanExampleBox").innerHTML = isKrw
    ? `납입 보험료 100,000원, 환급율 70% 기준:<br>
       해지환급금 = 100,000 × 70% = <strong style="color:var(--accent-green)">70,000원</strong><br>
       최대 대출액 = 70,000 × 80% = <strong style="color:var(--accent-blue)">56,000원</strong>`
    : `납입 보험료 100 USDC, 환급율 70% 기준:<br>
       해지환급금 = 100 × 70% = <strong style="color:var(--accent-green)">70 USDC</strong><br>
       최대 대출액 = 70 × 80% = <strong style="color:var(--accent-blue)">56 USDC</strong>`;
}

// ── 통화 전환 ────────────────────────────────────────────────
function clearLoanDisplay() {
  ["loanTotalPaid","loanSurrenderVal","loanMaxAmount","loanActiveStatus",
   "loanPrincipal","loanInterest","loanRepayTotal","loanBorrowedAt"].forEach(id => {
    if (el(id)) el(id).textContent = "-";
  });
  if (el("loanInfoBox"))   el("loanInfoBox").style.display   = "none";
  if (el("loanRequestBox"))el("loanRequestBox").style.display= "block";
  if (el("loanRepayBox"))  el("loanRepayBox").style.display  = "none";
  if (el("loanCurBox"))    el("loanCurBox").style.display    = "none";
  _loanMaxAmount = 0n;
}

async function switchCurrency(mode) {
  if (currencyMode === mode) return;
  currencyMode = mode;

  // UI 레이블 갱신
  updateCurrencyLabels();
  // 이전 통화의 대출 표시 초기화
  clearLoanDisplay();
  addLog("step", `통화 전환: ${mode}`);

  // 컨트랙트 주소 교체
  applyConfigForCurrency();

  // 컨트랙트 재연결
  const newUsdcAddr = el("usdcAddr").value.trim();
  const newInsAddr  = el("insAddr").value.trim();
  if (newUsdcAddr && newInsAddr) {
    eventListenersAttached = false; // 이벤트 리스너 재등록 허용
    await loadContracts(newUsdcAddr, newInsAddr);
  } else {
    addLog("warning", "통화 전환", `${mode} 컨트랙트 주소 없음 — 배포 후 재시도하세요.`);
    showToast(`${mode} 컨트랙트 주소가 없습니다. 배포 후 재시도하세요.`, "warning");
  }
}

// ═══════════════════════════════════════════════════════════════
//  이벤트 리스너
// ═══════════════════════════════════════════════════════════════
function attachEventListeners() {
  insCtx.on("PolicyCreated", (policyId, patient, name, premium, limit, ts, event) => {
    addLog("event", `📋 보험증권 생성 이벤트: #${policyId} - ${name}`,
      `피보험자 : ${patient}\n월보험료 : ${fmtUsdc(premium)}\n보장한도 : ${fmtUsdc(limit)}\n블록     : ${event.log.blockNumber}`,
      event.log.transactionHash);
    refreshAll();
  });
  insCtx.on("PremiumPaid", (policyId, patient, amount, totalPaid, ts, event) => {
    addLog("event", `💳 보험료 납입 이벤트: 증권 #${policyId}`,
      `납입자   : ${patient}\n납입금액 : ${fmtUsdc(amount)}\n누적납입 : ${fmtUsdc(totalPaid)}`,
      event.log.transactionHash);
    refreshAll();
  });
  insCtx.on("ClaimSubmitted", (claimId, policyId, patient, amount, code, ts, event) => {
    addLog("event", `🦷 보험금 청구 이벤트: #${claimId} (증권 #${policyId})`,
      `청구자   : ${patient}\n청구금액 : ${fmtUsdc(amount)}\n치료코드 : ${code}`,
      event.log.transactionHash);
    refreshAll();
  });
  insCtx.on("ClaimApproved", (claimId, policyId, amount, ts, event) => {
    addLog("event", `✅ 청구 승인 이벤트: 청구 #${claimId}`,
      `증권 ID  : #${policyId}\n승인금액 : ${fmtUsdc(amount)}`,
      event.log.transactionHash);
    refreshAll();
  });
  insCtx.on("ClaimRejected", (claimId, policyId, reason, ts, event) => {
    addLog("event", `❌ 청구 거절 이벤트: 청구 #${claimId}`,
      `증권 ID  : #${policyId}\n거절사유 : ${reason}`,
      event.log.transactionHash);
    refreshAll();
  });
  insCtx.on("ClaimPaid", (claimId, policyId, patient, amount, ts, event) => {
    addLog("event", `💰 보험금 지급 이벤트: 청구 #${claimId}`,
      `수령자   : ${patient}\n지급금액 : ${fmtUsdc(amount)}`,
      event.log.transactionHash);
    refreshAll();
  });
  insCtx.on("FundsDeposited", (depositor, amount, ts, event) => {
    addLog("event", `🏦 준비금 입금 이벤트: ${fmtUsdc(amount)} USDC`,
      `입금자: ${depositor}`,
      event.log.transactionHash);
    refreshAll();
  });
  insCtx.on("MaturityRefundPaid", (policyId, patient, refundAmount, ts, event) => {
    addLog("event", `💎 만기환급금 지급 이벤트: 증권 #${policyId}`,
      `수령자   : ${patient}\n환급금액 : ${fmtUsdc(refundAmount)}`,
      event.log.transactionHash);
    showToast(`💎 증권 #${policyId} 만기환급금 ${fmtUsdc(refundAmount)} 지급 완료!`, "success");
    refreshAll();
    refreshMaturity();
  });
  insCtx.on("PremiumAutoCollected", (policyId, patient, amount, totalPaid, ts, event) => {
    addLog("event", `🔄 자동납부 수납 이벤트: 증권 #${policyId}`,
      `피보험자 : ${patient}\n수납금액 : ${fmtUsdc(amount)}\n누적납입 : ${fmtUsdc(totalPaid)}`,
      event.log.transactionHash);
    showToast(`🔄 증권 #${policyId} 자동납부 ${fmtUsdc(amount)} 수납 완료!`, "success");
    refreshAll();
    refreshAutopaySchedule();
  });
  insCtx.on("ClaimOracleVerified", (claimId, approved, dataHash, hospitalName, ts, event) => {
    addLog("event", `🏥 오라클 검증 이벤트: 청구 #${claimId}`,
      `결과     : ${approved ? "✅ 승인 → 자동 지급" : "❌ 거절"}\n병원명   : ${hospitalName}\n데이터해시: ${dataHash}`,
      event.log.transactionHash);
    showToast(
      approved
        ? `🏥 청구 #${claimId} 오라클 승인 — 보험금 자동 지급!`
        : `🏥 청구 #${claimId} 오라클 거절 (${hospitalName || "사유 확인 필요"})`,
      approved ? "success" : "error"
    );
    refreshAll();
  });
}

// ═══════════════════════════════════════════════════════════════
//  데이터 새로고침
// ═══════════════════════════════════════════════════════════════
async function refreshAll() {
  if (!insCtx) return;
  try {
    await Promise.all([
      refreshStats(),
      refreshPolicies(),
      refreshClaims(),
      refreshOracleStatus(),
      refreshBlockchainState(),
      refreshMyBalance(),
      refreshMaturity(),
      refreshApplications(),
      refreshLoanPolicies()
    ]);
  } catch (err) {
    addLog("error", "데이터 새로고침 실패", parseError(err));
  }
}

async function refreshStats() {
  if (!insCtx) return;
  try {
    // ── 기본 통계 (getStats) ─────────────────────────────────
    const stats = await insCtx.getStats();
    el("statPremiums").textContent  = fmtUsdc(stats.premiumsCollected);
    el("statClaims").textContent    = fmtUsdc(stats.claimsPaid);
    el("statBalance").textContent   = fmtUsdc(stats.contractBalance);
    el("statClaimsNum").textContent = stats.claimsCount.toString();

    // ── 보험증권: 전체 vs 활성 ────────────────────────────────
    const policyIds = await insCtx.getAllPolicyIds().catch(() => []);
    const policies  = await Promise.all(policyIds.map(id => insCtx.getPolicy(id).catch(() => null)));
    const validPolicies = policies.filter(Boolean);
    const activeCount   = validPolicies.filter(p => p.active).length;
    el("statPolicies").textContent      = activeCount.toString();
    el("statPoliciesTotal").textContent = `전체 ${policyIds.length}건`;

    // ── 청구: 대기중 건수 ─────────────────────────────────────
    const claimIds     = await insCtx.getAllClaimIds().catch(() => []);
    const claims       = await Promise.all(claimIds.map(id => insCtx.getClaim(id).catch(() => null)));
    const pendingClaims = claims.filter(c => c && Number(c.status) === 0).length;
    el("statClaimsPending").textContent = `대기 ${pendingClaims}건`;

    // ── 청약 심사 현황 ────────────────────────────────────────
    const appIds   = await insCtx.getAllApplicationIds().catch(() => []);
    const apps     = await Promise.all(appIds.map(id => insCtx.getApplication(id).catch(() => null)));
    const validApps = apps.filter(Boolean);
    const appPending  = validApps.filter(a => Number(a.status) === 0).length;
    const appApproved = validApps.filter(a => Number(a.status) === 1).length;
    const appRejected = validApps.filter(a => Number(a.status) === 2).length;
    el("statAppPending").textContent  = appPending.toString();
    el("statAppApproved").textContent = appApproved.toString();
    el("statAppRejected").textContent = appRejected.toString();

    // ── 약관대출 현황 ─────────────────────────────────────────
    const loans = await Promise.all(
      policyIds.map(id => insCtx.getPolicyLoan(id).catch(() => null))
    );
    const activeLoans = loans.filter(l => l && l.active);
    const totalLoanAmt = activeLoans.reduce((sum, l) => sum + BigInt(l.loanAmount), 0n);
    el("statLoanCount").textContent  = activeLoans.length.toString();
    el("statLoanAmount").textContent = activeLoans.length > 0
      ? `총 ${fmtUsdc(totalLoanAmt)}` : "없음";

    // ── 만기환급 현황 ─────────────────────────────────────────
    const matured = validPolicies.filter(p => p.maturityPaid);
    const totalMatAmt = matured.reduce((sum, p) => {
      return sum + (BigInt(p.totalPaid) * BigInt(p.maturityRefundRate)) / 100n;
    }, 0n);
    el("statMaturityCount").textContent  = matured.length.toString();
    el("statMaturityAmount").textContent = matured.length > 0
      ? `총 ${fmtUsdc(totalMatAmt)}` : "없음";

  } catch (err) {
    addLog("error", "통계 조회 실패", parseError(err));
  }
}

async function refreshMyBalance() {
  if (!usdcCtx || !userAddr) return;
  try {
    const bal = await usdcCtx.balanceOf(userAddr);
    el("myUsdcBal").textContent     = fmtUsdc(bal);
    el("statMyBalance").textContent = fmtUsdc(bal);
  } catch (err) {
    addLog("error", "잔액 조회 실패", parseError(err));
  }
}

// ═══════════════════════════════════════════════════════════════
//  공통 트랜잭션 전송 (모든 단계 로깅)
// ═══════════════════════════════════════════════════════════════
async function sendTx(txFn, label, onSuccess) {
  addLog("step", `[TX 시작] ${label}`);
  let tx = null;
  try {
    addLog("info", "MetaMask 서명 요청 중...", "MetaMask 팝업에서 확인을 클릭하세요.");
    tx = await txFn();

    addLog("info", `[TX 제출됨] 컨펌 대기 중...`,
      `TxHash: ${tx.hash}\nNonce : ${tx.nonce}\nGas   : ${tx.gasLimit?.toString() || "-"}\nTo    : ${tx.to}`,
      tx.hash);

    const receipt = await tx.wait();

    if (receipt.status === 0) {
      addLog("error", `[TX 실패] ${label}`,
        `블록    : ${receipt.blockNumber}\nGasUsed : ${receipt.gasUsed}\nStatus  : 0 (실패)\n→ Solidity 조건 위반 가능성 확인`,
        tx.hash);
      showToast("트랜잭션 실패 (revert)", "error");
      return;
    }

    addLog("success", `[TX 완료] ${label}`,
      `블록     : ${receipt.blockNumber}\nGasUsed  : ${receipt.gasUsed.toString()}\nStatus   : 1 (성공)\nTxHash   : ${tx.hash}`,
      tx.hash);
    showToast(`완료: ${label}`, "success");

    if (onSuccess) await onSuccess();

  } catch (err) {
    const detail = parseError(err);
    addLog("error", `[TX 실패] ${label}`, detail + (tx ? `\n\nTxHash: ${tx.hash}` : ""));
    showToast("실패: " + (err.shortMessage || err.reason || err.message || "오류").slice(0, 80), "error");
  }
}

// ═══════════════════════════════════════════════════════════════
//  USDC 파우셋
// ═══════════════════════════════════════════════════════════════
async function useFaucet() {
  const tokenName = stableName();
  addLog("step", `[파우셋] ${tokenName} 수령 시작`);
  if (!usdcSign) {
    addLog("error", "파우셋 실패", "컨트랙트를 먼저 연결하세요.");
    showToast("컨트랙트를 먼저 연결하세요.", "warning");
    return;
  }
  const rawVal = el("faucetAmount").value;
  const amount = parseUsdc(rawVal);
  // 통화별 최대 파우셋 한도
  const MAX = currencyMode === 'KRW'
    ? ethers.parseUnits("10000000", 0)   // 최대 1천만원
    : ethers.parseUnits("10000",    6);  // 최대 $10,000

  addLog("info", "파우셋 입력값 확인",
    `입력: ${rawVal} ${tokenName} | 변환: ${amount.toString()} | 최대: ${fmtUsdc(MAX)}`);

  if (amount <= 0n) {
    addLog("error", "파우셋 입력 오류", `금액 0 이하: ${rawVal}`);
    showToast("금액을 입력하세요.", "warning");
    return;
  }
  if (amount > MAX) {
    addLog("error", "파우셋 한도 초과", `요청: ${fmtUsdc(amount)} > 최대: ${fmtUsdc(MAX)}`);
    showToast(`최대 ${fmtUsdc(MAX)}까지 수령 가능합니다.`, "warning");
    return;
  }

  // 잔액 사전 확인
  const balBefore = await usdcCtx.balanceOf(userAddr).catch(() => 0n);
  addLog("info", "파우셋 전 잔액", fmtUsdc(balBefore));

  await sendTx(
    async () => usdcSign.faucet(amount),
    `${tokenName} 파우셋: ${fmtUsdc(amount)}`,
    async () => {
      await refreshMyBalance();
      const balAfter = await usdcCtx.balanceOf(userAddr).catch(() => 0n);
      addLog("success", "파우셋 완료",
        `수령 전: ${fmtUsdc(balBefore)}\n수령 후: ${fmtUsdc(balAfter)}\n수령량: ${fmtUsdc(amount)}`);
      showToast(`${fmtUsdc(amount)} ${tokenName} 수령 완료!`, "success");
    }
  );
}

// ═══════════════════════════════════════════════════════════════
//  보험증권
// ═══════════════════════════════════════════════════════════════
async function createPolicy() {
  addLog("step", "[보험증권 생성] 시작");
  if (!insSign) {
    addLog("error", "증권 생성 실패", "insSign 없음 - 컨트랙트 연결 필요");
    showToast("컨트랙트를 먼저 연결하세요.", "warning"); return;
  }
  if (!isOwner) {
    addLog("error", "증권 생성 권한 없음",
      `내 주소: ${userAddr}\n→ 관리자(Account #0)만 생성 가능`);
    showToast("관리자만 보험증권을 생성할 수 있습니다.", "error"); return;
  }

  const patient  = el("policyPatient").value.trim();
  const name     = el("policyName").value.trim();
  const premiumRaw  = el("policyPremium").value;
  const coverageRaw = el("policyCoverage").value;
  const premium  = parseUsdc(premiumRaw);
  const coverage = parseUsdc(coverageRaw);

  addLog("info", "증권 생성 입력값",
    `피보험자 주소 : ${patient}\n피보험자 이름 : ${name}\n월 보험료     : ${premiumRaw} → ${fmtUsdc(premium)}\n보장 한도     : ${coverageRaw} → ${fmtUsdc(coverage)}`);

  if (!ethers.isAddress(patient)) {
    addLog("error", "입력 오류: 피보험자 주소", `"${patient}" 은(는) 유효한 주소가 아닙니다.`);
    showToast("올바른 피보험자 주소를 입력하세요.", "error"); return;
  }
  if (!name) {
    addLog("error", "입력 오류: 피보험자 이름", "이름이 비어있습니다.");
    showToast("피보험자 이름을 입력하세요.", "warning"); return;
  }
  if (premium <= 0n) {
    addLog("error", "입력 오류: 월 보험료", `입력값: "${premiumRaw}" → 0 이하`);
    showToast("월 보험료를 입력하세요.", "warning"); return;
  }
  if (coverage <= 0n) {
    addLog("error", "입력 오류: 보장 한도", `입력값: "${coverageRaw}" → 0 이하`);
    showToast("보장 한도를 입력하세요.", "warning"); return;
  }

  const maturityDaysRaw  = el("policyMaturityDays")?.value || "365";
  const maturityRateRaw  = el("policyMaturityRate")?.value || "70";
  const maturityDays     = parseInt(maturityDaysRaw) || 365;
  const maturityRate     = parseInt(maturityRateRaw) || 70;
  const maturityDate     = Math.floor(Date.now() / 1000) + maturityDays * 86400;

  addLog("info", "만기 설정",
    `만기일  : ${new Date(maturityDate * 1000).toLocaleDateString("ko-KR")} (${maturityDays}일 후)\n환급율  : ${maturityRate}%`);

  await sendTx(
    async () => insSign.createPolicy(patient, name, premium, coverage, maturityDate, maturityRate),
    `보험증권 생성: ${name}`,
    async () => {
      el("policyName").value = "";
      el("policyPatient").value = "";
      el("policyPremium").value = "";
      el("policyCoverage").value = "";
      await refreshPolicies();
    }
  );
}

async function refreshPolicies() {
  if (!insCtx) return;
  try {
    const ids = await insCtx.getAllPolicyIds();
    addLog("call", `보험증권 목록 조회: ${ids.length}건`);
    const tbody = el("policyTableBody");
    if (!tbody) return;
    if (ids.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="color:var(--text-muted);padding:30px">보험증권이 없습니다</td></tr>`;
      return;
    }
    const policies = await Promise.all(ids.map(id => insCtx.getPolicy(id)));
    tbody.innerHTML = policies.map(p => `
      <tr>
        <td><strong>#${p.id}</strong></td>
        <td>${p.patientName}</td>
        <td class="addr-short" onclick="copyToClip('${p.patient}')" title="${p.patient}">${shortAddr(p.patient)}</td>
        <td class="text-right" style="color:var(--accent-blue)">${fmtUsdc(p.monthlyPremium)}</td>
        <td class="text-right" style="color:var(--accent-cyan)">${fmtUsdc(p.coverageLimit)}</td>
        <td class="text-right" style="color:var(--accent-green)">${fmtUsdc(p.totalPaid)}</td>
        <td>${tsToDate(p.lastPaymentTime)}</td>
        <td>
          <span class="badge ${p.active ? "badge-active" : "badge-inactive"}">${p.active ? "활성" : "비활성"}</span>
          ${isOwner && p.active ? `<button class="btn btn-danger btn-sm" onclick="deactivatePolicy(${p.id})" style="margin-left:6px">비활성화</button>` : ""}
        </td>
      </tr>`).join("");
    updatePolicySelect(policies.filter(p => p.active));
  } catch (err) {
    addLog("error", "보험증권 목록 조회 실패", parseError(err));
  }
}

function updatePolicySelect(policies) {
  ["premiumPolicyId", "claimPolicyId", "autopayPolicyId", "loanPolicyId"].forEach(selId => {
    const sel = el(selId);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = `<option value="">-- 증권 선택 --</option>` +
      policies.map(p =>
        `<option value="${p.id}" ${String(p.id) === cur ? "selected" : ""}>#${p.id} - ${p.patientName} (월 ${fmtUsdc(p.monthlyPremium)})</option>`
      ).join("");
  });
}

async function deactivatePolicy(policyId) {
  addLog("step", `[증권 비활성화] #${policyId}`);
  if (!confirm(`증권 #${policyId}를 비활성화하시겠습니까?`)) {
    addLog("info", `증권 #${policyId} 비활성화 취소됨`); return;
  }
  await sendTx(
    async () => insSign.deactivatePolicy(policyId),
    `증권 #${policyId} 비활성화`,
    async () => refreshPolicies()
  );
}

// ═══════════════════════════════════════════════════════════════
//  보험료 납입 (approve + payPremium 각 단계 로깅)
// ═══════════════════════════════════════════════════════════════
async function payPremium() {
  addLog("step", "[보험료 납입] 시작");
  if (!insSign) {
    addLog("error", "납입 실패", "insSign 없음 - 컨트랙트 연결 필요");
    showToast("컨트랙트를 먼저 연결하세요.", "warning"); return;
  }
  const policyId = el("premiumPolicyId").value;
  if (!policyId) {
    addLog("error", "납입 실패", "증권이 선택되지 않았습니다.");
    showToast("증권을 선택하세요.", "warning"); return;
  }
  addLog("info", `납입 대상 증권: #${policyId}`);

  // 증권 정보 조회
  let policy;
  try {
    addLog("call", `getPolicy(${policyId}) 조회 중...`);
    policy = await insCtx.getPolicy(policyId);
    addLog("info", "증권 정보 확인",
      `피보험자 : ${policy.patientName}\n월보험료 : ${fmtUsdc(policy.monthlyPremium)}\n활성여부 : ${policy.active ? "✅ 활성" : "❌ 비활성"}\n피보험자 주소: ${policy.patient}`);
  } catch (err) {
    addLog("error", `getPolicy(${policyId}) 실패`, parseError(err));
    showToast("증권 조회 실패", "error"); return;
  }

  if (policy.patient.toLowerCase() !== userAddr.toLowerCase()) {
    addLog("error", "납입 권한 없음",
      `증권 피보험자 : ${policy.patient}\n내 주소       : ${userAddr}\n→ 본인 증권만 납입 가능합니다.`);
    showToast("본인 증권만 납입 가능합니다.", "error"); return;
  }

  const amount = policy.monthlyPremium;

  // 잔액 확인
  try {
    const bal = await usdcCtx.balanceOf(userAddr);
    addLog("info", "USDC 잔액 확인",
      `보유 잔액 : ${fmtUsdc(bal)}\n필요 금액 : ${fmtUsdc(amount)}\n충분 여부 : ${bal >= amount ? "✅ 충분" : "❌ 부족"}`);
    if (bal < amount) {
      addLog("error", "USDC 잔액 부족",
        `보유: ${fmtUsdc(bal)}\n필요: ${fmtUsdc(amount)}\n→ 파우셋 탭에서 먼저 ${stableName()}를 수령하세요.`);
      showToast(`${stableName()} 잔액이 부족합니다. 파우셋에서 먼저 수령하세요.`, "error"); return;
    }
  } catch (err) {
    addLog("error", "잔액 조회 실패", parseError(err));
  }

  // Allowance 확인
  try {
    addLog("call", `allowance(${shortAddr(userAddr)}, ${shortAddr(insAddr)}) 조회 중...`);
    const allowance = await usdcCtx.allowance(userAddr, insAddr);
    addLog("info", "USDC Allowance 확인",
      `현재 allowance : ${fmtUsdc(allowance)}\n필요 금액      : ${fmtUsdc(amount)}\n추가 승인 필요 : ${allowance < amount ? "✅ 예" : "❌ 아니오 (이미 충분)"}`);

    if (allowance < amount) {
      addLog("step", "[단계 1/2] USDC approve 실행 중...");
      let approveTx;
      try {
        approveTx = await usdcSign.approve(insAddr, amount);
        addLog("info", "approve 트랜잭션 제출됨",
          `금액  : ${fmtUsdc(amount)}\nSpender: ${insAddr}`,
          approveTx.hash);
        const approveReceipt = await approveTx.wait();
        addLog("success", "USDC approve 완료",
          `블록: ${approveReceipt.blockNumber} | GasUsed: ${approveReceipt.gasUsed}`,
          approveTx.hash);
      } catch (err) {
        addLog("error", "USDC approve 실패", parseError(err));
        showToast("USDC 승인 실패: " + (err.shortMessage || err.message), "error"); return;
      }
    } else {
      addLog("info", "approve 생략 (기존 allowance 충분)");
    }
  } catch (err) {
    addLog("error", "Allowance 조회 실패", parseError(err));
  }

  addLog("step", "[단계 2/2] payPremium 실행 중...");
  await sendTx(
    async () => insSign.payPremium(policyId),
    `보험료 납입: 증권 #${policyId} (${fmtUsdc(amount)})`,
    async () => {
      await Promise.all([refreshMyBalance(), refreshPolicies(), refreshStats()]);
      showToast(`보험료 ${fmtUsdc(amount)} ${stableName()} 납입 완료!`, "success");
    }
  );
}

// ═══════════════════════════════════════════════════════════════
//  보험금 청구
// ═══════════════════════════════════════════════════════════════
async function submitClaim() {
  addLog("step", "[보험금 청구] 시작");
  if (!insSign) {
    addLog("error", "청구 실패", "insSign 없음 - 컨트랙트 연결 필요");
    showToast("컨트랙트를 먼저 연결하세요.", "warning"); return;
  }

  const policyId = el("claimPolicyId").value;
  const amountRaw = el("claimAmount").value;
  const amount   = parseUsdc(amountRaw);
  const code     = el("claimCode").value.trim();
  const desc     = el("claimDesc").value.trim();

  addLog("info", "청구 입력값 확인",
    `증권 ID  : ${policyId || "(미선택)"}\n청구금액 : ${amountRaw} → ${fmtUsdc(amount)}\n치료코드 : ${code || "(미선택)"}\n설명     : ${desc || "(없음)"}`);

  if (!policyId) {
    addLog("error", "청구 입력 오류", "증권이 선택되지 않았습니다."); showToast("증권을 선택하세요.", "warning"); return;
  }
  if (amount <= 0n) {
    addLog("error", "청구 입력 오류", `금액 0 이하: "${amountRaw}"`); showToast("청구 금액을 입력하세요.", "warning"); return;
  }
  if (!code) {
    addLog("error", "청구 입력 오류", "치료 코드가 선택되지 않았습니다."); showToast("치료 코드를 선택하세요.", "warning"); return;
  }

  // 증권 정보 확인
  try {
    addLog("call", `getPolicy(${policyId}) 조회 중...`);
    const policy = await insCtx.getPolicy(policyId);
    addLog("info", "청구 전 증권 상태 확인",
      `피보험자  : ${policy.patientName}\n누적납입  : ${fmtUsdc(policy.totalPaid)}\n보장한도  : ${fmtUsdc(policy.coverageLimit)}\n청구금액  : ${fmtUsdc(amount)}\n한도초과  : ${amount > policy.coverageLimit ? "❌ 초과 (거절됨)" : "✅ 범위내"}\n납입여부  : ${policy.totalPaid > 0n ? "✅ 납입 이력 있음" : "❌ 납입 이력 없음 (청구 불가)"}`);

    if (policy.totalPaid === 0n) {
      addLog("error", "청구 불가: 납입 이력 없음",
        "보험료 납입 탭에서 먼저 보험료를 납입해야 청구 가능합니다.");
      showToast("먼저 보험료를 납입하세요.", "error"); return;
    }
    if (amount > policy.coverageLimit) {
      addLog("error", "청구 불가: 보장 한도 초과",
        `청구금액 ${fmtUsdc(amount)} > 보장한도 ${fmtUsdc(policy.coverageLimit)}`);
      showToast("보장 한도를 초과하는 금액입니다.", "error"); return;
    }
  } catch (err) {
    addLog("error", "증권 사전 확인 실패", parseError(err));
  }

  await sendTx(
    async () => insSign.submitClaim(policyId, amount, code, desc || ""),
    `보험금 청구: 증권 #${policyId} - ${fmtUsdc(amount)} (${code})`,
    async () => {
      el("claimAmount").value = "";
      el("claimDesc").value   = "";
      await refreshClaims();
      showToast("보험금 청구가 접수되었습니다.", "success");
    }
  );
}

async function refreshClaims() {
  if (!insCtx) return;
  try {
    const ids = await insCtx.getAllClaimIds();
    addLog("call", `청구 목록 조회: ${ids.length}건`);
    const tbody = el("claimTableBody");
    if (!tbody) return;
    if (ids.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="color:var(--text-muted);padding:30px">청구 내역이 없습니다</td></tr>`;
      return;
    }
    const [claims, oracleVerifs] = await Promise.all([
      Promise.all(ids.map(id => insCtx.getClaim(id))),
      Promise.all(ids.map(id => insCtx.getOracleVerification(id).catch(() => null)))
    ]);
    tbody.innerHTML = claims.map((c, i) => {
      const statusIdx = Number(c.status);
      const isMine    = c.patient.toLowerCase() === userAddr?.toLowerCase();
      const ov        = oracleVerifs[i];
      const isOracle  = ov && ov.exists;
      const oracleBadge = isOracle
        ? `<span style="font-size:10px;background:${ov.approved ? "rgba(35,134,54,0.15)" : "rgba(218,54,51,0.15)"};color:${ov.approved ? "var(--accent-green)" : "var(--accent-red)"};padding:1px 5px;border-radius:3px;margin-left:4px" title="오라클 검증: ${ov.verificationCode}&#10;병원: ${ov.hospitalName}">🏥 ${ov.approved ? "오라클승인" : "오라클거절"}</span>`
        : "";
      return `
      <tr ${isMine ? 'style="background:rgba(47,129,247,0.04)"' : ""}>
        <td><strong>#${c.id}</strong></td>
        <td>#${c.policyId}</td>
        <td class="addr-short" title="${c.patient}">${shortAddr(c.patient)} ${isMine ? '<span style="color:var(--accent-blue);font-size:10px">(나)</span>' : ""}</td>
        <td class="text-right" style="color:var(--accent-yellow)">${fmtUsdc(c.amount)}</td>
        <td><code style="font-size:11px">${c.treatmentCode}</code></td>
        <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${c.description}">${c.description || "-"}</td>
        <td><span class="badge ${CLAIM_STATUS_CLASS[statusIdx]}">${CLAIM_STATUS[statusIdx]}</span>${oracleBadge}</td>
        <td style="font-size:11px;color:var(--text-muted)">${tsToDate(c.submittedAt)}</td>
        <td>
          ${isOwner && statusIdx === 0 ? `
            <button class="btn btn-success btn-sm" onclick="approveClaim(${c.id})">승인</button>
            <button class="btn btn-danger btn-sm" onclick="rejectClaimPrompt(${c.id})" style="margin-left:4px">거절</button>` : ""}
          ${isOwner && statusIdx === 1 ? `
            <button class="btn btn-primary btn-sm" onclick="payClaim(${c.id})">💰 지급</button>` : ""}
          ${statusIdx === 2 && c.rejectReason ? `<span style="font-size:11px;color:var(--accent-red)" title="${c.rejectReason}">사유있음</span>` : ""}
          ${isOracle ? `<button class="btn btn-sm" style="font-size:10px;background:rgba(130,80,255,0.15);color:#a78bfa;margin-left:2px" onclick="showOracleDetail(${c.id})">상세</button>` : ""}
        </td>
      </tr>`;
    }).join("");
  } catch (err) {
    addLog("error", "청구 목록 조회 실패", parseError(err));
  }
}

// ═══════════════════════════════════════════════════════════════
//  관리자 기능
// ═══════════════════════════════════════════════════════════════
async function approveClaim(claimId) {
  addLog("step", `[청구 승인] 청구 #${claimId}`);
  if (!confirm(`청구 #${claimId}를 승인하시겠습니까?`)) {
    addLog("info", `청구 #${claimId} 승인 취소됨`); return;
  }

  // 청구 정보 사전 확인
  try {
    const claim = await insCtx.getClaim(claimId);
    addLog("info", `청구 #${claimId} 정보 확인`,
      `청구자   : ${claim.patient}\n청구금액 : ${fmtUsdc(claim.amount)}\n치료코드 : ${claim.treatmentCode}\n현재상태 : ${CLAIM_STATUS[Number(claim.status)]}`);
    if (Number(claim.status) !== 0) {
      addLog("error", "승인 불가",
        `청구 #${claimId} 현재 상태: "${CLAIM_STATUS[Number(claim.status)]}"\n→ 대기중(Pending) 상태만 승인 가능합니다.`);
      showToast("대기중 상태의 청구만 승인 가능합니다.", "error"); return;
    }
    // 컨트랙트 잔액 사전 확인
    const contractBal = await insCtx.getContractBalance();
    addLog("info", "컨트랙트 잔액 확인",
      `컨트랙트 잔액 : ${fmtUsdc(contractBal)}\n청구 금액      : ${fmtUsdc(claim.amount)}\n지급 가능 여부 : ${contractBal >= claim.amount ? "✅ 가능" : "⚠️ 잔액 부족 (지급 단계에서 실패 가능)"}`);
  } catch (err) {
    addLog("error", "청구 사전 확인 실패", parseError(err));
  }

  await sendTx(
    async () => insSign.approveClaim(claimId),
    `청구 #${claimId} 승인`,
    async () => refreshAll()
  );
}

async function rejectClaimPrompt(claimId) {
  addLog("step", `[청구 거절] 청구 #${claimId}`);
  const reason = prompt(`청구 #${claimId} 거절 사유를 입력하세요:`);
  if (!reason) {
    addLog("info", `청구 #${claimId} 거절 취소됨`); return;
  }
  addLog("info", `거절 사유 입력됨: "${reason}"`);
  await sendTx(
    async () => insSign.rejectClaim(claimId, reason),
    `청구 #${claimId} 거절 (사유: ${reason})`,
    async () => refreshClaims()
  );
}

async function payClaim(claimId) {
  addLog("step", `[보험금 지급] 청구 #${claimId}`);
  if (!confirm(`청구 #${claimId}에 대한 보험금을 지급하시겠습니까?`)) {
    addLog("info", `청구 #${claimId} 지급 취소됨`); return;
  }

  // 사전 확인
  try {
    const claim       = await insCtx.getClaim(claimId);
    const contractBal = await insCtx.getContractBalance();
    addLog("info", `지급 전 확인 (청구 #${claimId})`,
      `수령자        : ${claim.patient}\n청구금액      : ${fmtUsdc(claim.amount)}\n컨트랙트잔액  : ${fmtUsdc(contractBal)}\n지급가능여부  : ${contractBal >= claim.amount ? "✅ 가능" : "❌ 잔액 부족 → TX 실패 예상"}\n현재상태      : ${CLAIM_STATUS[Number(claim.status)]}`);
    if (Number(claim.status) !== 1) {
      addLog("error", "지급 불가",
        `청구 #${claimId} 현재 상태: "${CLAIM_STATUS[Number(claim.status)]}"\n→ 승인됨(Approved) 상태만 지급 가능합니다.`);
      showToast("승인된 청구만 지급 가능합니다.", "error"); return;
    }
    if (contractBal < claim.amount) {
      addLog("error", "컨트랙트 잔액 부족",
        `필요: ${fmtUsdc(claim.amount)}\n보유: ${fmtUsdc(contractBal)}\n→ 관리자 패널 > 준비금 입금에서 먼저 입금하세요.`);
      showToast("컨트랙트 잔액이 부족합니다. 준비금을 먼저 입금하세요.", "error"); return;
    }
  } catch (err) {
    addLog("error", "지급 사전 확인 실패", parseError(err));
  }

  await sendTx(
    async () => insSign.payClaim(claimId),
    `청구 #${claimId} 보험금 지급`,
    async () => { await Promise.all([refreshClaims(), refreshStats()]); }
  );
}

// ── Oracle 상세 팝업 ────────────────────────────────────────────
async function showOracleDetail(claimId) {
  try {
    const [claim, ov] = await Promise.all([
      insCtx.getClaim(claimId),
      insCtx.getOracleVerification(claimId)
    ]);
    const lines = [
      `청구 #${claimId} 오라클 검증 결과`,
      `─────────────────────────────`,
      `결과       : ${ov.approved ? "✅ 승인 (자동 지급)" : "❌ 거절"}`,
      `병원명     : ${ov.hospitalName || "-"}`,
      `검증 코드  : ${ov.verificationCode}`,
      `검증 시각  : ${tsToDate(ov.verifiedAt)}`,
      `데이터 해시: ${ov.dataHash}`,
      `─────────────────────────────`,
      `치료 코드  : ${claim.treatmentCode}`,
      `청구 금액  : ${fmtUsdc(claim.amount)}`,
      `청구 상태  : ${CLAIM_STATUS[Number(claim.status)]}`,
    ];
    if (!ov.approved) lines.push(`거절 사유  : ${claim.rejectReason}`);
    alert(lines.join("\n"));
  } catch(e) {
    addLog("error", "오라클 상세 조회 실패", parseError(e));
  }
}

// ── Oracle 모드 관리 (관리자) ──────────────────────────────────
async function setOracleMode(enabled) {
  addLog("step", `[Oracle] 오라클 모드 ${enabled ? "활성화" : "비활성화"} 중...`);
  await sendTx(
    async () => insSign.setOracleMode(enabled),
    `오라클 모드 ${enabled ? "활성화" : "비활성화"}`,
    async () => refreshOracleStatus()
  );
}

async function refreshOracleStatus() {
  if (!insCtx) return;
  try {
    const [enabled, addr] = await Promise.all([
      insCtx.oracleModeEnabled(),
      insCtx.oracleAddress()
    ]);
    const badge = el("oracleModeBadge");
    const addrEl = el("oracleAddrDisplay");
    if (badge) {
      badge.textContent = enabled ? "활성화" : "비활성화";
      badge.style.background = enabled ? "rgba(35,134,54,0.15)" : "rgba(139,148,158,0.15)";
      badge.style.color = enabled ? "var(--accent-green)" : "var(--text-muted)";
    }
    if (addrEl) addrEl.textContent = addr === "0x0000000000000000000000000000000000000000" ? "미설정" : shortAddr(addr);
  } catch(e) {}
}

async function adminApproveClaim() {
  const id = el("adminClaimId").value;
  if (!id) { addLog("error", "청구 ID 없음", "청구 ID를 입력하세요."); showToast("청구 ID를 입력하세요.", "warning"); return; }
  await approveClaim(parseInt(id));
}
async function adminRejectClaim() {
  const id     = el("adminClaimId").value;
  const reason = el("adminRejectReason").value.trim();
  if (!id)     { addLog("error", "청구 ID 없음", ""); showToast("청구 ID를 입력하세요.", "warning"); return; }
  if (!reason) { addLog("error", "거절 사유 없음", ""); showToast("거절 사유를 입력하세요.", "warning"); return; }
  addLog("step", `[관리자 패널] 청구 #${id} 거절 - 사유: ${reason}`);
  await sendTx(
    async () => insSign.rejectClaim(parseInt(id), reason),
    `청구 #${id} 거절 (사유: ${reason})`,
    async () => refreshClaims()
  );
}
async function adminPayClaim() {
  const id = el("adminClaimId").value;
  if (!id) { addLog("error", "청구 ID 없음", ""); showToast("청구 ID를 입력하세요.", "warning"); return; }
  await payClaim(parseInt(id));
}

async function adminDepositFunds() {
  addLog("step", "[준비금 입금] 시작");
  if (!isOwner) {
    addLog("error", "권한 없음", "관리자만 준비금 입금 가능합니다."); showToast("관리자만 가능합니다.", "error"); return;
  }
  const amountRaw = el("depositAmount").value;
  const amount    = parseUsdc(amountRaw);
  addLog("info", "입금 금액 확인", `입력: ${amountRaw} → ${fmtUsdc(amount)}`);
  if (amount <= 0n) {
    addLog("error", "입력 오류", "금액이 0 이하입니다."); showToast("금액을 입력하세요.", "warning"); return;
  }

  // 잔액 확인
  const bal = await usdcCtx.balanceOf(userAddr).catch(() => 0n);
  addLog("info", "관리자 USDC 잔액", `${fmtUsdc(bal)} (입금 필요: ${fmtUsdc(amount)})`);
  if (bal < amount) {
    addLog("error", "잔액 부족", `보유: ${fmtUsdc(bal)}\n필요: ${fmtUsdc(amount)}`);
    showToast("USDC 잔액이 부족합니다.", "error"); return;
  }

  // Approve
  try {
    const allowance = await usdcCtx.allowance(userAddr, insAddr);
    addLog("info", "준비금 입금 allowance 확인",
      `현재: ${fmtUsdc(allowance)}\n필요: ${fmtUsdc(amount)}\n추가 승인 필요: ${allowance < amount}`);
    if (allowance < amount) {
      addLog("step", "[단계 1/2] USDC approve 실행 중...");
      const tx = await usdcSign.approve(insAddr, amount);
      addLog("info", "approve 제출됨", tx.hash, tx.hash);
      await tx.wait();
      addLog("success", "approve 완료");
    } else {
      addLog("info", "approve 생략 (기존 allowance 충분)");
    }
  } catch (err) {
    addLog("error", "approve 실패", parseError(err)); return;
  }

  addLog("step", "[단계 2/2] depositFunds 실행 중...");
  await sendTx(
    async () => insSign.depositFunds(amount),
    `준비금 입금: ${fmtUsdc(amount)} USDC`,
    async () => { el("depositAmount").value = ""; await refreshStats(); }
  );
}

async function adminMintUsdc() {
  addLog("step", "[USDC 민팅] 시작");
  if (!isOwner) {
    addLog("error", "권한 없음", "관리자만 민팅 가능합니다."); showToast("관리자만 가능합니다.", "error"); return;
  }
  const to        = el("mintTo").value.trim();
  const amountRaw = el("mintAmount").value;
  const amount    = parseUsdc(amountRaw);
  addLog("info", "민팅 입력값", `수령 주소: ${to}\n금액: ${amountRaw} → ${fmtUsdc(amount)}`);
  if (!ethers.isAddress(to)) {
    addLog("error", "주소 오류", `"${to}" 은(는) 유효한 주소가 아닙니다.`); showToast("올바른 주소를 입력하세요.", "error"); return;
  }
  if (amount <= 0n) {
    addLog("error", "금액 오류", "0 이하의 금액"); showToast("금액을 입력하세요.", "warning"); return;
  }
  await sendTx(
    async () => usdcSign.mint(to, amount),
    `USDC 민팅: ${fmtUsdc(amount)} → ${shortAddr(to)}`,
    async () => { el("mintAmount").value = ""; el("mintTo").value = ""; }
  );
}

// ═══════════════════════════════════════════════════════════════
//  블록체인 상태
// ═══════════════════════════════════════════════════════════════
async function refreshBlockchainState() {
  if (!insCtx || !usdcCtx) return;
  try {
    addLog("call", "블록체인 상태 조회 중...");
    const [stats, block, ownerAddr, totalSupply, myBal, networkInfo] = await Promise.all([
      insCtx.getStats(),
      provider.getBlock("latest"),
      insCtx.owner(),
      usdcCtx.totalSupply(),
      usdcCtx.balanceOf(userAddr),
      provider.getNetwork()
    ]);

    el("stateBlockNum").textContent    = block.number.toLocaleString();
    el("stateNetwork").textContent     = networkInfo.name === "unknown" ? `Hardhat (${networkInfo.chainId})` : networkInfo.name;
    el("stateChainId").textContent     = networkInfo.chainId.toString();
    el("stateOwner").textContent       = shortAddr(ownerAddr);
    el("stateOwner").title             = ownerAddr;
    el("stateUsdcSupply").textContent  = `${parseFloat(fmt(totalSupply)).toLocaleString("ko-KR")} USDC`;
    el("stateContractBal").textContent = fmtUsdc(stats.contractBalance);
    el("stateMyBal").textContent       = fmtUsdc(myBal);
    el("statePremiums").textContent    = fmtUsdc(stats.premiumsCollected);
    el("statePaid").textContent        = fmtUsdc(stats.claimsPaid);
    el("statePolicies2").textContent   = stats.policiesCount.toString();
    el("stateClaims2").textContent     = stats.claimsCount.toString();
    el("stateInsAddr").textContent     = shortAddr(insAddr);
    el("stateUsdcAddr").textContent    = shortAddr(usdcAddr);
    el("stateTimestamp").textContent   = new Date(Number(block.timestamp) * 1000).toLocaleString("ko-KR");

    const profit = BigInt(stats.premiumsCollected) - BigInt(stats.claimsPaid);
    el("stateProfit").textContent = fmtUsdc(profit < 0n ? 0n : profit);
    el("stateProfit").className   = `kv-value ${profit >= 0n ? "green" : "red"}`;

    addLog("call", "블록체인 상태 조회 완료",
      `블록 #${block.number} | 컨트랙트잔액: ${fmtUsdc(stats.contractBalance)} | 내잔액: ${fmtUsdc(myBal)}`);
  } catch (err) {
    addLog("error", "블록체인 상태 조회 실패", parseError(err));
  }
}

// ═══════════════════════════════════════════════════════════════
//  만기환급금
// ═══════════════════════════════════════════════════════════════
async function refreshMaturity() {
  if (!insCtx) return;
  try {
    const ids = await insCtx.getAllPolicyIds();
    const tbody = el("maturityTableBody");
    if (!tbody) return;
    if (ids.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:var(--text-muted);padding:30px">보험증권이 없습니다</td></tr>`;
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const block = await provider.getBlock("latest");
    const blockTs = Number(block.timestamp);

    const policies = await Promise.all(ids.map(id => insCtx.getPolicy(id)));
    tbody.innerHTML = policies.map(p => {
      const matDate    = Number(p.maturityDate);
      const rate       = Number(p.maturityRefundRate);
      const refundAmt  = (BigInt(p.totalPaid) * BigInt(rate)) / 100n;
      const isMatured  = blockTs >= matDate && p.active && !p.maturityPaid;
      const remaining  = matDate - now;

      let statusBadge;
      if (p.maturityPaid) {
        statusBadge = `<span class="badge badge-paid">💎 지급완료</span>`;
      } else if (!p.active) {
        statusBadge = `<span class="badge badge-inactive">비활성</span>`;
      } else if (isMatured) {
        statusBadge = `<span class="badge badge-approved">⏰ 만기도달</span>`;
      } else {
        const days  = Math.floor(remaining / 86400);
        const hours = Math.floor((remaining % 86400) / 3600);
        const mins  = Math.floor((remaining % 3600) / 60);
        const label = days > 0 ? `${days}일 ${hours}시간` : hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`;
        statusBadge = `<span class="badge badge-pending">⏳ ${label} 후</span>`;
      }

      const actionBtn = (isOwner && isMatured)
        ? `<button class="btn btn-primary btn-sm" onclick="processMaturityRefund(${p.id})">💎 환급 지급</button>`
        : "-";

      return `
        <tr>
          <td><strong>#${p.id}</strong></td>
          <td>${p.patientName}</td>
          <td class="text-right" style="color:var(--accent-blue)">${fmtUsdc(p.totalPaid)}</td>
          <td class="text-right" style="color:var(--accent-cyan)">${rate}%</td>
          <td class="text-right" style="color:var(--accent-green)">${fmtUsdc(refundAmt)}</td>
          <td style="font-size:12px">${new Date(matDate * 1000).toLocaleString("ko-KR")}</td>
          <td>${statusBadge}</td>
          <td>${actionBtn}</td>
        </tr>`;
    }).join("");

    // 만기 카운트 업데이트
    const maturedCount = policies.filter(p => blockTs >= Number(p.maturityDate) && p.active && !p.maturityPaid).length;
    const paidCount    = policies.filter(p => p.maturityPaid).length;
    const el2 = el("maturityAlertBadge");
    if (el2) el2.textContent = maturedCount > 0 ? ` 🔴 ${maturedCount}건 만기 도달!` : "";
    const el3 = el("maturityPaidCount"); if (el3) el3.textContent = paidCount;
    const el4 = el("maturityPendingCount"); if (el4) el4.textContent = maturedCount;

  } catch (err) {
    addLog("error", "만기환급 목록 조회 실패", parseError(err));
  }
}

async function queryMaturityRefund() {
  if (!insCtx) { showToast("컨트랙트를 먼저 연결하세요.", "warning"); return; }
  const id = el("queryMaturityPolicyId").value;
  if (!id) { showToast("증권 ID를 입력하세요.", "warning"); return; }
  try {
    const p = await insCtx.getPolicy(id);
    const block     = await provider.getBlock("latest");
    const blockTs   = Number(block.timestamp);
    const matDate   = Number(p.maturityDate);
    const rate      = Number(p.maturityRefundRate);
    const refundAmt = (BigInt(p.totalPaid) * BigInt(rate)) / 100n;
    const remaining = matDate - blockTs;

    let statusText;
    if (p.maturityPaid)        statusText = "💎 지급완료";
    else if (!p.active)        statusText = "비활성";
    else if (remaining <= 0)   statusText = "⏰ 만기도달 (미지급)";
    else {
      const days  = Math.floor(remaining / 86400);
      const hours = Math.floor((remaining % 86400) / 3600);
      const mins  = Math.floor((remaining % 3600) / 60);
      statusText  = days > 0 ? `⏳ ${days}일 ${hours}시간 후` : hours > 0 ? `⏳ ${hours}시간 ${mins}분 후` : `⏳ ${mins}분 후`;
    }

    const result = {
      "증권 ID":      p.id.toString(),
      "피보험자":     p.patientName,
      "지갑 주소":    p.patient,
      "납입 보험료 합계": fmtUsdc(p.totalPaid),
      "만기환급율":   rate + "%",
      "예상 환급액":  fmtUsdc(refundAmt),
      "만기일":       new Date(matDate * 1000).toLocaleString("ko-KR"),
      "현재 상태":    statusText,
      "지급 완료 여부": p.maturityPaid ? "✅ 완료" : "❌ 미지급"
    };

    el("maturityQueryResult").textContent = JSON.stringify(result, null, 2);
    addLog("success", `만기환급 조회 완료 (증권 #${id})`,
      `환급 예정액: ${fmtUsdc(refundAmt)} | 상태: ${statusText}`);
  } catch (err) {
    el("maturityQueryResult").textContent = "오류: " + err.message;
    addLog("error", `만기환급 조회 실패 (증권 #${id})`, parseError(err));
  }
}

async function processMaturityRefund(policyId) {
  addLog("step", `[만기환급 지급] 증권 #${policyId}`);
  if (!isOwner) {
    showToast("관리자만 만기환급 지급 가능합니다.", "error"); return;
  }
  try {
    const policy     = await insCtx.getPolicy(policyId);
    const refundAmt  = (BigInt(policy.totalPaid) * BigInt(policy.maturityRefundRate)) / 100n;
    const contractBal = await insCtx.getContractBalance();
    addLog("info", `만기환급 사전 확인 (증권 #${policyId})`,
      `피보험자    : ${policy.patientName}\n납입 합계   : ${fmtUsdc(policy.totalPaid)}\n환급율      : ${policy.maturityRefundRate}%\n환급 예정액 : ${fmtUsdc(refundAmt)}\n컨트랙트잔액: ${fmtUsdc(contractBal)}`);
    if (contractBal < refundAmt) {
      showToast("컨트랙트 잔액 부족. 준비금을 먼저 입금하세요.", "error"); return;
    }
  } catch (err) {
    addLog("error", "사전 확인 실패", parseError(err));
  }
  await sendTx(
    async () => insSign.processMaturityRefund(policyId),
    `증권 #${policyId} 만기환급금 지급`,
    async () => { await Promise.all([refreshMaturity(), refreshStats()]); }
  );
}

// ═══════════════════════════════════════════════════════════════
//  자동납부 (Auto Premium Payment)
// ═══════════════════════════════════════════════════════════════

async function refreshAutopaySchedule() {
  if (!insCtx) return;
  const tbody = el("autopayScheduleBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--text-muted)">조회 중...</td></tr>`;

  try {
    const ids = await insCtx.getAllPolicyIds();
    if (ids.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--text-muted);padding:20px">보험증권이 없습니다</td></tr>`;
      return;
    }

    let dueCount = 0, onCount = 0, offCount = 0;
    let rows = "";

    for (const id of ids) {
      const p = await insCtx.getPolicy(id);
      if (!p.active) continue;

      const now      = Math.floor(Date.now() / 1000);
      const isDue    = now >= Number(p.nextDueTime);
      const dueStr   = tsToDate(p.nextDueTime);
      const secLeft  = Number(p.nextDueTime) - now;

      // allowance 확인
      let allowance = 0n;
      try { allowance = await usdcCtx.allowance(p.patient, insAddr); } catch {}
      const autoOn = allowance >= p.monthlyPremium;

      if (isDue) dueCount++;
      if (autoOn) onCount++; else offCount++;

      const statusBadge = isDue
        ? `<span class="badge badge-pending">⏰ 기한 초과</span>`
        : `<span style="font-size:12px;color:var(--text-muted)">⏳ ${secLeft < 3600 ? secLeft+'초' : Math.round(secLeft/3600)+'시간'} 후</span>`;

      const autoBadge = autoOn
        ? `<span class="badge badge-approved">🟢 ON</span>`
        : `<span class="badge badge-rejected">🔴 OFF</span>`;

      rows += `<tr>
        <td>#${p.id}</td>
        <td>${p.patientName}</td>
        <td class="text-right">${fmtUsdc(p.monthlyPremium)}</td>
        <td style="font-size:12px">${dueStr}</td>
        <td>${autoBadge}</td>
        <td>${statusBadge}</td>
      </tr>`;
    }

    tbody.innerHTML = rows || `<tr><td colspan="6" class="text-center" style="color:var(--text-muted);padding:20px">활성 증권이 없습니다</td></tr>`;

    // 요약 카드 업데이트
    const dueEl = el("autopayDueCount");
    const onEl  = el("autopayOnCount");
    const offEl = el("autopayOffCount");
    const badge = el("autopayAlertBadge");
    if (dueEl) dueEl.textContent = dueCount;
    if (onEl)  onEl.textContent  = onCount;
    if (offEl) offEl.textContent = offCount;
    if (badge) badge.textContent = dueCount > 0 ? ` (${dueCount})` : "";

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--accent-red)">${err.message}</td></tr>`;
    addLog("error", "자동납부 일정 조회 실패", parseError(err));
  }
}

async function loadAutopayStatus() {
  const policyId = el("autopayPolicyId")?.value;
  const box      = el("autopayStatusBox");
  const onBtn    = el("autopayOnBtn");
  const offBtn   = el("autopayOffBtn");
  if (!policyId || !insCtx) {
    if (box) box.style.display = "none";
    if (onBtn)  onBtn.disabled = true;
    if (offBtn) offBtn.disabled = true;
    return;
  }

  try {
    const p        = await insCtx.getPolicy(policyId);
    const allowance = await usdcCtx.allowance(p.patient, insAddr);
    const autoOn   = allowance >= p.monthlyPremium;
    const now      = Math.floor(Date.now() / 1000);
    const isDue    = now >= Number(p.nextDueTime);

    if (box) box.style.display = "block";

    const badge = el("autopayStatusBadge");
    if (badge) {
      badge.textContent  = autoOn ? "🟢 자동납부 ON" : "🔴 자동납부 OFF";
      badge.className    = "badge " + (autoOn ? "badge-approved" : "badge-rejected");
    }

    const allowEl = el("autopayAllowance");
    if (allowEl) allowEl.textContent = allowance >= ethers.MaxUint256 / 2n
      ? "무제한 (MaxUint256)"
      : fmtUsdc(allowance);

    const premEl = el("autopayPremiumAmt");
    if (premEl) premEl.textContent = fmtUsdc(p.monthlyPremium);

    const dueEl = el("autopayNextDue");
    if (dueEl) dueEl.textContent = isDue
      ? "⏰ 납입 기한 초과!"
      : tsToDate(p.nextDueTime);

    if (onBtn)  onBtn.disabled  = false;
    if (offBtn) offBtn.disabled = false;

  } catch (err) {
    addLog("error", "자동납부 상태 조회 실패", parseError(err));
  }
}

async function enableAutoPay() {
  const policyId = el("autopayPolicyId")?.value;
  if (!policyId || !insCtx) { showToast("증권을 선택하세요.", "error"); return; }

  try {
    const p = await insCtx.getPolicy(policyId);
    addLog("step", `[자동납부 ON] 증권 #${policyId} — ${p.patientName}`,
      `approve(${insAddr}, MaxUint256) 실행 예정\n본인 지갑(${userAddr})에서 서명하세요.`);

    const tx = await usdcSign.approve(insAddr, ethers.MaxUint256);
    addLog("info", "approve 트랜잭션 전송됨", `TX: ${tx.hash}`);
    const receipt = await tx.wait();
    addLog("success", `자동납부 ON 완료 (증권 #${policyId})`,
      `TX: ${receipt.hash}\n이제 스케줄러가 납입 기한마다 자동으로 수납합니다.`, receipt.hash);
    showToast("자동납부가 활성화되었습니다.", "success");

    await Promise.all([loadAutopayStatus(), refreshAutopaySchedule()]);
  } catch (err) {
    addLog("error", "자동납부 ON 실패", parseError(err));
    showToast("자동납부 ON 실패: " + (err.reason || err.message), "error");
  }
}

async function disableAutoPay() {
  const policyId = el("autopayPolicyId")?.value;
  if (!policyId || !insCtx) { showToast("증권을 선택하세요.", "error"); return; }

  try {
    const p = await insCtx.getPolicy(policyId);
    addLog("step", `[자동납부 OFF] 증권 #${policyId} — ${p.patientName}`,
      `approve(${insAddr}, 0) — Allowance 취소`);

    const tx = await usdcSign.approve(insAddr, 0n);
    addLog("info", "approve(0) 트랜잭션 전송됨", `TX: ${tx.hash}`);
    const receipt = await tx.wait();
    addLog("success", `자동납부 OFF 완료 (증권 #${policyId})`,
      `TX: ${receipt.hash}`, receipt.hash);
    showToast("자동납부가 비활성화되었습니다.", "success");

    await Promise.all([loadAutopayStatus(), refreshAutopaySchedule()]);
  } catch (err) {
    addLog("error", "자동납부 OFF 실패", parseError(err));
    showToast("자동납부 OFF 실패: " + (err.reason || err.message), "error");
  }
}

// ═══════════════════════════════════════════════════════════════
//  청약 심사 (Underwriting)
// ═══════════════════════════════════════════════════════════════

const APP_STATUS       = ["대기중", "승인됨", "거절됨"];
const APP_STATUS_CLASS = ["badge-pending", "badge-approved", "badge-rejected"];

async function submitApplication() {
  addLog("step", "[청약 신청] 시작");
  if (!insSign) { showToast("컨트랙트를 먼저 연결하세요.", "warning"); return; }

  const name        = el("appName")?.value.trim();
  const age         = parseInt(el("appAge")?.value || "0");
  const premium     = parseUsdc(el("appPremium")?.value);
  const coverage    = parseUsdc(el("appCoverage")?.value);
  const matDays     = parseInt(el("appMaturityDays")?.value || "365");
  const refundRate  = parseInt(el("appRefundRate")?.value || "70");

  if (!name)        { showToast("청약자 이름을 입력하세요.", "warning"); return; }
  if (!age || age < 1) { showToast("나이를 입력하세요.", "warning"); return; }
  if (premium <= 0n){ showToast("월 보험료를 입력하세요.", "warning"); return; }
  if (coverage <= 0n){ showToast("보장 한도를 입력하세요.", "warning"); return; }

  addLog("info", "청약 입력값",
    `이름: ${name} / 나이: ${age}세\n월보험료: ${fmtUsdc(premium)} / 보장한도: ${fmtUsdc(coverage)}\n기간: ${matDays}일 / 환급율: ${refundRate}%`);

  await sendTx(
    async () => insSign.submitApplication(name, age, premium, coverage, matDays, refundRate),
    `청약 신청: ${name} (${age}세)`,
    async () => {
      await refreshApplications();
      showToast("청약 신청 완료! 심사 결과를 청약 목록에서 확인하세요.", "success");
    }
  );
}

async function approveApplication() {
  if (!insSign || !isOwner) { showToast("관리자만 처리 가능합니다.", "error"); return; }
  const appId = el("adminAppId")?.value;
  if (!appId) { showToast("청약 ID를 입력하세요.", "warning"); return; }

  addLog("step", `[청약 승인] 청약 #${appId} 승인 처리`);
  await sendTx(
    async () => insSign.approveApplication(appId),
    `청약 #${appId} 승인 → 보험증권 자동 생성`,
    async () => {
      await Promise.all([refreshApplications(), refreshPolicies()]);
      showToast(`청약 #${appId} 승인 완료! 보험증권이 생성되었습니다.`, "success");
    }
  );
}

async function rejectApplicationAdmin() {
  if (!insSign || !isOwner) { showToast("관리자만 처리 가능합니다.", "error"); return; }
  const appId  = el("adminAppId")?.value;
  const reason = el("adminAppRejectReason")?.value.trim();
  if (!appId)  { showToast("청약 ID를 입력하세요.", "warning"); return; }
  if (!reason) { showToast("거절 사유를 입력하세요.", "warning"); return; }

  addLog("step", `[청약 거절] 청약 #${appId} 거절 처리`, `사유: ${reason}`);
  await sendTx(
    async () => insSign.rejectApplication(appId, reason),
    `청약 #${appId} 거절: ${reason}`,
    async () => {
      await refreshApplications();
      showToast(`청약 #${appId} 거절 처리 완료.`, "success");
    }
  );
}

async function refreshApplications() {
  if (!insCtx) return;
  addLog("call", "getAllApplicationIds() 조회");
  try {
    const ids = await insCtx.getAllApplicationIds();
    const tbody = el("appTableBody");
    if (!tbody) return;

    if (ids.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" class="text-center" style="color:var(--text-muted);padding:30px">청약 내역이 없습니다</td></tr>`;
      return;
    }

    const apps = await Promise.all(ids.map(id => insCtx.getApplication(id)));
    tbody.innerHTML = apps.slice().reverse().map(a => {
      const statusIdx = Number(a.status);
      const riskColor = a.riskScore >= 60 ? "var(--accent-red)" : a.riskScore >= 30 ? "var(--accent-yellow)" : "var(--accent-green)";
      return `<tr>
        <td><strong>#${a.id}</strong></td>
        <td><code style="font-size:10px">${shortAddr(a.applicant)}</code></td>
        <td>${a.applicantName}</td>
        <td>${a.age}세</td>
        <td class="text-right">${fmtUsdc(a.monthlyPremium)}</td>
        <td class="text-right">${fmtUsdc(a.coverageLimit)}</td>
        <td class="text-center">${a.maturityDays}일</td>
        <td class="text-center"><span style="color:${riskColor};font-weight:600">${a.riskScore}점</span></td>
        <td><span class="badge ${APP_STATUS_CLASS[statusIdx]}">${APP_STATUS[statusIdx]}</span></td>
        <td>${a.policyId > 0n ? `<strong>#${a.policyId}</strong>` : "-"}</td>
        <td style="font-size:11px">${tsToDate(a.submittedAt)}</td>
        <td style="font-size:11px;color:var(--accent-red)">${a.rejectReason || "-"}</td>
      </tr>`;
    }).join("");

    addLog("success", `청약 목록 조회 완료 (${ids.length}건)`);
  } catch (err) {
    addLog("error", "청약 목록 조회 실패", parseError(err));
  }
}

// ═══════════════════════════════════════════════════════════════
//  약관대출 (Policy Loan)
// ═══════════════════════════════════════════════════════════════

let _loanMaxAmount = 0n;

async function refreshLoanInfo() {
  const policyId = el("loanPolicyId")?.value;
  const infoBox  = el("loanInfoBox");
  const reqBox   = el("loanRequestBox");
  const repayBox = el("loanRepayBox");
  const curBox   = el("loanCurrentBox");
  if (!policyId || !insCtx) {
    if (infoBox) infoBox.style.display = "none";
    return;
  }

  try {
    const [policy, maxLoan, loan, repay] = await Promise.all([
      insCtx.getPolicy(policyId),
      insCtx.getMaxLoanAmount(policyId),
      insCtx.getPolicyLoan(policyId),
      insCtx.getLoanRepayAmount(policyId)
    ]);

    _loanMaxAmount = maxLoan;

    const surrenderVal = (policy.totalPaid * policy.maturityRefundRate) / 100n;

    el("loanTotalPaid").textContent   = fmtUsdc(policy.totalPaid);
    el("loanSurrenderVal").textContent= fmtUsdc(surrenderVal);
    el("loanMaxAmount").textContent   = fmtUsdc(maxLoan);

    if (infoBox) infoBox.style.display = "block";

    if (loan.active) {
      el("loanActiveStatus").innerHTML = `<span class="badge badge-pending">대출중</span>`;
      el("loanPrincipal").textContent  = fmtUsdc(repay.principal);
      el("loanInterest").textContent   = fmtUsdc(repay.interest) ;
      el("loanRepayTotal").textContent = fmtUsdc(repay.total)    ;
      el("loanBorrowedAt").textContent = tsToDate(loan.borrowedAt);
      if (curBox) curBox.style.display = "block";
      if (reqBox)   reqBox.style.display   = "none";
      if (repayBox) repayBox.style.display = "block";
    } else {
      el("loanActiveStatus").innerHTML = `<span class="badge badge-approved">없음</span>`;
      if (curBox)   curBox.style.display   = "none";
      if (reqBox)   reqBox.style.display   = "block";
      if (repayBox) repayBox.style.display = "none";
    }
  } catch (err) {
    addLog("error", "대출 정보 조회 실패", parseError(err));
  }
}

function setLoanAmount(ratio) {
  if (_loanMaxAmount <= 0n) { showToast("증권을 먼저 선택하세요.", "warning"); return; }
  const amt = (_loanMaxAmount * BigInt(Math.floor(ratio * 100))) / 100n;
  const dec = stableDecimals();
  el("loanAmount").value = dec === 0
    ? amt.toString()
    : parseFloat(ethers.formatUnits(amt, dec)).toFixed(2);
}

async function requestPolicyLoan() {
  if (!insSign) { showToast("컨트랙트를 먼저 연결하세요.", "warning"); return; }
  const policyId = el("loanPolicyId")?.value;
  const amount   = parseUsdc(el("loanAmount")?.value);
  if (!policyId) { showToast("보험증권을 선택하세요.", "warning"); return; }
  if (amount <= 0n) { showToast("대출 금액을 입력하세요.", "warning"); return; }

  addLog("step", `[약관대출] 증권 #${policyId} — ${fmtUsdc(amount)} 대출 신청`);

  const balBefore = await usdcCtx.balanceOf(userAddr).catch(() => 0n);
  await sendTx(
    async () => insSign.requestPolicyLoan(policyId, amount),
    `약관대출 신청 (증권 #${policyId}): ${fmtUsdc(amount)}`,
    async () => {
      const balAfter = await usdcCtx.balanceOf(userAddr).catch(() => 0n);
      addLog("success", "약관대출 완료",
        `대출금액 : ${fmtUsdc(amount)}\n잔액 전   : ${fmtUsdc(balBefore)}\n잔액 후   : ${fmtUsdc(balAfter)}`);
      await Promise.all([refreshMyBalance(), refreshLoanInfo(), refreshLoanPolicies()]);
      showToast(`${fmtUsdc(amount)} 대출 완료!`, "success");
    }
  );
}

async function repayPolicyLoan() {
  if (!insSign) { showToast("컨트랙트를 먼저 연결하세요.", "warning"); return; }
  const policyId = el("loanPolicyId")?.value;
  if (!policyId) { showToast("보험증권을 선택하세요.", "warning"); return; }

  addLog("step", `[약관대출 상환] 증권 #${policyId} — 원금+이자 상환 시작`);

  try {
    // 상환액 조회
    const repay = await insCtx.getLoanRepayAmount(policyId);
    const total = repay.total;
    addLog("info", "상환 금액 확인",
      `원금: ${fmtUsdc(repay.principal)} / 이자: ${fmtUsdc(repay.interest)} / 합계: ${fmtUsdc(total)}`);

    // 잔액 확인
    const bal = await usdcCtx.balanceOf(userAddr).catch(() => 0n);
    if (bal < total) {
      addLog("error", "잔액 부족",
        `필요: ${fmtUsdc(total)} / 보유: ${fmtUsdc(bal)}\n파우셋에서 ${stableName()}을 추가로 수령하세요.`);
      showToast(`잔액 부족: ${fmtUsdc(total)} 필요`, "error");
      return;
    }

    // approve → repay (MaxUint256로 여유 있게 approve — 이자 정밀도 차이 방지)
    addLog("step", `[1단계] ${stableName()} approve(${fmtUsdc(total)}) 요청`);
    const approveTx = await usdcSign.approve(insAddr, ethers.MaxUint256);
    await approveTx.wait();
    addLog("success", "[1단계] approve 완료", `TX: ${approveTx.hash}`);

    await sendTx(
      async () => insSign.repayPolicyLoan(policyId),
      `약관대출 상환 (증권 #${policyId}): ${fmtUsdc(total)}`,
      async () => {
        await Promise.all([refreshMyBalance(), refreshLoanInfo(), refreshLoanPolicies()]);
        showToast("대출 상환 완료!", "success");
      }
    );
  } catch (err) {
    addLog("error", "대출 상환 실패", parseError(err));
    showToast("상환 실패: " + (err.reason || err.message), "error");
  }
}

async function refreshLoanPolicies() {
  if (!insCtx) return;
  try {
    const ids = await insCtx.getPatientPolicies(userAddr);
    const select = el("loanPolicyId");
    const tbody  = el("loanPolicyTable");

    if (select) {
      const prevVal = select.value;
      select.innerHTML = `<option value="">-- 증권 선택 --</option>`;
      ids.forEach(id => {
        const opt = document.createElement("option");
        opt.value = id.toString();
        opt.textContent = `증권 #${id}`;
        select.appendChild(opt);
      });
      if (prevVal) select.value = prevVal;
    }

    if (tbody) {
      if (ids.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="color:var(--text-muted);padding:20px">보험증권이 없습니다</td></tr>`;
        return;
      }
      const rows = await Promise.all(ids.map(async id => {
        const [policy, maxLoan, loan] = await Promise.all([
          insCtx.getPolicy(id),
          insCtx.getMaxLoanAmount(id),
          insCtx.getPolicyLoan(id)
        ]);
        const loanBadge = loan.active
          ? `<span class="badge badge-pending">대출중</span>`
          : `<span class="badge" style="background:rgba(139,148,158,0.15);color:var(--text-muted)">없음</span>`;
        return `<tr>
          <td><strong>#${id}</strong></td>
          <td>${policy.patientName}</td>
          <td class="text-right">${fmtUsdc(policy.totalPaid)}</td>
          <td class="text-right" style="color:var(--accent-green)">${fmtUsdc(maxLoan)}</td>
          <td>${loanBadge}</td>
        </tr>`;
      }));
      tbody.innerHTML = rows.join("");
    }

    // 선택된 증권의 대출 정보 업데이트
    if (el("loanPolicyId")?.value) await refreshLoanInfo();
  } catch (err) {
    addLog("error", "약관대출 현황 조회 실패", parseError(err));
  }
}

// ── 탭 전환 ──────────────────────────────────────────────────
function showTab(tabName) {
  document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  const tabEl = el(`tab-${tabName}`);
  const btnEl = document.querySelector(`[data-tab="${tabName}"]`);
  if (tabEl) tabEl.classList.add("active");
  if (btnEl) btnEl.classList.add("active");
  if (tabName === "state")          refreshBlockchainState();
  if (tabName === "policy")         refreshPolicies();
  if (tabName === "claim" || tabName === "admin") refreshClaims();
  if (tabName === "log")            updateLogCounters();
  if (tabName === "maturity")       refreshMaturity();
  if (tabName === "autopay")        refreshAutopaySchedule();
  if (tabName === "underwriting")   refreshApplications();
  if (tabName === "loan")           refreshLoanPolicies();
}

// ── 내 주소 복사 ──────────────────────────────────────────────
function copyMyAddr() {
  if (!userAddr) return;
  copyToClip(userAddr);
}

// ── 초기화 ───────────────────────────────────────────────────
window.addEventListener("load", async () => {
  addLog("info", "═══ 덴탈보험 블록체인 시스템 시작 ═══",
    `시각: ${new Date().toLocaleString("ko-KR")}\n브라우저: ${navigator.userAgent.slice(0,60)}`);
  addLog("info", "MetaMask 감지 확인",
    `window.ethereum 존재: ${!!window.ethereum}\nisMetaMask: ${window.ethereum?.isMetaMask || false}`);
  showTab("faucet");
  updateCurrencyLabels();
  await tryLoadConfig();
});
