import type { ExtensionFactory } from "@mariozechner/pi-coding-agent";

const AUTH_URL = "https://z.ai/manage-apikey/apikey-list";
const API_BASE_URL = "https://api.z.ai/api/coding/paas/v4";
const VALIDATION_MODEL = "glm-4.7";
const VALIDATION_TIMEOUT_MS = 15_000;

export function normalizeZaiApiKeyInput(input: string): string {
	let value = input.trim();

	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
		value = value.slice(1, -1).trim();
	}

	value = value.replace(/^authorization\s*:\s*/i, "").trim();
	value = value.replace(/^bearer\s+/i, "").trim();

	return value;
}

type FetchLike = typeof fetch;

export async function validateZaiApiKey(
	apiKey: string,
	options?: {
		fetchFn?: FetchLike;
		signal?: AbortSignal;
	},
): Promise<void> {
	const fetchFn = options?.fetchFn ?? fetch;
	const timeoutSignal = AbortSignal.timeout(VALIDATION_TIMEOUT_MS);
	const signal = options?.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;

	const response = await fetchFn(`${API_BASE_URL}/chat/completions`, {
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
		signal,
	});

	if (response.ok) return;

	let details = "";
	try {
		details = (await response.text()).trim();
	} catch {
		// ignore body parse errors, status is enough
	}

	const message = details
		? `Z.AI API key validation failed (${response.status}): ${details}`
		: `Z.AI API key validation failed (${response.status})`;
	throw new Error(message);
}

export const zaiLoginCommandExtension: ExtensionFactory = (pi) => {
	pi.registerCommand("zai-login", {
		description: "Z.AI API key login (oh-my-pi style)",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("/zai-login is only available in interactive mode", "warning");
				return;
			}

			ctx.ui.notify(`Open API key page: ${AUTH_URL}`, "info");

			const input = await ctx.ui.input("Paste your Z.AI API key", "sk-...");
			if (input === undefined) {
				ctx.ui.notify("Z.AI login cancelled", "warning");
				return;
			}

			const apiKey = normalizeZaiApiKeyInput(input);
			if (!apiKey) {
				ctx.ui.notify("API key is required", "error");
				return;
			}

			try {
				ctx.ui.setStatus("zai-login", "Validating Z.AI API key...");
				await validateZaiApiKey(apiKey);
				ctx.modelRegistry.authStorage.set("zai", { type: "api_key", key: apiKey });
				ctx.ui.notify("Z.AI API key saved", "info");
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				ctx.ui.notify(`Failed to login Z.AI: ${message}`, "error");
			} finally {
				ctx.ui.setStatus("zai-login", undefined);
			}
		},
	});
};
