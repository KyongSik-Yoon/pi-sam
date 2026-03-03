import type { ExtensionFactory } from "@mariozechner/pi-coding-agent";
import type { OAuthCredentials, OAuthLoginCallbacks } from "@mariozechner/pi-ai";

const AUTH_URL = "https://z.ai/manage-apikey/apikey-list";
const API_BASE_URL = "https://api.z.ai/api/coding/paas/v4";
const VALIDATION_MODEL = "glm-4.7";
const VALIDATION_TIMEOUT_MS = 15_000;

/**
 * ZAI API에 chat/completions 요청을 보내 키가 유효한지 검증합니다.
 * oh-my-pi의 validateOpenAICompatibleApiKey 방식과 동일.
 */
async function validateApiKey(apiKey: string): Promise<void> {
	const response = await fetch(`${API_BASE_URL}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: VALIDATION_MODEL,
			messages: [{ role: "user", content: "ping" }],
			max_tokens: 1,
			temperature: 0,
		}),
		signal: AbortSignal.timeout(VALIDATION_TIMEOUT_MS),
	});

	if (!response.ok) {
		const body = await response.text().catch(() => "");
		const message = body
			? `Z.AI API 키 검증 실패 (${response.status}): ${body}`
			: `Z.AI API 키 검증 실패 (${response.status})`;
		throw new Error(message);
	}
}

/**
 * ZAI(GLM) API 키 로그인 확장.
 * /login 메뉴에 "Z.AI (GLM Coding Plan)" 옵션을 추가하여
 * API 키를 인터랙티브하게 입력받아 auth.json에 저장합니다.
 */
export const zaiLoginExtension: ExtensionFactory = (pi) => {
	pi.registerProvider("zai", {
		oauth: {
			name: "Z.AI (GLM Coding Plan)",

			async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
				// 브라우저에서 API 키 관리 페이지 열기
				callbacks.onAuth({
					url: AUTH_URL,
					instructions: "Copy your API key from the dashboard",
				});

				const apiKey = await callbacks.onPrompt({
					message: "Paste your Z.AI API key",
					placeholder: "sk-...",
				});

				if (!apiKey || apiKey.trim().length === 0) {
					throw new Error("API key is required");
				}

				const trimmedKey = apiKey.trim();

				callbacks.onProgress?.("Validating API key...");
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
