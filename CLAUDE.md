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
run.bat                   ← 노드+배포+프론트엔드+워처+오라클+스케줄러 한번에 실행,
                             Chrome(관리자)·Edge(고객) 두 브라우저 자동 오픈

contracts/
  DentalInsurance.sol     ← 메인 컨트랙트 (보험증권·청구·대출·청약·KRW 통합)
  MockUSDC.sol            ← USDC 스테이블코인 ERC20 (생성자 자동민팅 없음, deploy.js가 명시적으로 민팅)
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

**가장 간단한 방법**: `run.bat` 더블클릭 — 아래 6단계를 전부 순서대로 실행하고, 배포 완료 후 Chrome(관리자 계정용)과 Edge(고객 계정용)를 자동으로 엽니다. 재실행 시 기존 노드/서버를 먼저 종료해야 포트 충돌이 안 남. Edge에 MetaMask로 같은 네트워크+테스트 계정을 한 번 세팅해두면 두 브라우저가 서로 다른 계정으로 동시에 접속 가능(계정 선택은 브라우저별로 독립적).

수동으로 할 경우:
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

**배포 직후 기본 잔액** (deploy.js): 관리자/김덴탈/이치과 전부 동일하게 USDC $1,000 / KRW ₩1,000,000으로 시작. 보험사(컨트랙트) 잔액은 USDC $50,000 / KRW ₩10,000,000.

---

## 컨트랙트 주요 함수 (DentalInsurance.sol)

- `createPolicy()` — 관리자가 증권 생성
- `submitApplication()` — 청약 신청. 3단계 자동심사(2026-09-13 최종): **보장한도/월보험료 비율 ≤ `autoApproveRatio`(기본 10배)** → 같은 트랜잭션 안에서 즉시 승인+증권 생성. **비율 > `maxCoverageRatio`(기본 100배)** 또는 나이·최소보험료·활성증권한도 위반 → 즉시 거절. **그 사이(10~100배)** → 대기(Pending), 관리자가 아래 두 함수로 심사.
- `approveApplication()` / `rejectApplication()` — 관리자가 Pending 청약을 심사 (10~100배 구간 전용). 승인 시 `_grantApproval()`, 거절 시 `_rejectApplication()` 내부 공용 함수 사용(자동승인 경로와 로직 공유, 컨트랙트 크기 절약).
- `payPremium()` — 보험료 납부
- `collectPremium()` — 자동납부 (스케줄러 호출)
- `submitClaim()` — 보험금 청구. **오라클 모드 ON + 청구금액이 보장한도의 20%(`AUTO_CLAIM_APPROVAL_PERCENT`) 이하** → 제출과 동시에 자동 승인+지급. 그 외(오라클 모드 OFF, 또는 20% 초과)는 전부 대기(Pending) → **관리자 수동 심사**(`approveClaim`/`payClaim`/`rejectClaim`) 필요.
- `oracleVerifyAndProcess()` — 오라클 자동 승인+지급. `oracleModeEnabled`가 `true`여야 하고(2026-09-13부터 실제로 강제됨 — 그 전엔 체크가 없어서 꺼놔도 오라클이 처리해버리는 버그가 있었음), **청구금액이 보장한도의 20% 이하인 경우에만** 호출 가능 — 오라클 모드가 켜져 있어도 20% 초과 청구는 오라클이 절대 처리할 수 없고 항상 관리자 수동 심사 전용(2026-09-13 명시적으로 강제). `deploy.js`는 오라클 주소만 등록하고 모드는 기본 OFF로 배포.
- `processMaturityRefund()` — 만기환급금 지급
- `requestPolicyLoan()` / `repayPolicyLoan()` — 약관대출 신청 / 전액(원금+이자) 상환
- `repayPolicyLoanPartial(policyId, amount)` — 약관대출 부분상환. 발생 이자를 항상 전액 우선 충당(부족하면 revert), 초과분은 원금 차감. 상환 시점에 이자계산 시각(`borrowedAt`)이 갱신되어 남은 원금 기준으로 새로 이자가 붙기 시작함. 원금이 0이 되면 대출 자동 종료. amount는 반드시 이자 이상 ~ 총상환액(원금+이자) 이하여야 함(초과 시 revert, 전액상환은 `repayPolicyLoan()` 사용). ⚠️ 클라이언트가 조회한 이자값 그대로 넣으면 트랜잭션 채굴 시점까지 초당 이자가 더 붙어 실패할 수 있으므로 소액 버퍼를 더해 넣을 것.

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

## 알려진 이슈 (수정 완료)

- **보장한도 미집계** (수정됨): `Policy.totalClaimed` 필드 추가, `submitClaim()`/`_accrueClaim()`(오라클 자동지급·`payClaim()` 공용)에서 `totalClaimed + amount <= coverageLimit` 검증 후 누적.
- **만기환급 시 대출 미정산** (수정됨): `processMaturityRefund()`가 활성 대출이 있으면 원리금을 환급액에서 차감 후 정산(`PolicyLoanRepaid` 이벤트 발생), 남은 금액만 지급.
- **청약 심사 비율 체크 정수 나눗셈 오차** (수정됨): `_underwrite()`의 보장/보험료 비율 검사가 `coverageLimit / monthlyPremium`(정수 나눗셈)으로 소수점을 버려 실제 101배인데 100배로 통과되는 경계 오차가 있었음 → `coverageLimit > monthlyPremium * maxCoverageRatio` 곱셈 비교로 변경, 오차 없이 정확.
- **청약 승인 시 활성증권 한도 재검증 누락** (수정됨): 동일인이 활성증권 0건일 때 청약을 한도(3건) 이상 동시에 제출하면 모두 통과 후 나중에 한도를 초과하는 문제가 있었음 → `approveApplication()`에 활성증권 수 재검증(`_activePolicyCount()` 공용 함수) 추가, 한도 도달 시 승인 자체가 revert됨. (2026-09-13: 청약심사가 3단계(자동승인/관리자심사/거절)로 바뀌면서 `approveApplication()`/`rejectApplication()`이 복원됨 — 이 재검증도 그대로 유지)
- **`isMatured()`가 보험료 미납 증권도 "만기 도달"로 판정** (수정됨): `processMaturityRefund()`는 `totalPaid > 0`을 요구하는데 `isMatured()`는 이를 확인하지 않아, 보험료를 한 번도 안 낸 채 만기가 지난 증권도 true를 반환함 → `maturity-watcher.js`가 10초마다 `processMaturityRefund()`를 호출→"No premiums paid" revert→재시도를 무한 반복하는 것을 실측 확인. `isMatured()`에 `policy.totalPaid > 0` 조건 추가로 해결.
- **프론트엔드 대시보드 "만기환급 총액" 통계가 대출차감 미반영** (수정됨): `frontend/app.js`의 `refreshStats()`가 `maturityPaid=true`인 증권들의 `totalPaid×maturityRefundRate%`를 사후 재계산해 합산했는데, 대출 상환 후에는 `policyLoans` 상태가 초기화되어 "그때 대출이 있었는지"를 현재 상태로 복원할 수 없어 실제 지급액보다 과다 계상됨 → `MaturityRefundPaid` 이벤트 로그의 `refundAmount`를 합산하는 방식으로 교체.
- **보험료납입/청구/자동납부/약관대출 드롭다운이 타인 증권까지 노출** (수정됨): `frontend/app.js`의 `updatePolicySelect()`가 `premiumPolicyId`/`claimPolicyId`/`autopayPolicyId`/`loanPolicyId` 4개 드롭다운에 전체 환자의 증권을 필터링 없이 표시함 → 실측 시 김덴탈 지갑으로 접속했는데 자동납부 탭에 이치과의 증권(#2)이 선택되어 그 정보가 그대로 노출되는 문제 확인. `payPremium`/`submitClaim`/`requestPolicyLoan`은 온체인 소유자 체크(`policy.patient == msg.sender`)로 실제 자금 이동은 막히지만, 자동납부의 `approve()`는 지갑 단위라 이런 보호장치가 없어 혼란을 유발함 → `updatePolicySelect()`에서 `policy.patient === userAddr`로 필터링해 본인 소유 증권만 표시하도록 수정.
- **보험증권/청구/만기환급/자동납부일정/청약 목록 테이블이 전체 계정 데이터를 노출** (수정됨): 같은 원인으로 `refreshPolicies()`, `refreshClaims()`, `refreshMaturity()`, `refreshAutopaySchedule()`, `refreshApplications()` 5개 목록 테이블 모두 관리자/일반 계정 구분 없이 전체 데이터를 그대로 렌더링함 → "관리자(`isOwner`)는 전체 조회, 일반 계정은 본인(`patient`/`applicant` == `userAddr`) 데이터만" 원칙으로 통일. 관리자는 승인/거절/비활성화 등 관리 작업을 위해 전체를 계속 봐야 하므로 필터링에서 제외됨. 약관대출 탭(`refreshLoanPolicies`)은 애초에 `getPatientPolicies(userAddr)`로 온체인에서부터 본인 것만 조회하고 있어 문제 없었음.
- **관리자 전용 UI(새 보험증권 생성/관리자 패널 탭/수동 만기환급 지급/청약 심사 처리)가 일반 계정에도 그대로 노출** (수정됨): "(관리자 전용)" 라벨과 경고 문구만 있고 실제 화면 숨김 처리는 없어서, 일반 계정(김덴탈)으로 접속해도 이 4개 관리자 전용 UI가 그대로 보였음(실행하면 온체인 `onlyOwner`에 막히긴 함) → `index.html`에 `id="tabBtnAdmin"`/`id="cardCreatePolicy"`/`id="cardManualMaturity"`/`id="cardAdminAppReview"` 부여 후 기본 `hidden` 클래스 적용, `app.js`의 `updateAdminOnlyVisibility()`가 `isOwner` 확정 시점에 토글. `showTab()`에도 `admin` 탭 직접 접근 가드 추가.
- **대시보드 상단 통계 카드가 관리자/일반 계정 구분 없이 항상 전체 합산값 표시** (수정됨): `refreshStats()`가 `getStats()`(컨트랙트 전역 합계)와 전체 정책/청구/청약 목록을 그대로 집계해, 일반 계정으로 봐도 다른 사람 몫까지 합쳐진 총 보험료 수납/보험금 지급/증권·청구·청약·대출·만기환급 건수가 표시됨 → "관리자는 전체 합산, 일반 계정은 본인 데이터만 집계" 원칙 적용. 컨트랙트 잔액(`statBalance`)은 컨트랙트 전체의 단일 값이라 계정과 무관하게 항상 동일하게 표시(분리 대상 아님).

## 코딩 규칙

- Solidity: `^0.8.20`, OpenZeppelin v5 사용
- JS: ethers v6 (BigInt 기반, `parseUnits`/`formatUnits` 사용)
- 컨트랙트 사이즈 한계 → `hardhat.config.js` optimizer `runs: 1` 유지
- 약관대출 상환 시 approve에 `ethers.MaxUint256` 사용 (일반 금액 쓰면 오류)
- KRW 배포 시 반드시 faucet 먼저 → depositFunds 순서 지켜야 함
- 테스트 상세: `TEST_PROGRESS.md` 참고
- UI 용어: 컨트랙트 USDC/KRW 보유량은 "컨트랙트 잔액"이 아니라 **"보험사 잔액"**으로 표기 (2026-09-13 통일, 신규 텍스트 추가 시 이 용어 유지)
