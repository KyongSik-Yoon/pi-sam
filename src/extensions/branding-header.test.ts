import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPiSamHeaderLines } from "./branding-header.js";

describe("getPiSamHeaderLines", () => {
	it("소형 헤더(5~7줄) 규칙을 만족해야 한다", () => {
		const lines = getPiSamHeaderLines("0.1.0");

		assert.ok(lines.length >= 5, "헤더는 최소 5줄이어야 함");
		assert.ok(lines.length <= 7, "헤더는 최대 7줄이어야 함");
	});

	it("pi-sam 브랜딩 텍스트를 포함해야 한다", () => {
		const lines = getPiSamHeaderLines("0.1.0");
		assert.ok(lines.some((line) => line.includes("pi-sam")));
	});

	it("핵심 단축키와 버전을 포함해야 한다", () => {
		const lines = getPiSamHeaderLines("0.1.0");
		const metaLine = lines[lines.length - 1] ?? "";
		assert.ok(metaLine.includes("/help"));
		assert.ok(metaLine.includes("/model"));
		assert.ok(metaLine.includes("/resume"));
		assert.ok(metaLine.includes("v0.1.0"));
	});

	it("compact 블록형 로고 제약을 만족해야 한다", () => {
		const lines = getPiSamHeaderLines("0.1.0");
		const logoLines = lines.slice(0, 3);

		assert.equal(logoLines.length, 3);
		assert.ok(logoLines.every((line) => line.length >= 20), "로고 폭은 최소 20자여야 함");
		assert.ok(logoLines.every((line) => line.length <= 28), "로고 폭은 28자 이하여야 함");
		assert.ok(
			logoLines.every((line) => line.includes("█") || line.includes("▀")),
			"모든 로고 라인에 블록 문자 포함 필요",
		);
	});
});
