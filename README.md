```
  ╔═╗ ╦   ╔═╗ ╔═╗ ╔╦╗
  ╠═╝ ║ ─ ╚═╗ ╠═╣ ║║║
  ╩   ╩   ╚═╝ ╩ ╩ ╩ ╩
```

# pi-sam

Kotlin/Ktor 백엔드 특화 코딩 에이전트. [pi-mono](https://github.com/mariozechner/pi-mono) SDK 기반.

## 설치

### 사용자 설치 (npm)

```bash
npm i -g pi-sam
pi-sam --help
```

또는 1회 실행:

```bash
npx pi-sam --help
```

### 개발 환경 설치

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

인터랙티브 모드에서 `/login` 명령어로 OAuth 인증 (pi 내장 명령어):

```
> /login
```

브라우저에서 인증 후 `~/.pi-sam/agent/auth.json`에 토큰이 저장됩니다. SDK가 토큰 리프레시를 자동 처리합니다.

### Z.AI API 키 로그인 (oh-my-pi 스타일)

Z.AI는 OAuth 대신 API 키를 사용합니다. 인터랙티브 모드에서 아래 명령으로 키를 저장할 수 있습니다.

```
> /zai-login
```

동작:
1. Z.AI API 키 페이지 URL을 안내
2. 키 입력 프롬프트 표시
3. `chat/completions`로 키 유효성 검증
4. `~/.pi-sam/agent/auth.json`에 `api_key`로 저장

모델 변경: `/model` 또는 `Ctrl+P`

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

계획 단계 후 승인/거절을 선택할 수 있습니다 (pi TUI 확인 대화상자).

### `/review <specialty>`

전문가 코드 리뷰를 실행합니다. 에이전트 디스커버리를 통해 사용 가능한 리뷰어를 자동으로 감지합니다.

```
> /review security        # 보안 리뷰
> /review test            # 테스트 커버리지 리뷰
> /review architecture    # 아키텍처 리뷰
> /review performance     # 성능 리뷰
> /review all             # 모든 리뷰 병렬 실행
```

커스텀 리뷰어를 추가하면 자동으로 `/review` 옵션에 나타납니다.

### 실시간 프로그레스

워크플로우 실행 중 각 단계의 진행 상황이 TUI에 실시간으로 표시됩니다:
- 현재 실행 중인 단계와 에이전트 이름
- 사용된 도구 수와 경과 시간
- 완료/실패 상태

### 구조화된 리뷰 결과

리뷰 결과는 severity 별로 구조화되어 표시됩니다:
- 🔴 **critical** — 즉시 수정 필요
- 🟠 **high** — 높은 우선순위
- 🟡 **medium** — 중간 우선순위
- 🔵 **low** — 낮은 우선순위
- ⚪ **info** — 참고 사항

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

## 커스텀 에이전트

에이전트 정의를 `.md` 파일로 작성하여 워크플로우를 확장할 수 있습니다.

### 에이전트 정의 파일 형식

```markdown
---
name: reviewer-kotlin
description: Kotlin idiom review
tools: readonly
thinkingLevel: medium
specialty: kotlin
---

## Role: Kotlin Reviewer
Kotlin 코드의 관용적 패턴과 컨벤션을 리뷰합니다.

### Output Format
**Status:** PASS or FAIL
**Findings:**
- [severity] [File:Line] Description
```

### Frontmatter 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `name` | string | 에이전트 이름 (필수) |
| `description` | string | 설명 |
| `tools` | `"full"` \| `"readonly"` | 도구 접근 수준 |
| `model` | string | 모델 오버라이드 (예: `anthropic/claude-haiku-3-5-20241022`) |
| `thinkingLevel` | `"off"` \| `"low"` \| `"medium"` \| `"high"` | 사고 수준 |
| `extractVerifyResult` | boolean | 검증 결과 자동 추출 |
| `specialty` | string | 리뷰 전문 분야 (`/review` 커맨드에 자동 등록) |

### 에이전트 디스커버리 경로

우선순위 순 (나중이 우선):

1. **번들드**: `src/agents/bundled/*.md` (8개 기본 에이전트)
2. **사용자 레벨**: `~/.pi-sam/agent/agents/*.md`
3. **프로젝트 레벨**: `.pi-sam/agents/*.md` (최우선)

같은 이름의 에이전트는 우선순위가 높은 것이 덮어씁니다.

### 에이전트별 모델 오버라이드

비용 최적화를 위해 에이전트별로 다른 모델과 사고 수준을 지정할 수 있습니다:

- **Explorer/Verifier**: `thinkingLevel: low` — 빠른 탐색/검증
- **Planner/Executor**: `thinkingLevel: medium` — 균형 잡힌 실행
- **Reviewer**: `thinkingLevel: medium` — 꼼꼼한 리뷰

## 프로젝트 구조

```
src/
  cli.ts              # 진입점
  main.ts             # CLI 로직, 세션 생성, InteractiveMode/runPrintMode 실행
  config.ts           # 상수 (APP_NAME, VERSION, 경로)
  system-prompt.ts    # Kotlin/Ktor 특화 시스템 프롬프트
  agents/
    types.ts          # AgentDefinition, ReviewFinding, 파서
    discovery.ts      # 에이전트 디스커버리 (bundled/user/project)
    index.ts          # barrel export
    bundled/          # 8개 기본 에이전트 .md 파일
      explorer.md
      planner.md
      executor.md
      verifier.md
      reviewer-security.md
      reviewer-test.md
      reviewer-architecture.md
      reviewer-performance.md
  tools/
    k8s-tool.ts       # kubectl 도구
    gradle-tool.ts    # Gradle 도구
    docker-tool.ts    # Docker 도구
  hooks/
    kotlin-guard.ts   # 위험 명령어 차단
    ktor-helper.ts    # 프로젝트 컨텍스트 자동 주입
  extensions/
    workflow-extension.ts  # 워크플로우 슬래시 명령어 (/autopilot, /plan, /review)
  workflows/
    types.ts          # 워크플로우 타입 정의 (PhaseProgress 포함)
    engine.ts         # 단계 실행 엔진, verify-fix 루프, 프로그레스 추적
    autopilot.ts      # 자율 실행 파이프라인
    plan-execute.ts   # 사용자 승인 파이프라인
    specialists.ts    # 전문가 리뷰
    index.ts          # 워크플로우 re-exports
```

## 워크플로우 아키텍처

```
                    ┌─────────────────────────────────────┐
                    │          Main Session                │
                    │  (InteractiveMode, pi TUI)          │
                    └──────────┬──────────────────────────┘
                               │ /autopilot, /plan, /review
                    ┌──────────▼──────────────────────────┐
                    │       Workflow Engine                │
                    │  (runPhase, runVerifyFixLoop)        │
                    │  + Progress Tracking                │
                    │  + Structured Review Results         │
                    └──────────┬──────────────────────────┘
                               │
                    ┌──────────▼──────────────────────────┐
                    │     Agent Discovery                  │
                    │  bundled/*.md → user → project       │
                    └──────────┬──────────────────────────┘
                               │ createAgentSession + per-agent model/thinking
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Explorer  │   │ Executor │   │ Verifier │  ...
        │(readonly) │   │ (full)   │   │(readonly) │
        │ low think │   │ med think│   │ low think │
        └──────────┘   └──────────┘   └──────────┘
         독립 세션        독립 세션       독립 세션
```

각 워크플로우 단계는:
- `SessionManager.inMemory()`로 생성된 임시 세션에서 실행
- `.md` 파일에서 로드된 에이전트 정의 사용
- 에이전트별 모델 및 thinking level 오버라이드
- 단계별로 read-only 또는 full 도구 세트 할당
- 실시간 프로그레스 추적 (tool count, 경과 시간)
- 구조화된 리뷰 결과 파싱 (severity, file, line)
- 완료 후 자동 dispose (에러 시에도 try/finally로 보장)
- 이전 단계의 요약 텍스트가 다음 단계의 입력으로 전달

## 요구사항

- Node.js >= 20.0.0
- pi-mono SDK (`@mariozechner/pi-coding-agent`, `@mariozechner/pi-ai`, `@mariozechner/pi-tui`)

## npm 배포 (Maintainer)

```bash
# 1) 빌드
npm run build

# 2) 패키지 포함 파일 확인
npm run pack:dry-run

# 3) npm 로그인 (최초 1회)
npm login

# 4) 배포
npm publish --access public
```

버전 업데이트 후 배포:

```bash
npm version patch   # 또는 minor / major
npm publish
```

GitHub Actions 자동 배포도 지원합니다 (`.github/workflows/npm-publish.yml`):
- 태그 푸시 (`v*`) 시 publish 실행
- 저장소 Secret에 `NPM_TOKEN` 필요

## 라이선스

MIT
