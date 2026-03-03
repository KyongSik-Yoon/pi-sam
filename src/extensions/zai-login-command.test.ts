import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeZaiApiKeyInput, validateZaiApiKey } from "./zai-login-command.js";

describe("zai-login-command", () => {
	it("normalizes Authorization/Bearer prefixes", () => {
		assert.equal(normalizeZaiApiKeyInput("Bearer sk-abc"), "sk-abc");
		assert.equal(normalizeZaiApiKeyInput("Authorization: Bearer sk-abc"), "sk-abc");
		assert.equal(normalizeZaiApiKeyInput("  'sk-abc'  "), "sk-abc");
	});

	it("validates key using OpenAI-compatible chat/completions payload", async () => {
		let calledUrl = "";
		let calledInit: RequestInit | undefined;

		const fakeFetch: typeof fetch = async (input, init) => {
			calledUrl = typeof input === "string" ? input : input.toString();
			calledInit = init;
			return new Response("{}", { status: 200 });
		};

		await validateZaiApiKey("sk-test", { fetchFn: fakeFetch });

		assert.equal(calledUrl, "https://api.z.ai/api/coding/paas/v4/chat/completions");
		assert.equal(calledInit?.method, "POST");
		assert.equal((calledInit?.headers as Record<string, string>)?.Authorization, "Bearer sk-test");
		assert.equal((calledInit?.headers as Record<string, string>)?.["Content-Type"], "application/json");

		const body = JSON.parse(String(calledInit?.body));
		assert.equal(body.model, "glm-4.7");
		assert.equal(body.messages?.[0]?.content, "ping");
		assert.equal(body.max_tokens, 1);
	});

	it("throws detailed error when validation fails", async () => {
		const fakeFetch: typeof fetch = async () => {
			return new Response('{"error":"unauthorized"}', { status: 401 });
		};

		await assert.rejects(
			() => validateZaiApiKey("sk-test", { fetchFn: fakeFetch }),
			/Z\.AI API key validation failed \(401\): \{"error":"unauthorized"\}/,
		);
	});
});
