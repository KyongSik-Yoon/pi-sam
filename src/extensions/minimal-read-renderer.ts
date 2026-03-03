import { createReadTool, type ExtensionFactory } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { isAbsolute, relative } from "node:path";

export function createMinimalReadRenderHelpers(cwd: string) {
	function stripAtPrefix(path: string): string {
		return path.startsWith("@") ? path.slice(1) : path;
	}

	function toDisplayPath(inputPath: string): string {
		const normalized = stripAtPrefix(inputPath);
		if (!normalized) return ".";
		if (!isAbsolute(normalized)) return normalized;
		const rel = relative(cwd, normalized);
		return rel.length > 0 ? rel : ".";
	}

	function renderCollapsedText(): string {
		return "";
	}

	function renderExpandedText(text: string): string {
		return text;
	}

	function formatRangeSuffix(offset?: number, limit?: number): string {
		if (offset === undefined && limit === undefined) return "";
		const start = offset ?? 1;
		const end = limit !== undefined ? start + limit - 1 : undefined;
		return `:${start}${end !== undefined ? `-${end}` : ""}`;
	}

	return {
		toDisplayPath,
		renderCollapsedText,
		renderExpandedText,
		formatRangeSuffix,
	};
}

export const minimalReadRendererExtension: ExtensionFactory = (pi) => {
	const cwd = process.cwd();
	const builtInRead = createReadTool(cwd);
	const helpers = createMinimalReadRenderHelpers(cwd);

	pi.registerTool({
		name: "read",
		label: "read",
		description: builtInRead.description,
		parameters: builtInRead.parameters,
		async execute(toolCallId, params, signal, onUpdate) {
			return builtInRead.execute(toolCallId, params, signal, onUpdate);
		},
		renderCall(args, theme) {
			const path = helpers.toDisplayPath(args.path ?? "");
			const range = helpers.formatRangeSuffix(args.offset, args.limit);
			const text = `${theme.fg("toolTitle", "read")} ${theme.fg("accent", path)}${theme.fg("warning", range)}`;
			return new Text(text, 0, 0);
		},
		renderResult(result, { expanded, isPartial }, theme) {
			if (isPartial) {
				return new Text(theme.fg("warning", "Reading..."), 0, 0);
			}

			if (!expanded) {
				return new Text(helpers.renderCollapsedText(), 0, 0);
			}

			const textBlock = result.content.find((block) => block.type === "text");
			if (!textBlock || textBlock.type !== "text") {
				return new Text(theme.fg("muted", "(non-text result)"), 0, 0);
			}

			const output = textBlock.text
				.split("\n")
				.map((line) => theme.fg("toolOutput", line))
				.join("\n");

			return new Text(helpers.renderExpandedText(output), 0, 0);
		},
	});
};
