import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMinimalReadRenderHelpers } from "./minimal-read-renderer.js";

describe("minimal read renderer", () => {
	it("절대 경로를 cwd 기준 상대 경로로 변환해야 한다", () => {
		const helpers = createMinimalReadRenderHelpers("/repo");
		assert.equal(helpers.toDisplayPath("/repo/src/main.ts"), "src/main.ts");
	});

	it("@ 접두어를 제거하고 상대 경로는 그대로 유지해야 한다", () => {
		const helpers = createMinimalReadRenderHelpers("/repo");
		assert.equal(helpers.toDisplayPath("@README.md"), "README.md");
	});

	it("기본(접힘) 출력은 비워야 하고, 확장 출력은 본문을 반환해야 한다", () => {
		const helpers = createMinimalReadRenderHelpers("/repo");
		assert.equal(helpers.renderCollapsedText(), "");
		assert.equal(helpers.renderExpandedText("hello"), "hello");
	});
});
