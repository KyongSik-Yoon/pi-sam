import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { join } from "node:path";
import {
	createSkillTool,
	summarizeSkillToolCallForDisplay,
	summarizeSkillToolResultForDisplay,
} from "./skill-tool.js";

describe("skill tool output", () => {
	it("invoke는 한 줄 요약만 반환해야 한다", async () => {
		const cwd = process.cwd();
		const agentDir = join(cwd, ".tmp-agent-dir");
		const tool = createSkillTool(cwd, agentDir);

		const result = await tool.execute(
			"test-call",
			{ action: "invoke", name: "brainstorming" },
			undefined,
			undefined,
			undefined as never,
		);

		const textBlock = result.content.find((block) => block.type === "text");
		assert.ok(textBlock, "text 결과가 있어야 함");
		const text = textBlock?.type === "text" ? textBlock.text : "";

		assert.equal(text.trim(), "Using skill: brainstorming");
		assert.doesNotMatch(text, /^- source: /m);
		assert.doesNotMatch(text, /^- path: /m);
	});

	it("list는 이름만 간단히 반환해야 한다", async () => {
		const cwd = process.cwd();
		const agentDir = join(cwd, ".tmp-agent-dir");
		const tool = createSkillTool(cwd, agentDir);

		const result = await tool.execute(
			"test-call",
			{ action: "list" },
			undefined,
			undefined,
			undefined as never,
		);

		const textBlock = result.content.find((block) => block.type === "text");
		assert.ok(textBlock, "text 결과가 있어야 함");
		const text = textBlock?.type === "text" ? textBlock.text : "";

		assert.match(text, /^# Available Skills/m);
		assert.match(text, /^- [a-z0-9-]+$/m);
		assert.doesNotMatch(text, /\| source: /m);
		assert.doesNotMatch(text, /\| path: /m);
	});
});

describe("skill tool display summary", () => {
	it("invoke 결과도 빈 문자열이어야 한다 (renderCall이 대신 표시)", () => {
		const output = summarizeSkillToolResultForDisplay({ action: "invoke", skill: "requesting-code-review" });
		assert.equal(output, "");
	});

	it("list 결과는 표시하지 않아야 한다", () => {
		const output = summarizeSkillToolResultForDisplay({ action: "list", count: 14 });
		assert.equal(output, "");
	});
});

describe("skill tool call summary", () => {
	it("list 호출은 사용자에게 노출하지 않아야 한다", () => {
		const output = summarizeSkillToolCallForDisplay({ action: "list" });
		assert.equal(output, "");
	});

	it("invoke 호출은 스킬명만 간단히 보여줘야 한다", () => {
		const output = summarizeSkillToolCallForDisplay({ action: "invoke", name: "brainstorming" });
		assert.equal(output, "Using skill: brainstorming");
	});
});
