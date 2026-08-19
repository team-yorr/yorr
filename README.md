<div align="center">
  <img src="frontend/public/mascot-favicon.svg" alt="YORR mascot" width="112" />

  # YORR (요르)

  **휴대폰을 흔들고, 휘두르고, 탭하며 함께 즐기는 실시간 웹 게임 플랫폼**

  [서비스 바로가기](https://yorr.site) · [프론트엔드 문서](frontend/docs/index.md) · [협업 가이드](CONTRIBUTING.md)

  <p>
    <img src="https://img.shields.io/badge/최고_동시접속-80명-1D3557?style=flat-square" />
    <img src="https://img.shields.io/badge/누적_게임_참여-635건-1D3557?style=flat-square" />
    <img src="https://img.shields.io/badge/플레이-487판-1D3557?style=flat-square" />
    <img src="https://img.shields.io/badge/배포-2회_(7월_30일·8월_5일)-2E8B57?style=flat-square" />
  </p>
</div>

## 프로젝트 소개

YORR는 별도 앱 설치 없이 모바일 브라우저에서 즐길 수 있는 멀티플레이 게임 서비스입니다.
방을 만들거나 빠른 대전으로 상대를 찾고, 초대 코드·링크·QR로 친구를 초대할 수 있습니다.
휴대폰의 모션 센서를 게임 조작에 활용하며, 센서를 사용할 수 없는 환경에서도 화면 조작으로
끝까지 플레이할 수 있습니다.

2026년 7월 30일 요트 다이스를 처음 배포한 뒤 사용자 피드백을 받아 개선했고,
8월 5일 탁구와 석양이 진다를 추가로 배포했습니다.

<!-- TODO: 파티 모드 / 온라인 모드 스크린샷 2장 삽입 -->
<!-- 예: <img src="docs/images/play-mode.png" width="100%" /> -->

### 플레이 가능한 게임

| 게임 | 인원 | 조작 | 설명 |
|---|---:|---|---|
| 요트 다이스 | 1–6명 | 휴대폰 흔들기 · 화면 탭 | 최대 세 번 주사위를 굴리고 킵하며 12개 족보의 최고 점수를 완성합니다. |
| 탁구 | 1–2명 | 화면 탭 · 휴대폰 스윙 | 먼저 11점을 얻는 플레이어가 승리하는 빠른 랠리 게임입니다. |
| 석양이 진다 | 2명 | 화면 탭 · 휴대폰 휘두르기 | 신호에 맞춰 먼저 공격하는 반응 속도 대결입니다. |

요트 다이스와 탁구는 혼자 플레이할 경우 AI 봇과 대결합니다.
라이어스 다이스와 낚시는 다음 릴리스를 목표로 개발 중입니다.

<!-- TODO: 게임 3종 플레이 화면 스크린샷 삽입 -->
<!-- 예: <img src="docs/images/play-game.png" width="100%" /> -->

## 주요 기능

- 게스트 입장 및 카카오·구글 소셜 로그인
- 방 생성, 초대 코드·링크·QR 참가, 빠른 대전
- WebSocket 기반 실시간 방·게임 상태 동기화와 재접속 복구
- 휴대폰 모션 센서 기반 조작과 탭 조작 대체 수단
- 큰 화면과 여러 휴대폰을 연결하는 파티 모드
- 탁구 전용 휴대폰 컨트롤러 페어링
- WebRTC 기반 방 음성 채팅
- 주간 랭킹과 게임 결과 기록

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | React 19, TypeScript, Vite, TanStack Router, Zustand |
| UI · 그래픽 | Tailwind CSS 4, Motion, Three.js, Rapier |
| Backend | Java 21, Spring Boot 4.1, Spring MVC, Spring WebSocket |
| Data | MySQL 8, Redis 7, JPA, Flyway |
| Realtime | WebSocket, WebRTC, coturn (TURN) |
| Test | Vitest, Testing Library, Playwright, JUnit 5, Testcontainers |
| Infra | Docker Compose, Nginx, Jenkins, Vercel, Prometheus, Grafana |

## 아키텍처

<!-- TODO: 전체 아키텍처 다이어그램 이미지 삽입 -->
<!-- 예: <img src="docs/images/architecture.png" width="100%" /> -->

```text
Mobile / Desktop Browser
        │
        ├── REST API      ──┐
        ├── WebSocket     ──┤
        └── WebRTC (음성)    │   ※ P2P 직결. 시그널링만 WebSocket 경유
              ⇅              ▼
        coturn TURN     Nginx 리버스 프록시  ── AWS EC2
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
             main (운영)           dev (검증)
             Spring Boot          Spring Boot
                │      │             │     │
                ▼      ▼             ▼     ▼
             MySQL   Redis        MySQL  Redis
          계정·전적·랭킹  방·세션·게임 상태
```

서버가 방과 게임 상태의 최종 권위자이며, 클라이언트는 WebSocket 이벤트와 재접속 스냅샷으로
상태를 동기화합니다. 음성 데이터만 WebRTC로 참가자 사이에서 직접 전달하고, 연결을 위한
시그널링은 기존 WebSocket을 사용합니다. NAT 환경의 클라이언트를 위해 coturn TURN 서버를
함께 운영합니다.

배포 환경과 동일한 구성의 개발 서버를 별도로 두어, 검증을 마친 변경만 운영에 반영합니다.
Jenkins가 저장소를 주기적으로 확인해 백엔드는 Docker로, 프론트엔드는 Vercel로 배포하며
Prometheus와 Grafana로 인프라 지표와 게임별 실시간 통계를 함께 수집합니다.

## 로컬 실행

### 준비 사항

- Java 21
- Node.js 22.12 이상과 npm
- Docker 및 Docker Compose

### 1. 백엔드 실행

```bash
cd backend
cp .env.example .env
```

`.env`의 `DB_PASSWORD`에 로컬 개발용 비밀번호를 설정한 뒤 실행합니다. 소셜 로그인 기능을
개발하지 않는 경우 OAuth 관련 값은 비워 두어도 됩니다.

```bash
# macOS / Linux
./gradlew bootRun

# Windows
gradlew.bat bootRun
```

Spring Boot가 `compose.yaml`을 통해 MySQL과 Redis를 함께 시작합니다.

- API: `http://localhost:8080/api/v1`
- WebSocket: `ws://localhost:8080/ws/v1/game`
- Swagger UI: `http://localhost:8080/swagger-ui/index.html`
- Health check: `http://localhost:8080/actuator/health`

### 2. 프론트엔드 실행

새 터미널에서 다음 명령을 실행합니다.

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

기본 개발 모드는 MSW로 API를 모의하므로 백엔드 없이도 UI를 확인할 수 있습니다.
`http://localhost:5173`에서 접속할 수 있습니다.

로컬 백엔드와 연결하려면 `.env.local`에 아래 값을 설정하고 실서버 모드로 실행합니다.

```dotenv
VITE_API_BASE_URL=/api/v1
VITE_WS_URL=/ws/v1/game
VITE_ENABLE_MSW=false
VITE_BACKEND_ORIGIN=http://localhost:8080
```

```bash
npm run dev:real
```

> Windows PowerShell에서는 `cp` 대신 `Copy-Item .env.example .env` 또는
> `Copy-Item .env.example .env.local`을 사용할 수 있습니다.

## 테스트와 품질 검사

### Frontend

```bash
cd frontend
npm run check
npm run typecheck
npm test
npm run build
npm run test:e2e
```

실제 백엔드와 연결하는 E2E 테스트는 백엔드를 먼저 실행한 뒤 `npm run test:e2e:real`로 수행합니다.

### Backend

```bash
cd backend
./gradlew test
```

Windows에서는 `./gradlew` 대신 `gradlew.bat`을 사용합니다. 일부 통합 테스트는 Docker가
실행 중이어야 합니다.

## 디렉터리 구조

```text
.
├── frontend/              # React 기반 모바일 웹 클라이언트
│   ├── src/               # 도메인 중심 애플리케이션 코드
│   ├── e2e/               # Playwright 브라우저 테스트
│   └── docs/              # 제품·아키텍처·API 문서
├── backend/               # Spring Boot API 및 실시간 게임 서버
│   └── src/
│       ├── main/          # 애플리케이션 코드와 DB 마이그레이션
│       └── test/          # 단위·통합 테스트
├── deploy/                # 운영용 Docker Compose 설정
├── Jenkinsfile            # 검증 및 배포 파이프라인
└── CONTRIBUTING.md        # Git 브랜치·커밋·MR 규칙
```

## 문서

- [현재 구현 기준](frontend/docs/current-baseline.md)
- [아키텍처와 기술 스택](frontend/docs/engineering/architecture-and-stack.md)
- [실시간 통신 및 REST API](frontend/docs/api/realtime-and-api.md)
- [사용자 흐름](frontend/docs/product/user-flow.md)
- [요트 다이스 규칙](frontend/docs/product/yacht-rules.md)
- [백엔드 게임 세션 연동](backend/GAME_SESSION_INTEGRATION.md)

## 팀 구성

| 이름 | 역할 | 담당 |
|---|---|---|
| 이정현 | PM · 팀장 | WebSocket 이벤트 프로토콜 설계(sys·room·dice·reaction·voice 페이로드 및 봉투 규격, 프론트 미러 타입 동기화), WebRTC 풀메시 음성 채팅(백엔드 ICE 시그널링 + 프론트 voiceMesh), 라운드 동기화·타임아웃 처리 구조 설계(domain·application·infrastructure 3계층 분리), 오디오 시스템(족보 콜아웃·굴림 사운드·볼륨 제어·iOS 대응), Git 컨벤션 수립 및 MR 통합·릴리스 관리 |
| 박재영 | Backend | 게스트 세션 관리, 방 생성·참가, 게임 상태 Redis 저장, WebSocket 재연결, 게임 모듈화·빠른 대전 |
| 고용훈 | Backend | 실시간 게임 서버 코어 — 서버 권위 주사위 생성·턴 마감 자동 굴림, Redis 방 상태 관리(sliding TTL·고아 라운드 스윕·빈 방 정리), 카카오·구글 소셜 로그인과 회원/프로필 API, 경기 결과 영구 저장 + 주간 랭킹 API, '석양이 진다' 서버 이식 |
| 정유진 | Frontend | 프론트엔드 개발환경·API 기반 구축, 입장/대기실·QR 초대·세션 복구, 3D 주사위·모션 조작, 파티/빠른대전·폰 컨트롤러, 라이어스 다이스·요트·AI 탁구, 반응형 UI·디자인 시스템, 구조 리팩터링, QA·테스트·문서화 |
| 유상은 | AI · Backend | Expectimax 기반 요트 AI 봇, 탁구 게임 이식 및 파티 컨트롤러 |
| 이유정 | Infra | EC2 개발·운영 환경 설정, Jenkins CI/CD 파이프라인, Prometheus·Grafana 모니터링 |

## 협업 규칙

Git 작업 규칙의 단일 기준은 [CONTRIBUTING.md](CONTRIBUTING.md)입니다. `main`과 `develop`에는
직접 커밋하지 않으며, Jira 이슈 단위의 작업 브랜치에서 변경한 뒤 리뷰를 거쳐 `develop`으로
Merge Request를 생성합니다.
