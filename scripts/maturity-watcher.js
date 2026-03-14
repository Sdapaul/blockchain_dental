/**
 * maturity-watcher.js
 * 만기환급금 자동 지급 워처
 *
 * 실행: node scripts/maturity-watcher.js
 *
 * 동작:
 *  - 10초마다 전체 보험증권 만기 여부 확인
 *  - 만기 도달 시 관리자 계정으로 processMaturityRefund() 자동 호출
 */

const { ethers } = require("ethers");
const fs   = require("fs");
const path = require("path");

// ── 설정 ──────────────────────────────────────────────────────────
const RPC_URL     = "http://127.0.0.1:8545";
const ADMIN_KEY   = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const POLL_SEC    = 10;  // 폴링 간격 (초)
const CONFIG_PATH = path.join(__dirname, "..", "frontend", "config.json");

// ── ABI (필요한 함수만) ────────────────────────────────────────────
const ABI = [
  "function getAllPolicyIds() view returns (uint256[])",
  "function getPolicy(uint256) view returns (tuple(uint256 id, address patient, string patientName, uint256 monthlyPremium, uint256 coverageLimit, uint256 totalPaid, uint256 lastPaymentTime, uint256 nextDueTime, bool active, uint256 createdAt, uint256 maturityDate, uint256 maturityRefundRate, bool maturityPaid))",
  "function isMatured(uint256) view returns (bool)",
  "function processMaturityRefund(uint256) external",
  "event MaturityRefundPaid(uint256 indexed policyId, address indexed patient, uint256 refundAmount, uint256 timestamp)"
];

// ── 유틸 ──────────────────────────────────────────────────────────
function log(msg) {
  const t = new Date().toLocaleTimeString("ko-KR");
  console.log(`[${t}] ${msg}`);
}

function usdcFmt(raw) {
  return "$" + (Number(raw) / 1e6).toFixed(2);
}

// ── 메인 ──────────────────────────────────────────────────────────
async function main() {
  // config.json 로드
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error("❌ frontend/config.json 없음 — 먼저 배포를 실행하세요.");
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const insuranceAddr = config.contracts?.DentalInsurance;
  if (!insuranceAddr) {
    console.error("❌ config.json에 DentalInsurance 주소가 없습니다.");
    process.exit(1);
  }

  // Provider / Signer
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const admin    = new ethers.Wallet(ADMIN_KEY, provider);
  const contract = new ethers.Contract(insuranceAddr, ABI, admin);

  console.log("=".repeat(60));
  console.log("  🦷 만기환급금 자동 지급 워처 시작");
  console.log("=".repeat(60));
  log(`DentalInsurance: ${insuranceAddr}`);
  log(`관리자 계정:      ${admin.address}`);
  log(`폴링 간격:        ${POLL_SEC}초`);
  console.log("-".repeat(60));

  const processed = new Set(); // 이미 처리한 policyId

  async function checkAndProcess() {
    try {
      const policyIds = await contract.getAllPolicyIds();
      if (policyIds.length === 0) return;

      for (const id of policyIds) {
        const policyId = Number(id);
        if (processed.has(policyId)) continue;

        const matured = await contract.isMatured(policyId);
        if (!matured) continue;

        // 만기 도달 — 환급 실행
        const policy = await contract.getPolicy(policyId);
        const refundAmt = (BigInt(policy.totalPaid) * BigInt(policy.maturityRefundRate)) / 100n;

        log(`⏰ 증권 #${policyId} 만기 도달!`);
        log(`   피보험자: ${policy.patientName} (${policy.patient})`);
        log(`   납입 합계: ${usdcFmt(policy.totalPaid)}  환급율: ${policy.maturityRefundRate}%  환급액: ${usdcFmt(refundAmt)}`);
        log(`   processMaturityRefund(${policyId}) 실행 중...`);

        try {
          const tx = await contract.processMaturityRefund(policyId);
          await tx.wait();
          processed.add(policyId);
          log(`✅ 증권 #${policyId} 만기환급금 지급 완료! TX: ${tx.hash}`);
        } catch (txErr) {
          log(`❌ 증권 #${policyId} 지급 실패: ${txErr.message}`);
        }
      }
    } catch (err) {
      log(`⚠️  조회 오류: ${err.message}`);
    }
  }

  // 이벤트 리스너
  contract.on("MaturityRefundPaid", (policyId, patient, refundAmount, timestamp) => {
    log(`📢 [이벤트] MaturityRefundPaid — 증권 #${policyId}, ${usdcFmt(refundAmount)} 지급 → ${patient}`);
  });

  // 첫 번째 실행
  await checkAndProcess();

  // 폴링 루프
  setInterval(checkAndProcess, POLL_SEC * 1000);

  // 전체 증권 만기 정보 출력
  try {
    const ids = await contract.getAllPolicyIds();
    if (ids.length > 0) {
      console.log("\n[ 만기 일정 ]");
      for (const id of ids) {
        const p   = await contract.getPolicy(id);
        const mat = new Date(Number(p.maturityDate) * 1000).toLocaleString("ko-KR");
        const remaining = Number(p.maturityDate) - Math.floor(Date.now() / 1000);
        const status = p.maturityPaid ? "✅ 지급완료" : (remaining <= 0 ? "⏰ 만기" : `⏳ ${remaining}초 후`);
        log(`증권 #${id}: ${p.patientName} | 만기: ${mat} | ${status}`);
      }
      console.log("-".repeat(60));
    }
  } catch (_) {}
}

main().catch(err => {
  console.error("치명적 오류:", err);
  process.exit(1);
});
