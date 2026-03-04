import type { ExtensionFactory } from "@mariozechner/pi-coding-agent";

/**
 * /help 명령어를 등록하는 확장
 * pi-sam의 사용 가능한 슬래시 명령어들을 표시합니다.
 */
export function helpExtension(): ExtensionFactory {
	return (pi) => {
		pi.registerCommand("help", {
			description: "사용 가능한 명령어 표시",
			handler: async (_args, ctx) => {
				const helpText = [
					"## pi-sam 도움말",
					"",
					"### 워크플로우 명령어",
					"",
					"| 명령어 | 설명 |",
					"|--------|------|",
					"| `/autopilot <task>` | 자율 실행 파이프라인 (탐색 → 계획 → 실행 → 검증 → 수정 루프) |",
					"| `/plan <task>` | 계획 후 사용자 승인 → 실행 |",
					"| `/review <specialty>` | 전문가 코드 리뷰 (security, test, architecture, performance, all) |",
					"",
					"### pi 코딩 에이전트 명령어",
					"",
					"| 명령어 | 설명 |",
					"|--------|------|",
					"| `/model` | 모델 변경 |",
					"| `/resume` | 세션 이어가기 |",
					"| `/new` | 새 세션 시작 |",
					"| `/tree` | 세션 트리 탐색 |",
					"| `/fork` | 현재 세션 포크 |",
					"| `/zai-login` | Z.AI API 키 로그인 |",
					"",
					"### 단축키",
					"",
					"| 키 | 동작 |",
					"|----|------|",
					"| `Tab` | 자동완성 |",
					"| `Escape` | 취소/중단 |",
					"| `Ctrl+O` | 도구 출력 접기/펼치기 |",
					"| `Ctrl+T` | 사고 블록 접기/펼치기 |",
					"",
					"상세한 도움말: [pi-sam README](https://github.com/mariozechner/pi-sam)",
				].join("\n");

				pi.sendUserMessage(helpText);
			},
		});
	};
}
