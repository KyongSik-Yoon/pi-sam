/** Source of a skill definition */
export type SkillSource = "bundled" | "user" | "project";

/** Skill definition parsed from a SKILL.md file with frontmatter */
export interface SkillDefinition {
	name: string;
	description: string;
	/** Full markdown content (body after frontmatter) */
	content: string;
	source: SkillSource;
	filePath?: string;
}

/** Frontmatter fields in SKILL.md files */
export interface SkillFrontmatter {
	name: string;
	description?: string;
}

/**
 * Parse frontmatter from a skill markdown string.
 * Returns the frontmatter fields and the body (everything after the closing ---).
 */
export function parseSkillFrontmatter(raw: string): { frontmatter: SkillFrontmatter; body: string } {
	const trimmed = raw.trimStart();
	if (!trimmed.startsWith("---")) {
		return { frontmatter: { name: "" }, body: raw };
	}

	const endIndex = trimmed.indexOf("\n---", 3);
	if (endIndex === -1) {
		return { frontmatter: { name: "" }, body: raw };
	}

	const yamlBlock = trimmed.slice(3, endIndex).trim();
	const body = trimmed.slice(endIndex + 4).trim();

	const frontmatter: Record<string, string> = {};
	for (const line of yamlBlock.split("\n")) {
		const colonIndex = line.indexOf(":");
		if (colonIndex === -1) continue;
		const key = line.slice(0, colonIndex).trim();
		let value = line.slice(colonIndex + 1).trim();

		// Strip quotes
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		frontmatter[key] = value;
	}

	return {
		frontmatter: {
			name: frontmatter.name ?? "",
			description: frontmatter.description,
		},
		body,
	};
}

/**
 * Parse a SKILL.md file into a SkillDefinition.
 */
export function parseSkillFile(
	raw: string,
	source: SkillSource,
	filePath?: string,
): SkillDefinition {
	const { frontmatter, body } = parseSkillFrontmatter(raw);

	const name = frontmatter.name || (filePath ? dirNameToSkillName(filePath) : "unknown");

	return {
		name,
		description: frontmatter.description ?? "",
		content: body,
		source,
		filePath,
	};
}

function dirNameToSkillName(filePath: string): string {
	// SKILL.md lives inside a directory named after the skill
	const parts = filePath.split("/");
	const skillMdIndex = parts.findIndex((p) => p === "SKILL.md");
	if (skillMdIndex > 0) return parts[skillMdIndex - 1];
	return parts.pop()?.replace(/\.md$/, "") ?? "unknown";
}
