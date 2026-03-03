import type { ExtensionFactory } from "@mariozechner/pi-coding-agent";
import type { OAuthCredentials, OAuthLoginCallbacks } from "@mariozechner/pi-ai";

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
					message: "ZAI API 키를 입력하세요 (https://open.bigmodel.cn 에서 발급):",
				});

				if (!apiKey || apiKey.trim().length === 0) {
					throw new Error("API 키가 입력되지 않았습니다.");
				}

				return {
					refresh: "",
					access: apiKey.trim(),
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
