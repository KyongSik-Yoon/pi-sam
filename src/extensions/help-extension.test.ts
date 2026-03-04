import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { helpExtension } from "./help-extension.js";

describe("help-extension", () => {
	it("should register /help command", () => {
		const registerCommandCalls: Array<{ name: string; config: any }> = [];

		const mockPi = {
			registerCommand: (name: string, config: any) => {
				registerCommandCalls.push({ name, config });
			},
		} as any;

		// Create the extension factory and apply it
		const extension = helpExtension();
		extension(mockPi);

		// Verify /help command was registered
		assert.strictEqual(registerCommandCalls.length, 1);
		assert.strictEqual(registerCommandCalls[0].name, "help");
		assert.strictEqual(
			registerCommandCalls[0].config.description,
			"사용 가능한 명령어 표시",
		);
		assert.strictEqual(typeof registerCommandCalls[0].config.handler, "function");
	});

	it("handler should send user message with help text", async () => {
		let sentMessage: string | undefined;
		const mockPi = {
			registerCommand: (_name: string, config: any) => {
				// Call the handler immediately to test it
				const mockCtx = {} as any;
				mockPi.sendUserMessage = (msg: string) => {
					sentMessage = msg;
				};

				await config.handler("", mockCtx);
			},
			sendUserMessage: (_msg: string) => {},
		} as any;

		const extension = helpExtension();
		extension(mockPi);

		// Verify help text was sent
		assert.ok(sentMessage);
		assert.ok(sentMessage!.includes("pi-sam 도움말"));
		assert.ok(sentMessage!.includes("/autopilot"));
		assert.ok(sentMessage!.includes("/plan"));
		assert.ok(sentMessage!.includes("/review"));
		assert.ok(sentMessage!.includes("/model"));
		assert.ok(sentMessage!.includes("/resume"));
	});
});
