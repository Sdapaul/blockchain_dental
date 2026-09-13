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
  ReserveFund.sol         ← 준비금 계좌 (고객 송금 → 연 5% 매일 복리 적립, USDC/KRW 각각 별도 배포)
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
| 준비금 계좌 컨트랙트 | `contracts/ReserveFund.sol` |
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

**배포 직후 기본 잔액** (deploy.js): 관리자/김덴탈/이치과 전부 동일하게 USDC $1,000 / KRW ₩1,000,000으로 시작. 보험사(컨트랙트) 잔액은 USDC $50,000 / KRW ₩10,000,000. 김덴탈·이치과·박청약·최이십은 **준비금 계좌(ReserveFund)에도 내 잔액과 동일한 금액**(USDC 1,000 / KRW 100만원, 박청약·최이십은 USDC만)이 시드로 예치되어 배포 직후부터 "내 잔액 == 준비금 잔액"이 되도록 세팅됨.

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
- `setPremiumInterval(policyId, intervalSeconds)` — (관리자 전용, 2026-09-13 추가) 증권의 자동이체(납입) 주기를 임의의 초 단위로 변경. 기본 30일이 `Policy.premiumInterval` 필드에 저장되며 `payPremium`/`collectPremium`이 이 값을 사용. 호출 즉시 `nextDueTime`도 `now + intervalSeconds`로 재계산됨 — 관리자가 스크립트로 자유롭게 조정할 때 사용(값 제한 없음).
- `setMyPremiumInterval(policyId, intervalSeconds)` — (피보험자 본인 전용, 2026-09-13 추가) 관리자 승인 없이 **피보험자 본인이 직접** 자동이체 주기를 선택. `PREMIUM_INTERVAL_TEST`(5분, 테스트 전용 — 추후 프론트엔드 옵션에서 삭제 예정)/`PREMIUM_INTERVAL_MONTHLY`(1개월)/`PREMIUM_INTERVAL_QUARTERLY`(3개월) 중 하나만 허용(그 외 값은 revert). `policy.patient == msg.sender` 아니면 revert. 프론트엔드 "자동납부" 탭의 주기 선택 드롭다운이 이 함수를 호출.
- `setMaturityDate(policyId, newMaturityDate)` — (관리자 전용, 2026-09-13 추가) 증권의 만기일을 임의의 시각으로 직접 변경. `maturityPaid`가 아직 false여야 하고 미래 시각만 허용. 관리자가 스크립트로 자유롭게 조정할 때 사용(값 제한 없음).
- `setMyMaturityInterval(policyId, intervalSeconds)` — (피보험자 본인 전용, 2026-09-13 추가) 관리자 승인 없이 **피보험자 본인이 직접** 만기 시점을 선택 (`block.timestamp + intervalSeconds`로 재설정). `MATURITY_OPTION_TEST`(5분, 테스트 전용)/`_DAILY`(1일)/`_MONTHLY`(1개월)/`_QUARTERLY`(3개월)/`_YEARLY`(1년) 중 하나만 허용. `policy.patient == msg.sender` 아니면 revert, 이미 `maturityPaid`인 증권도 revert. 프론트엔드 "만기환급" 탭의 `cardMaturityMine` 카드가 이 함수를 호출 — `setMyPremiumInterval`과 동일한 패턴.

---

## 준비금 계좌 (ReserveFund.sol, 2026-09-13 추가)

- 보험증권과 별개로, 고객이 보험사에 USDC/KRW를 **송금(`depositReserve`)**하면 쌓이는 준비금 계좌. USDC용 `ReserveFund`, KRW용 `ReserveFundKRW` 각각 별도 배포(`config.json`의 `ReserveFund`/`ReserveFundKRW`).
- 연 5%(`ANNUAL_RATE_BPS`)를 **매일 복리**로 적산 (경과일수만큼 반복 계산하는 loop 방식, 정확한 날짜 단위 복리 — 폐쇄형 수식이 아님에 유의).
- `depositReserve(amount)` — 송금(준비금 적립). `withdrawReserve(amount)` — 인출 (인출 전 경과 이자를 먼저 원금에 반영한 뒤 그 원금 기준으로 인출 가능액 검증).
- `previewBalance(patient)` — 미확정 이자까지 포함한 "지금 조회 시점" 예상 잔액을 상태 변경 없이 반환 (프론트엔드가 실시간 표시에 사용).
- **이자는 실제 토큰으로 뒷받침됨**: 이자가 붙을 때마다 컨트랙트가 `MockUSDC`/`MockKRW`의 permissionless `faucet()`을 호출해 이자만큼 자체 발행 (`IFaucetToken` 인터페이스로 캐스팅) → 인출 시 절대 잔액 부족으로 실패하지 않음. 실제 서비스라면 관리자가 별도로 준비금을 채워 넣어야 하나, 이 프로젝트는 테스트 토큰이라 자동 발행으로 단순화함.
- 프론트엔드: "준비금 계좌" 탭 — 일반 계정은 `cardReserveMine`(내 계좌+송금/인출 폼), 관리자는 `cardReserveAdmin`(전체 고객 현황 테이블)이 `isOwner` 기준으로 토글되어 하나만 보임 (`updateAdminOnlyVisibility()`). 대시보드 "🏛️ 준비금 잔액" 카드는 "🏦 보험사 잔액" 카드 바로 앞에 위치, 전체 고객 `previewBalance` 합계를 표시.
- 파우셋 탭: "USDC 수령하기"(지갑)와 "준비금 계좌에 예치"(`depositFaucetAmountToReserve()` → 기존 `depositReserve()` 재사용)는 **완전히 독립된 버튼**(2026-09-13 분리 — 예치는 파우셋 없이 기존 지갑 잔액에서 차감). 같은 탭의 "내 잔액" 카드 아래에 본인의 "준비금 잔액"도 같이 표시(`myReserveBal`, `refreshMyBalance()`가 계산) — 일반 계정은 본인 것만, **관리자는 전체 고객 합계**(보험사 잔액과 같은 성격의 시스템 전체 값)를 보여줌. 관리자는 거래 주체가 아니므로 "USDC 수령하기" 버튼과 "내 잔액"(지갑) 표시는 항상 숨김/0 처리.
- `depositReserve()`/`withdrawReserve()` 성공 시 `refreshStats()`도 같이 호출해야 대시보드 "준비금 잔액" 카드가 즉시 갱신됨(2026-09-13 버그 수정 — 원래 `refreshMyBalance()`/`refreshReserve()`만 불러서 다음 새로고침 전까지 반영이 안 됐었음).
- ⚠️ **다른 세션(다른 브라우저/계정)이 준비금을 송금해도 내 화면은 자동으로 안 바뀜** (2026-09-13 발견): `refreshStats()`/`refreshReserve()`는 "내 세션에서 트랜잭션을 보냈을 때"만 호출되므로, 예를 들어 고객(Edge)이 송금해도 관리자(Chrome) 화면은 수동 새로고침 전까진 옛 값을 보여줌. → `attachEventListeners()`에 `ReserveFund`의 `ReserveDeposited`/`ReserveWithdrawn`/`InterestAccrued` 이벤트 리스너를 추가해서(다른 기존 이벤트들과 동일 패턴), **누가 트랜잭션을 보냈든** 연결된 모든 브라우저 세션이 `refreshAll()`로 실시간 동기화되도록 함.
- **"준비금 잔액" 표시는 관리자/일반 계정에 따라 값 자체가 다름** (2026-09-13 확정): 일반 계정(`labelStatReserve`/`labelMyReserve` = "🏛️ 내 준비금 잔액")은 `previewBalance(본인)`만, 관리자(= "🏛️ 보험사 준비금 잔액")는 `getAllHolders()` 전체 합계를 보여줌 — `getViewerReserveBalance()` 공용 함수로 `refreshStats()`/`refreshMyBalance()` 양쪽에서 재사용.
- **약관대출 → 만기환급 자동 정산은 이미 정상 동작 확인됨** (2026-09-13 실측): 김덴탈이 대출 $14(+이자 $0.000005)를 받은 상태로 만기가 되자, `processMaturityRefund()`가 대출 원리금을 먼저 상환(`PolicyLoanRepaid` 이벤트, loan.active=false로 정산)하고 총환급액($50×70%=$35)에서 대출 원리금을 제한 나머지($20.999995)만 `MaturityRefundPaid`로 지급함을 이벤트 로그로 확인 — 별도 수정 불필요.
- ⚠️ **`<input type="number">`에 포커스된 채로 마우스 휠을 스크롤하면 크롬이 `step` 단위로 값을 조용히 증감시킴** (2026-09-13 발견): "인출 금액에 100을 입력했는데 99.78로 인출됐다"는 보고의 원인 — 페이지를 스크롤하려고 휠을 굴렸는데 마침 포커스가 금액 입력창에 있어서, step=0.01 기준 22틱만큼 감소한 것으로 추정(크롬의 잘 알려진 number input 동작). 컨트랙트/파싱 로직엔 버그 없음(요청한 amount 그대로 정확히 처리됨을 확인). **해결**: `document`에 전역 `wheel` 리스너를 달아 포커스된 요소가 `input[type=number]`이면 즉시 `blur()`시켜, 스크롤이 값을 바꾸지 못하게 함 — 모든 숫자 입력 필드(파우셋/보험료/청구/대출/준비금 등)에 공통 적용됨.
- 대시보드 "내 잔액"/"보험사 잔액" 스탯 카드도 다른 카드들처럼 클릭 시 관련 탭으로 이동함(2026-09-13 추가): 내 잔액 → `showTab('faucet')`, 보험사 잔액 → `showTab('state')`(블록체인 상태 탭의 "보험 재무 현황" 섹션에 상세 수치 있음).
- "준비금 계좌" 탭의 송금 폼에 "송금 가능 금액(내 지갑)" 표시 + "지갑 잔액 전액 입력" 버튼 추가(2026-09-13, 인출 쪽 "예상 잔액 전액 입력"과 대칭 구조) — `_reserveWalletBal` 전역변수에 `refreshReserve()`가 매번 지갑 잔액을 채워둠.
- ⚠️⚠️ **`frontend/index.html`이 `<script src="app.js">`를 캐시 무효화 파라미터 없이 로드하고 있어서, 브라우저가 예전 app.js를 계속 캐싱해 새로고침해도 내 수정사항이 반영 안 되는 것처럼 보이는 문제가 있었음** (2026-09-13 발견). `frontend/serve.json`에 `**/*.@(js|css|html)`에 대해 `Cache-Control: no-cache, no-store, must-revalidate` 헤더를 추가해 해결 — `npx serve .`가 이 파일을 자동으로 읽어 적용함(재시작 필요). **앞으로 app.js/index.html/styles.css를 고친 뒤 "고쳤는데도 그대로다"라는 보고를 받으면, 코드 버그를 의심하기 전에 먼저 이 캐싱 문제부터 배제할 것** — `curl -sI http://localhost:3000/app.js`로 `Cache-Control` 헤더가 제대로 오는지, serve 프로세스가 `serve.json` 추가 이후 재시작됐는지 확인.
- **`Policy.premiumInterval` 필드가 `frontend/app.js`의 `getPolicy` ABI 튜플에 누락되어 있던 버그** (2026-09-13 수정): [[policy-struct-manual-abi-sync]] 메모에 적은 "맨 끝에 추가하면 기존 필드는 안 깨진다"는 맞지만, **새 필드 자체를 프론트엔드에서 쓰려면 결국 ABI에 추가해야 함**을 놓쳤었음 — `loadAutopayStatus()`가 `p.premiumInterval.toString()`을 호출하는데 ABI에 없어 `p.premiumInterval`이 `undefined`라 TypeError가 발생, 이 함수의 try/catch에 걸려 `onBtn.disabled=false`(자동납부 ON 버튼 활성화) 코드까지 도달하지 못해 **"자동납부 ON 버튼을 눌러도 반응이 없는"** 증상으로 나타났음. ABI 튜플 마지막에 `uint256 premiumInterval`을 추가해 해결.

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
- **약관대출 빠른비율 버튼(25%/50%/75%/최대)이 "증권 미선택"과 "선택은 했지만 납입액 0원"을 구분 못함** (수정됨, 2026-09-13): `setLoanAmount()`가 `_loanMaxAmount <= 0n`이면 무조건 "증권을 먼저 선택하세요"를 띄워, 증권을 선택했지만 보험료를 아직 안 낸 경우에도 같은 문구가 나와 혼란을 줌 → 증권 선택 여부를 먼저 확인 후, 미선택은 기존 문구·선택했지만 한도 0이면 "보험료 납입 후 약관대출 가능합니다."로 분리.
- **약관대출 탭이 관리자에게 전체 현황을 보여주지 않음** (수정됨, 2026-09-13): `refreshLoanPolicies()`가 항상 `getPatientPolicies(내 지갑)`만 조회해, 관리자 지갑은 보유 증권이 없어 테이블이 항상 비어 보임 → 다른 탭과 동일하게 관리자는 전체(`getAllPolicyIds()`), 일반 계정은 본인 것만 보이도록 테이블 부분만 수정(대출 신청 드롭다운은 온체인상 본인 소유 증권만 신청 가능하므로 그대로 유지).
- **관리자 화면에 불필요한 "내 잔액" 카드 노출** (수정됨, 2026-09-13): 관리자는 거래 주체가 아니므로 `cardMyBalance`를 `isOwner`일 때 숨김 처리 (`updateAdminOnlyVisibility()`). 같은 원칙으로 준비금 계좌의 `cardReserveMine`도 관리자에게는 숨김.

## 코딩 규칙

- Solidity: `^0.8.20`, OpenZeppelin v5 사용
- JS: ethers v6 (BigInt 기반, `parseUnits`/`formatUnits` 사용)
- 컨트랙트 사이즈 한계 → `hardhat.config.js` optimizer `runs: 1` 유지, 2026-09-13부터 `viaIR: true`도 함께 켜짐(Policy에 필드 추가 후 "Stack too deep" 발생 → viaIR로 해결, 사이즈는 21,884→아래로 오히려 안정적)
- 약관대출 상환 시 approve에 `ethers.MaxUint256` 사용 (일반 금액 쓰면 오류)
- KRW 배포 시 반드시 faucet 먼저 → depositFunds 순서 지켜야 함
- 테스트 상세: `TEST_PROGRESS.md` 참고
- UI 용어: 컨트랙트 USDC/KRW 보유량은 "컨트랙트 잔액"이 아니라 **"보험사 잔액"**으로 표기 (2026-09-13 통일, 신규 텍스트 추가 시 이 용어 유지)
- ⚠️ **hardhat node의 블록체인 시간은 되돌릴 수 없음(단조 증가)**: `evm_increaseTime`/`evm_mine`으로 시간을 앞당기면 영구 반영됨. 실수로 앞당긴 뒤 "테스트니까 원상복구"가 필요하면 **node를 완전히 재시작(재배포 필수)**하는 것 외엔 방법이 없음 — 프론트엔드의 만기/납입 카운트다운은 실제 시각(`Date.now()`) 기준으로 표시되므로, 블록체인 시간이 앞서가면 화면 표시와 컨트랙트 판정이 서로 어긋나 보임 (2026-09-13 실측: 테스트로 3일을 앞당긴 뒤 안 되돌려서 만기일이 "3일 후"로 잘못 보이는 문제 발생 → node 재시작으로 해결).
- ⚠️⚠️ **hardhat node는 트랜잭션이 없으면 `block.timestamp`가 아예 멈춘다(2026-09-13 실측으로 발견한 핵심 원인)**: 기본 설정에서는 새 블록이 트랜잭션이 있을 때만 채굴되므로, 아무도 컨트랙트를 건드리지 않으면 실제 시간이 아무리 흘러도 컨트랙트 입장에선 시간이 안 지난 것으로 남아있음. 그래서 `maturity-watcher.js`/`premium-scheduler.js`가 정상 작동 중이어도 `isMatured()`/`isDue()`가 계속 `false`를 반환해 "분명히 5분 지났는데 자동으로 안 됨"처럼 보이는 문제가 있었음 — 이게 이번 세션에서 자동이체/만기환급 테스트가 여러 번 안 되는 것처럼 보였던 진짜 원인이었음(내가 다른 스크립트로 트랜잭션을 보낼 때마다 우연히 블록이 새로 채굴되면서 그제서야 처리된 것). **해결**: `hardhat.config.js`의 `networks.hardhat.mining.interval`을 4000(ms)으로 설정해 트랜잭션 유무와 상관없이 주기적으로 빈 블록이 채굴되도록 함 — `npx hardhat node`로 새로 띄우면 자동 적용됨. 이미 떠 있는 node에 즉시 적용하려면 `network.provider.send("evm_setIntervalMining", [4000])`를 스크립트로 호출.
- `maturity-watcher.js`/`premium-scheduler.js`의 `MaturityRefundPaid`/`PremiumAutoCollected` **이벤트 리스너(`.on(...)`)는 2026-09-13에 완전히 제거됨**: 두 스크립트 모두 실제 처리 로직은 폴링 루프(`setInterval`)가 전담하고 이벤트 리스너는 단순 로그 출력용 중복 기능이었는데, ethers v6의 `FilterIdEventSubscriber`가 (특히 interval mining으로 블록이 자주 생성될 때) `TypeError: results is not iterable`를 반복적으로 던지는 문제가 있었음. Node 15+ 기본 동작상 처리되지 않은 Promise 거부는 프로세스를 강제 종료시키므로, 이게 `maturity-watcher.js`/`premium-scheduler.js`/`oracle-service.js`가 run.bat으로 띄운 뒤 한동안 지나면 조용히 죽어있는(터미널 창은 남아있어도 내부 node 프로세스는 종료됨) 원인이었음. → 이벤트 리스너 제거(로그 중복이었으므로 기능 손실 없음) + 세 스크립트 전부 최상단에 `process.on("unhandledRejection", ...)` 방어 코드 추가(안전망으로 유지, `oracle-service.js`는 `ClaimSubmitted` 리스너가 실제 처리 로직이라 이벤트 리스너 자체는 남겨둠).
- ⚠️ 재배포(`deploy.js`) 후에는 `frontend/config.json`의 컨트랙트 주소가 바뀌므로 **`maturity-watcher.js`/`oracle-service.js`/`premium-scheduler.js`를 반드시 재시작**해야 새 주소를 읽음 (안 하면 옛 컨트랙트에 대고 계속 폴링/ECONNREFUSED). 여러 프로세스가 각자 다른 시점에 배포를 실행하면(예: 사용자가 직접 run.bat 재실행) 주소가 또 바뀌어 "어느 배포가 최신인지" 헷갈릴 수 있으니, 확인 시 `config.json`의 `deployedAt` 타임스탬프로 최신 배포를 특정할 것.
