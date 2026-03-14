const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("=".repeat(60));
  console.log("  덴탈보험 블록체인 시스템 배포");
  console.log("=".repeat(60));
  console.log(`  네트워크  : ${network.name} (chainId: ${network.chainId})`);
  console.log(`  배포자    : ${deployer.address}`);
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log(`  잔액      : ${ethers.formatEther(bal)} ETH`);
  console.log("-".repeat(60));

  // ── 1. MockUSDC 배포 ──────────────────────────────────────
  console.log("\n[1/4] MockUSDC 배포 중...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log(`  ✅ MockUSDC 배포 완료: ${usdcAddress}`);

  // ── 2. DentalInsurance 배포 ───────────────────────────────
  console.log("\n[2/4] DentalInsurance 배포 중...");
  const DentalInsurance = await ethers.getContractFactory("DentalInsurance");
  const insurance = await DentalInsurance.deploy(usdcAddress);
  await insurance.waitForDeployment();
  const insuranceAddress = await insurance.getAddress();
  console.log(`  ✅ DentalInsurance 배포 완료: ${insuranceAddress}`);

  // ── 3. 준비금 입금 (컨트랙트에 50,000 USDC) ──────────────
  console.log("\n[3/4] 보험 준비금 입금 중... (50,000 USDC)");
  const reserveAmount = ethers.parseUnits("50000", 6);
  let tx = await usdc.approve(insuranceAddress, reserveAmount);
  await tx.wait();
  tx = await insurance.depositFunds(reserveAmount);
  await tx.wait();
  console.log(`  ✅ 준비금 입금 완료: 50,000 USDC`);

  // ── 4. 샘플 보험증권 생성 ─────────────────────────────────
  console.log("\n[4/4] 샘플 보험증권 생성 중...");
  const accounts = await ethers.getSigners();

  // 테스트용 만기일: 블록체인 현재 시간 기준 5분 후
  const latestBlock = await ethers.provider.getBlock("latest");
  const now = Number(latestBlock.timestamp);
  const maturityIn5Min = now + 5 * 60;
  const refundRate = 70; // 납입 보험료의 70% 환급

  // 계정 #1 - 김덴탈 (월 50 USDC, 한도 1,000 USDC, 만기 5분, 환급율 70%)
  if (accounts.length > 1) {
    const premium1 = ethers.parseUnits("50", 6);
    const limit1   = ethers.parseUnits("1000", 6);
    tx = await insurance.createPolicy(
      accounts[1].address, "김덴탈", premium1, limit1, maturityIn5Min, refundRate
    );
    await tx.wait();
    console.log(`  ✅ 증권 #1: 김덴탈 (${accounts[1].address})`);
    console.log(`     └─ 만기: ${new Date(maturityIn5Min * 1000).toLocaleTimeString()} / 환급율: ${refundRate}%`);

    const faucetAmt = ethers.parseUnits("1000", 6);
    await usdc.connect(accounts[1]).faucet(faucetAmt);
    console.log(`     └─ 1,000 USDC 지급 완료`);
  }

  // 계정 #2 - 이치과 (월 80 USDC, 한도 2,000 USDC, 만기 10분, 환급율 70%)
  if (accounts.length > 2) {
    const premium2 = ethers.parseUnits("80", 6);
    const limit2   = ethers.parseUnits("2000", 6);
    const maturityIn10Min = now + 10 * 60; // 블록체인 시간 기준 10분 후
    tx = await insurance.createPolicy(
      accounts[2].address, "이치과", premium2, limit2, maturityIn10Min, refundRate
    );
    await tx.wait();
    console.log(`  ✅ 증권 #2: 이치과 (${accounts[2].address})`);
    console.log(`     └─ 만기: ${new Date(maturityIn10Min * 1000).toLocaleTimeString()} / 환급율: ${refundRate}%`);

    const faucetAmt = ethers.parseUnits("1000", 6);
    await usdc.connect(accounts[2]).faucet(faucetAmt);
    console.log(`     └─ 1,000 USDC 지급 완료`);
  }

  // ── 배포 정보 저장 ────────────────────────────────────────
  const config = {
    network:         network.name,
    chainId:         network.chainId.toString(),
    deployer:        deployer.address,
    deployedAt:      new Date().toISOString(),
    contracts: {
      MockUSDC:       usdcAddress,
      DentalInsurance: insuranceAddress
    }
  };

  const frontendDir = path.join(__dirname, "..", "frontend");
  if (!fs.existsSync(frontendDir)) fs.mkdirSync(frontendDir, { recursive: true });

  // config.json 저장
  fs.writeFileSync(
    path.join(frontendDir, "config.json"),
    JSON.stringify(config, null, 2)
  );

  console.log("\n" + "=".repeat(60));
  console.log("  배포 완료!");
  console.log("=".repeat(60));
  console.log(`  MockUSDC         : ${usdcAddress}`);
  console.log(`  DentalInsurance  : ${insuranceAddress}`);
  console.log(`  config.json 저장 : frontend/config.json`);
  console.log("\n  ▶ 웹 UI: frontend/index.html 을 브라우저에서 열어주세요.");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("배포 실패:", error);
    process.exit(1);
  });
