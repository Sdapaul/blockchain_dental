# CLAUDE.md — 덴탈보험 블록체인 프로젝트

## 토큰 절약 규칙 (MANDATORY)

- **탐색 금지**: `node_modules/`, `artifacts/`, `cache/`, `#Backup/`, `*.pptx`, `*.zip`, `2026-1학기/` 절대 읽지 않는다
- **요청한 파일만 읽는다**: 작업과 무관한 파일 탐색 금지
- **응답은 최대한 짧게**: 변경한 내용만 설명, 요약·반복 금지
- **추가 기능 금지**: 요청하지 않은 리팩터링·주석·에러핸들링·타입 추가 금지
- **불필요한 탐색 금지**: 파일 경로를 알면 바로 읽는다, Glob/Grep은 모르는 경우에만

---

## 프로젝트 구조 (핵심만)

```
contracts/
  DentalInsurance.sol     ← 메인 컨트랙트 (보험증권·청구·대출·청약·KRW 통합)
  MockKRW.sol             ← KRW 스테이블코인 ERC20

scripts/
  deploy.js               ← 배포 스크립트 (4개 컨트랙트, 샘플 데이터 생성)
  oracle-service.js       ← ClaimSubmitted 이벤트 감지 → 자동 승인+지급
  maturity-watcher.js     ← 만기 감지 → 자동 환급
  premium-scheduler.js    ← 30초 폴링 → 자동 보험료 수납
  hospital-provider/
    mock-provider.js      ← Mock 치료코드 DB (23개)
    hira-provider.js      ← HIRA API 스텁
    index.js              ← HOSPITAL_PROVIDER env로 선택

frontend/
  index.html              ← 단일 페이지 UI
  app.js                  ← 전체 프론트엔드 로직 (MetaMask 연동)
  styles.css
  config.json             ← 배포 후 자동 갱신 (컨트랙트 주소)

hardhat.config.js         ← optimizer runs: 1 (컨트랙트 사이즈 초과 방지)
.env                      ← PRIVATE_KEY, HOSPITAL_PROVIDER 등
```

---

## 기능별 핵심 파일 매핑

| 기능 | 읽어야 할 파일 |
|------|--------------|
| 컨트랙트 수정 | `contracts/DentalInsurance.sol` |
| 배포/샘플 데이터 | `scripts/deploy.js` |
| 오라클 로직 | `scripts/oracle-service.js`, `scripts/hospital-provider/mock-provider.js` |
| 만기환급 | `scripts/maturity-watcher.js` |
| 자동납부 | `scripts/premium-scheduler.js` |
| UI 기능 | `frontend/app.js` |
| UI 레이아웃 | `frontend/index.html` |
| 네트워크/컴파일 설정 | `hardhat.config.js` |

---

## 서버 시작 순서

```bash
# 터미널 1
npx hardhat node

# 터미널 2 (배포 — --network localhost 필수)
npx hardhat run scripts/deploy.js --network localhost

# 터미널 3
cd frontend && npx serve .

# 터미널 4~6 (선택)
node scripts/maturity-watcher.js
node scripts/oracle-service.js
node scripts/premium-scheduler.js
```

브라우저: http://localhost:3000

---

## 테스트 계정 (Hardhat Localhost)

| 역할 | 주소 | 개인키 |
|------|------|--------|
| 관리자 (#0) | 0xf39F... | 0xac0974... |
| 김덴탈 (#1) | 0x7099... | 0x59c699... |
| 이치과 (#2) | 0x3C44... | 0x5de411... |
| 오라클 (#3) | 0x90F7... | 0x7c8521... |
| 박청약 (#4) | 0x15d3... | 0x47e179... |
| 최이십 (#5) | 0x9965... | 0x8b3a35... |
| 노거절 (#6) | 0x976E... | 0x92db14... |

MetaMask: RPC http://127.0.0.1:8545, chainId 31337

---

## 컨트랙트 주요 함수 (DentalInsurance.sol)

- `createPolicy()` — 관리자가 증권 생성
- `submitApplication()` — 청약 신청 (자동 룰 심사)
- `approveApplication()` / `rejectApplication()` — 관리자 심사
- `payPremium()` — 보험료 납부
- `collectPremium()` — 자동납부 (스케줄러 호출)
- `submitClaim()` — 보험금 청구
- `oracleVerifyAndProcess()` — 오라클 자동 승인+지급
- `processMaturityRefund()` — 만기환급금 지급
- `requestPolicyLoan()` / `repayPolicyLoan()` — 약관대출

---

## 이중 통화 (USDC / KRW)

- USDC: decimals=6, MockUSDC 컨트랙트
- KRW: decimals=0, MockKRW 컨트랙트
- `config.json`에 양쪽 컨트랙트 주소 저장
- `frontend/app.js`의 `switchCurrency()` 로 전환
- KRW 금액 = USDC 금액 × 1400

---

## Mock 치료코드 한도

| 코드 | USDC | KRW |
|------|------|-----|
| D0120 | $100 | ₩140,000 |
| D2140 | $200 | ₩280,000 |
| D7140 | $150 | ₩210,000 |
| D9110 | $300 | ₩420,000 |
| D2750 | $900 | ₩1,260,000 |

---

## 코딩 규칙

- Solidity: `^0.8.20`, OpenZeppelin v5 사용
- JS: ethers v6 (BigInt 기반, `parseUnits`/`formatUnits` 사용)
- 컨트랙트 사이즈 한계 → `hardhat.config.js` optimizer `runs: 1` 유지
- 약관대출 상환 시 approve에 `ethers.MaxUint256` 사용 (일반 금액 쓰면 오류)
- KRW 배포 시 반드시 faucet 먼저 → depositFunds 순서 지켜야 함
- 테스트 상세: `TEST_PROGRESS.md` 참고
