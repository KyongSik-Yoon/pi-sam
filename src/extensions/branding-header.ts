import type { ExtensionFactory } from "@mariozechner/pi-coding-agent";
import { VERSION } from "../config.js";

export function getPiSamHeaderLines(version: string): string[] {
	return [
		"    ◤◥",
		"   ◢██◣",
		"   ◥██◤",
		"   pi-sam",
		`   /help · /model · /resume  v${version}`,
	];
}

export const brandingHeaderExtension: ExtensionFactory = (pi) => {
	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;

		ctx.ui.setHeader((_tui, theme) => ({
			render(): string[] {
				const lines = getPiSamHeaderLines(VERSION);
				return lines.map((line, index) => {
					if (index <= 2) return theme.fg("accent", line);
					if (index === 3) return theme.fg("accent", theme.bold(line));
					return theme.fg("muted", line);
				});
			},
			invalidate() {},
		}));
	});
};
