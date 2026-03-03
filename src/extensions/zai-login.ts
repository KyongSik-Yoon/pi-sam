import type { ExtensionFactory } from "@mariozechner/pi-coding-agent";
import type { OAuthCredentials, OAuthLoginCallbacks } from "@mariozechner/pi-ai";

const ZAI_BASE_URL = "https://api.z.ai/api/coding/paas/v4";

/**
 * ZAI API에 테스트 요청을 보내 키가 유효한지 검증합니다.
 */
async function validateApiKey(apiKey: string): Promise<void> {
	const response = await fetch(`${ZAI_BASE_URL}/models`, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${apiKey}`,
		},
	});

	if (!response.ok) {
		const body = await response.text().catch(() => "");
		if (response.status === 401) {
			throw new Error("API 키가 유효하지 않습니다. 키를 확인해 주세요.");
		}
		throw new Error(`API 키 검증 실패 (${response.status}): ${body}`);
	}
}

/**
 * ZAI(GLM) API 키 로그인 확장.
 * /login 메뉴에 "ZAI (GLM)" 옵션을 추가하여
 * API 키를 인터랙티브하게 입력받아 auth.json에 저장합니다.
 */
export const zaiLoginExtension: ExtensionFactory = (pi) => {
	pi.registerProvider("zai", {
		oauth: {
			name: "ZAI (GLM)",

			async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
				const apiKey = await callbacks.onPrompt({
					message: "ZAI API 키를 입력하세요 (https://z.ai 에서 발급):",
				});

				if (!apiKey || apiKey.trim().length === 0) {
					throw new Error("API 키가 입력되지 않았습니다.");
				}

				const trimmedKey = apiKey.trim();

				callbacks.onProgress?.("API 키 검증 중...");
				await validateApiKey(trimmedKey);

				return {
					refresh: "",
					access: trimmedKey,
					expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
				};
			},

			async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
				return credentials;
			},

			getApiKey(credentials: OAuthCredentials): string {
				return credentials.access;
			},
		},
	});
};
