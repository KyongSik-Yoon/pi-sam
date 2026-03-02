# pi-sam

Kotlin/Ktor 백엔드 특화 코딩 에이전트. [pi-mono](https://github.com/mariozechner/pi-mono) SDK 기반.

## 설치

```bash
npm install
npm run build
```

## 사용법

```bash
# 인터랙티브 모드
pi-sam

# 단일 프롬프트
pi-sam "Ktor 라우팅 코드를 리뷰해줘"

# 모델 및 사고 수준 지정
pi-sam -m anthropic/claude-sonnet-4-6 -t high

# 파이프 입력 (print 모드)
echo "analyze this" | pi-sam -p

# 이전 세션 이어가기
pi-sam -c
```

### CLI 옵션

| 옵션 | 설명 |
|------|------|
| `-m, --model <model>` | 사용할 모델 (예: `anthropic/claude-opus-4-6`) |
| `-t, --thinking <level>` | 사고 수준: `off`, `low`, `medium`, `high` |
| `-p, --print` | 비대화형 출력 모드 |
| `-c, --continue` | 최근 세션 이어가기 |
| `-h, --help` | 도움말 |
| `-v, --version` | 버전 출력 |

## 인증

### 환경변수

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
export GEMINI_API_KEY=...
```

### OAuth 로그인

인터랙티브 모드에서 `/login` 명령어로 OAuth 인증:

```
> /login
OAuth Providers:
  1. anthropic
  2. github-copilot
  3. google-gemini-cli
  4. google-antigravity
Select provider (1-4): 1
```

브라우저에서 인증 후 코드를 입력하면 `~/.pi-sam/agent/auth.json`에 토큰이 저장됩니다. SDK가 토큰 리프레시를 자동 처리합니다.

로그아웃: `/logout`

## 워크플로우 명령어

인터랙티브 모드에서 사용할 수 있는 에이전틱 워크플로우:

### `/autopilot <task>`

자율 실행 파이프라인. 탐색부터 검증까지 자동으로 진행합니다.

```
> /autopilot health check 엔드포인트 추가
```

**흐름:** explore (read-only) -> plan (read-only) -> execute (full) -> verify (read-only) -> fix loop (최대 3회)

각 단계는 독립적인 임시 세션에서 실행되며, 이전 단계의 결과가 다음 단계의 컨텍스트로 전달됩니다.

### `/plan <task>`

사용자 승인 후 실행하는 파이프라인.

```
> /plan 인증 미들웨어 리팩토링
```

**흐름:** explore -> plan -> **사용자 승인** -> execute -> verify -> fix loop

계획 단계 후 승인/거절/피드백을 선택할 수 있습니다:
- `y` — 승인 후 실행
- `e` — 피드백 추가 후 실행
- `n` — 거절 (중단)

### `/review <specialty>`

전문가 코드 리뷰를 실행합니다.

```
> /review security        # 보안 리뷰
> /review test            # 테스트 커버리지 리뷰
> /review architecture    # 아키텍처 리뷰
> /review performance     # 성능 리뷰
> /review all             # 모든 리뷰 병렬 실행
```

## 커스텀 도구

| 도구 | 설명 |
|------|------|
| `k8s` | kubectl 래퍼. 위험한 명령어(`delete`, `drain` 등) 차단 |
| `gradle` | Gradle 빌드 도구. `gradlew` 자동 감지, 멀티모듈 지원 |
| `docker` | Docker/Compose 래퍼. 파괴적 명령어(`rm -f`, `system prune` 등) 차단 |

## 안전 장치

### Kotlin Guard Hook

위험한 작업을 차단합니다:
- `rm -rf /`, `git push --force`, `git reset --hard`
- `kubectl delete`, `kubectl drain`
- `docker rm -f`, `docker system prune`
- 프로덕션 설정 파일 수정 (`application-prod.*`, `.env.prod`, `secrets.*`, `keystore.*`)

### Ktor Helper Hook

프로젝트 타입을 자동 감지하여 컨텍스트를 주입합니다:
- Ktor / Spring Boot 프로젝트 타입
- 빌드 시스템 (Gradle Kotlin DSL / Maven)
- Docker / Kubernetes 설정
- 멀티모듈 구조

## 프로젝트 구조

```
src/
  cli.ts              # 진입점
  main.ts             # CLI 로직, 세션 생성, 인터랙티브 루프
  config.ts           # 상수 (APP_NAME, VERSION, 경로)
  system-prompt.ts    # Kotlin/Ktor 특화 시스템 프롬프트
  tools/
    k8s-tool.ts       # kubectl 도구
    gradle-tool.ts    # Gradle 도구
    docker-tool.ts    # Docker 도구
  hooks/
    kotlin-guard.ts   # 위험 명령어 차단
    ktor-helper.ts    # 프로젝트 컨텍스트 자동 주입
  workflows/
    types.ts          # 워크플로우 타입 정의
    engine.ts         # 단계 실행 엔진, verify-fix 루프
    prompts.ts        # 단계별 시스템 프롬프트
    autopilot.ts      # 자율 실행 파이프라인
    plan-execute.ts   # 사용자 승인 파이프라인
    specialists.ts    # 전문가 리뷰
    index.ts          # 슬래시 명령어 디스패치
```

## 워크플로우 아키텍처

```
                    ┌─────────────────────────────────────┐
                    │          Main Session                │
                    │  (interactive loop, user I/O)       │
                    └──────────┬──────────────────────────┘
                               │ /autopilot, /plan, /review
                    ┌──────────▼──────────────────────────┐
                    │       Workflow Engine                │
                    │  (runPhase, runVerifyFixLoop)        │
                    └──────────┬──────────────────────────┘
                               │ createAgentSession + SessionManager.inMemory()
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Explorer  │   │ Executor │   │ Verifier │  ...
        │(read-only)│   │ (full)   │   │(read-only)│
        └──────────┘   └──────────┘   └──────────┘
         독립 세션        독립 세션       독립 세션
```

각 워크플로우 단계는:
- `SessionManager.inMemory()`로 생성된 임시 세션에서 실행
- 단계별로 read-only 또는 full 도구 세트 할당
- 완료 후 자동 dispose (에러 시에도 try/finally로 보장)
- 이전 단계의 요약 텍스트가 다음 단계의 입력으로 전달

## 요구사항

- Node.js >= 20.0.0
- pi-mono SDK (`@mariozechner/pi-coding-agent`, `@mariozechner/pi-ai`, `@mariozechner/pi-tui`)

## 라이선스

Private
