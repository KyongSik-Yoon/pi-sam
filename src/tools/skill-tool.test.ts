import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { join } from "node:path";
import { createSkillTool } from "./skill-tool.js";

describe("skill tool invoke output", () => {
	it("invoke는 제목과 메타 정보만 반환해야 한다", async () => {
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

		assert.match(text, /^# Skill: brainstorming/m);
		assert.match(text, /^- source: /m);
		assert.match(text, /^- path: /m);

		// 본문 전체 노출 금지
		assert.doesNotMatch(text, /^## Overview/m);
	});
});
