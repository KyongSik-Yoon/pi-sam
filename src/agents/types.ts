import type { ThinkingLevel } from "@mariozechner/pi-agent-core";

/** Source of an agent definition */
export type AgentSource = "bundled" | "user" | "project";

/** Agent definition parsed from a .md file with frontmatter */
export interface AgentDefinition {
	name: string;
	description: string;
	systemPrompt: string;
	tools: "full" | "readonly";
	/** Model override pattern (e.g. "anthropic/claude-haiku-3-5-20241022") */
	model?: string;
	/** Thinking level override */
	thinkingLevel?: ThinkingLevel;
	/** Whether this agent extracts structured verify results */
	extractVerifyResult?: boolean;
	/** Review specialty (for reviewer agents) */
	specialty?: string;
	source: AgentSource;
	filePath?: string;
}

/** Frontmatter fields in agent .md files */
export interface AgentFrontmatter {
	name: string;
	description?: string;
	tools?: "full" | "readonly";
	model?: string;
	thinkingLevel?: string;
	extractVerifyResult?: boolean;
	specialty?: string;
}

/** A structured code review finding */
export interface ReviewFinding {
	severity: "critical" | "high" | "medium" | "low" | "info";
	file?: string;
	line?: number;
	description: string;
}

/** Structured review result */
export interface ReviewResult {
	passed: boolean;
	findings: ReviewFinding[];
	summary: string;
}

/**
 * Parse frontmatter from a markdown string.
 * Returns the frontmatter object and the body (everything after the closing ---).
 */
export function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
	const trimmed = content.trimStart();
	if (!trimmed.startsWith("---")) {
		return { frontmatter: {}, body: content };
	}

	const endIndex = trimmed.indexOf("\n---", 3);
	if (endIndex === -1) {
		return { frontmatter: {}, body: content };
	}

	const yamlBlock = trimmed.slice(3, endIndex).trim();
	const body = trimmed.slice(endIndex + 4).trim();

	// Simple YAML-like parser for flat key-value frontmatter
	const frontmatter: Record<string, unknown> = {};
	for (const line of yamlBlock.split("\n")) {
		const colonIndex = line.indexOf(":");
		if (colonIndex === -1) continue;
		const key = line.slice(0, colonIndex).trim();
		let value: string | boolean = line.slice(colonIndex + 1).trim();

		// Strip quotes
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}

		// Boolean coercion
		if (value === "true") {
			frontmatter[key] = true;
		} else if (value === "false") {
			frontmatter[key] = false;
		} else {
			frontmatter[key] = value;
		}
	}

	return { frontmatter, body };
}

/**
 * Parse an agent .md file into an AgentDefinition.
 */
export function parseAgentFile(
	content: string,
	source: AgentSource,
	filePath?: string,
): AgentDefinition {
	const { frontmatter, body } = parseFrontmatter(content);
	const fm = frontmatter as Partial<AgentFrontmatter>;

	const name = fm.name ?? (filePath ? fileNameToAgentName(filePath) : "unknown");

	return {
		name,
		description: (fm.description as string) ?? "",
		systemPrompt: body,
		tools: fm.tools === "full" ? "full" : "readonly",
		model: fm.model as string | undefined,
		thinkingLevel: parseThinkingLevel(fm.thinkingLevel),
		extractVerifyResult: fm.extractVerifyResult ?? false,
		specialty: fm.specialty as string | undefined,
		source,
		filePath,
	};
}

function fileNameToAgentName(filePath: string): string {
	const base = filePath.split("/").pop() ?? filePath;
	return base.replace(/\.md$/, "");
}

function parseThinkingLevel(value: unknown): ThinkingLevel | undefined {
	if (typeof value !== "string") return undefined;
	const valid: ThinkingLevel[] = ["off", "low", "medium", "high"];
	return valid.includes(value as ThinkingLevel) ? (value as ThinkingLevel) : undefined;
}

/**
 * Parse structured review findings from verifier/reviewer text output.
 * Looks for lines matching:
 *   - [severity] [file:line] description
 *   - [severity] description (without file location)
 */
export function parseReviewFindings(text: string): ReviewResult {
	const findings: ReviewFinding[] = [];

	// Pattern with explicit [file:line] bracket notation
	const bracketPattern = /^[-*]\s*\[?(critical|high|medium|low|info)\]?\s*\[([^\]]+?)(?::(\d+))?\]\s*(.+)/gim;
	// Pattern without file location
	const plainPattern = /^[-*]\s*\[?(critical|high|medium|low|info)\]?\s+(?!\[)(.+)/gim;

	const foundLines = new Set<number>();

	let match;
	while ((match = bracketPattern.exec(text)) !== null) {
		foundLines.add(match.index);
		findings.push({
			severity: match[1].toLowerCase() as ReviewFinding["severity"],
			file: match[2] || undefined,
			line: match[3] ? parseInt(match[3], 10) : undefined,
			description: match[4].trim(),
		});
	}

	while ((match = plainPattern.exec(text)) !== null) {
		if (foundLines.has(match.index)) continue; // Already matched by bracket pattern
		findings.push({
			severity: match[1].toLowerCase() as ReviewFinding["severity"],
			file: undefined,
			line: undefined,
			description: match[2].trim(),
		});
	}

	// Determine pass/fail
	const upper = text.toUpperCase();
	const hasFail =
		upper.includes("**STATUS:** FAIL") ||
		upper.includes("STATUS: FAIL") ||
		(upper.includes("FAIL") && !upper.includes("**STATUS:** PASS") && !upper.includes("STATUS: PASS"));
	const hasPass = upper.includes("**STATUS:** PASS") || upper.includes("STATUS: PASS");
	const passed = hasPass && !hasFail;

	return { passed, findings, summary: text };
}
