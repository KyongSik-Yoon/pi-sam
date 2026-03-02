# pi-sam: Kotlin/Ktor Backend 특화 코딩 에이전트

## 개요

pi-mono SDK(`@mariozechner/pi-coding-agent`)를 기반으로, Kotlin/Ktor 백엔드, MSA, K8s, 모니터링 도구 개발에 특화된 CLI 코딩 에이전트를 구축합니다.

---

## 아키텍처

```
pi-sam/
├── package.json              # 프로젝트 메타, 의존성, bin 등록
├── tsconfig.json             # TypeScript 설정
├── src/
│   ├── cli.ts                # #!/usr/bin/env node 진입점
│   ├── main.ts               # CLI 인자 파싱 → createAgentSession 호출 → 모드 실행
│   ├── config.ts             # APP_NAME, VERSION, 디렉토리 경로 상수
│   ├── system-prompt.ts      # Kotlin/Ktor/MSA/K8s 특화 시스템 프롬프트
│   ├── tools/
│   │   ├── index.ts          # 커스텀 도구 모음 + 빌트인 도구 조합
│   │   ├── k8s-tool.ts       # kubectl 래퍼 도구 (pods, logs, describe 등)
│   │   ├── gradle-tool.ts    # Gradle 빌드/테스트 도구
│   │   └── docker-tool.ts    # Docker/docker-compose 도구
│   ├── extensions/
│   │   ├── index.ts          # 확장 팩토리 모음
│   │   ├── kotlin-guard.ts    # Kotlin/Ktor 코드 품질 게이트 (bash에서 rm -rf 차단 등)
│   │   └── ktor-helper.ts    # Ktor 프로젝트 패턴 인식, 라우팅/플러그인 구조 힌트
│   └── interactive/
│       ├── interactive-mode.ts  # pi TUI 기반 인터랙티브 모드 (커스텀 헤더/푸터)
│       └── theme.ts           # pi-sam 전용 테마 컬러
├── AGENTS.md                 # pi-sam 에이전트 가이드라인 (컨텍스트 파일)
└── README.md                 # 사용법 문서
```

pi-mono 패키지와의 관계:
```
@mariozechner/pi-ai           → LLM API (모델 선택, 스트리밍)
@mariozechner/pi-agent-core   → 에이전트 루프 (자동 의존)
@mariozechner/pi-coding-agent → SDK: createAgentSession, 빌트인 도구, 확장 시스템, 세션, TUI
@mariozechner/pi-tui          → TUI 컴포넌트 (Editor, Markdown, Loader 등)
```

---

## 구현 단계

### Phase 1: 프로젝트 초기 설정

1. **package.json 생성**
   - `name`: `pi-sam`
   - `type`: `"module"`
   - `bin`: `{ "pi-sam": "./dist/cli.js" }`
   - 의존성: `@mariozechner/pi-coding-agent`, `@mariozechner/pi-ai`, `@mariozechner/pi-tui`, `chalk`
   - devDependencies: `typescript`, `tsx`, `@types/node`
   - scripts: `build`, `dev`, `start`

2. **tsconfig.json 생성**
   - `target`: `ES2022`, `module`: `NodeNext`
   - pi-mono 패턴과 동일하게 설정

3. **npm install 실행**

### Phase 2: 코어 파일 구현

4. **`src/config.ts`** - 상수 정의
   - `APP_NAME = "pi-sam"`
   - `VERSION = "0.1.0"`
   - `getAgentDir()` → `~/.pi-sam/agent`
   - 디렉토리 관련 경로 함수

5. **`src/system-prompt.ts`** - 특화 시스템 프롬프트
   - Kotlin/Ktor 백엔드 전문가 페르소나
   - Ktor 서버 아키텍처 (라우팅, 플러그인, Koin DI, Exposed ORM 등)
   - MSA 아키텍처 패턴 가이드 (서비스 분리, API Gateway, 서비스 디스커버리)
   - Kubernetes 운영 베스트 프랙티스
   - Gradle (Kotlin DSL) 빌드 시스템 지식
   - 모니터링 도구 (Prometheus, Grafana, APM) 지식
   - Java/Spring Boot 프로젝트도 보조적으로 지원
   - 한국어 + 영어 이중언어 대응

6. **`src/cli.ts`** - 진입점 (얇은 래퍼)
   ```typescript
   #!/usr/bin/env node
   process.title = "pi-sam";
   import { main } from "./main.js";
   main(process.argv.slice(2));
   ```

7. **`src/main.ts`** - 메인 로직
   - CLI 인자 파싱 (최소: `--model`, `--thinking`, `--print`, `-c` continue)
   - `AuthStorage`, `ModelRegistry` 초기화
   - `DefaultResourceLoader` 커스텀 설정 (systemPromptOverride, extensionFactories)
   - `createAgentSession()` 호출
   - InteractiveMode 또는 PrintMode 실행

### Phase 3: 커스텀 도구 구현

8. **`src/tools/k8s-tool.ts`** - Kubernetes 도구
   - `kubectl get pods/services/deployments` 래퍼
   - `kubectl logs` 스트리밍
   - `kubectl describe` 리소스 상세
   - 네임스페이스 지정 지원
   - 안전 장치: `delete`, `drain` 명령 차단 (확인 필요)

9. **`src/tools/gradle-tool.ts`** - Gradle 도구
   - `gradle build`, `gradle test` 실행
   - 테스트 결과 요약 파싱
   - `gradle dependencies` 의존성 트리
   - 빌드 실패 시 에러 하이라이팅

10. **`src/tools/docker-tool.ts`** - Docker 도구
    - `docker ps`, `docker logs` 래퍼
    - `docker-compose up/down/logs`
    - 이미지 빌드 상태

11. **`src/tools/index.ts`** - 도구 통합
    - 빌트인 도구 (read, edit, write, bash, grep, find, ls) + 커스텀 도구 조합

### Phase 4: 확장 구현

12. **`src/extensions/kotlin-guard.ts`** - 안전 장치 확장
    - `tool_call` 이벤트 훅: bash에서 위험 명령 차단
    - `kubectl delete`, `docker rm -f`, `gradle clean` 시 확인 요청
    - `.env`, `application-prod.yml`, `application-prod.conf` 등 민감 파일 수정 경고

13. **`src/extensions/ktor-helper.ts`** - Ktor 프로젝트 도우미
    - `agent_start` 시 프로젝트 구조 스캔 (`build.gradle.kts`, `application.conf`/`application.yaml` 탐지)
    - `context` 이벤트: Ktor 프로젝트 메타데이터를 컨텍스트에 주입 (모듈, 플러그인, 라우팅 구조)
    - Gradle Kotlin DSL 빌드 파일 인식
    - Spring Boot 프로젝트도 폴백으로 감지 (`pom.xml`, `build.gradle`)

14. **`src/extensions/index.ts`** - 확장 통합
    - 모든 확장 팩토리를 배열로 export

### Phase 5: 인터랙티브 모드

15. **`src/interactive/interactive-mode.ts`**
    - pi의 `InteractiveMode`를 직접 임포트하여 사용
    - 커스텀 옵션 전달 (초기 메시지 등)
    - pi의 TUI 전체를 재사용 (가장 효율적)

    > 참고: pi의 InteractiveMode는 `AgentSession`을 받아서 동작하므로,
    > 커스텀 세션만 만들면 TUI는 그대로 사용 가능.

### Phase 6: AGENTS.md 및 완성

16. **`AGENTS.md`** 작성
    - Kotlin 코딩 컨벤션 (코루틴, sealed class, data class 등)
    - Ktor 프로젝트 구조 가이드 (모듈, 플러그인, 라우팅, DI)
    - K8s 매니페스트 작성 규칙
    - Gradle Kotlin DSL 빌드 규칙

17. **빌드 & 테스트**
    - `npm run build` 확인
    - `npx tsx src/cli.ts` 로 직접 실행 테스트
    - 간단한 프롬프트로 동작 확인

---

## 핵심 기술 결정

| 결정 | 선택 | 이유 |
|------|------|------|
| TUI | pi InteractiveMode 재사용 | 수천 줄 재작성 불필요. AgentSession만 커스텀하면 됨 |
| 도구 등록 | Extension의 `pi.registerTool()` | pi SDK 권장 방식. `customTools` 옵션보다 유연 |
| 시스템 프롬프트 | `systemPromptOverride` | pi 기본 프롬프트 위에 특화 내용 추가 |
| 세션 관리 | `SessionManager.create()` 기본값 | 디스크 지속성 지원, `~/.pi-sam/sessions/` |
| 모델 | `getModel("anthropic", "claude-sonnet-4-20250514")` 기본 | 사용자가 `--model`로 변경 가능 |

---

## 실행 방법 (완성 후)

```bash
# 개발 중 실행
cd pi-sam
npx tsx src/cli.ts

# 빌드 후 실행
npm run build
node dist/cli.js

# 글로벌 설치
npm link
pi-sam

# 특정 모델로 실행
pi-sam --model anthropic/claude-opus-4-5 --thinking high

# 비인터랙티브 모드
echo "이 Ktor 라우팅 코드를 리뷰해줘" | pi-sam --print
```

---

## 예상 파일 수: ~15개
## 예상 코드량: ~800-1200줄 (TUI 재사용 덕분에 최소화)
