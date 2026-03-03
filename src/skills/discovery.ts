import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { type SkillDefinition, type SkillSource, parseSkillFile } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Directories to scan for skill folders containing SKILL.md */
function getDiscoveryPaths(cwd: string, agentDir: string): Array<{ dir: string; source: SkillSource }> {
	return [
		// Project-level skills (highest priority)
		{ dir: join(cwd, ".pi-sam", "skills"), source: "project" as SkillSource },
		// User-level skills
		{ dir: join(agentDir, "skills"), source: "user" as SkillSource },
	];
}

/**
 * Load all bundled skill definitions from the bundled/ directory
 * relative to this file (works for both src/ dev and dist/ production).
 */
function loadBundledSkills(): SkillDefinition[] {
	const bundledDir = join(__dirname, "bundled");
	if (!existsSync(bundledDir)) return [];
	return loadSkillsFromDir(bundledDir, "bundled");
}

/**
 * Load skill definitions from a directory.
 * Each skill is a subdirectory containing a SKILL.md file.
 */
function loadSkillsFromDir(dirPath: string, source: SkillSource): SkillDefinition[] {
	if (!existsSync(dirPath)) return [];

	const skills: SkillDefinition[] = [];
	try {
		const entries = readdirSync(dirPath).sort();
		for (const entry of entries) {
			const entryPath = join(dirPath, entry);
			try {
				if (!statSync(entryPath).isDirectory()) continue;
			} catch {
				continue;
			}

			const skillFile = join(entryPath, "SKILL.md");
			if (!existsSync(skillFile)) continue;

			try {
				const content = readFileSync(skillFile, "utf-8");
				skills.push(parseSkillFile(content, source, skillFile));
			} catch {
				// Skip unparseable files
			}
		}
	} catch {
		// Directory not readable
	}
	return skills;
}

export interface DiscoveredSkills {
	skills: SkillDefinition[];
	/** Project-level skills directory (null if not found) */
	projectSkillsDir: string | null;
}

/**
 * Discover all available skills from bundled, user, and project directories.
 *
 * Priority (later overrides earlier): bundled < user < project.
 * Skills with the same name are overridden by higher-priority sources.
 */
export function discoverSkills(cwd: string, agentDir: string): DiscoveredSkills {
	const skillMap = new Map<string, SkillDefinition>();
	let projectSkillsDir: string | null = null;

	// 1. Bundled skills (lowest priority)
	for (const skill of loadBundledSkills()) {
		skillMap.set(skill.name, skill);
	}

	// 2. User and project skills (higher priority overrides)
	const paths = getDiscoveryPaths(cwd, agentDir);
	for (const { dir, source } of paths) {
		const dirSkills = loadSkillsFromDir(dir, source);
		for (const skill of dirSkills) {
			skillMap.set(skill.name, skill);
		}
		if (source === "project" && dirSkills.length > 0) {
			projectSkillsDir = dir;
		}
	}

	return {
		skills: Array.from(skillMap.values()),
		projectSkillsDir,
	};
}

/**
 * Get a specific skill by name.
 */
export function getSkill(skills: SkillDefinition[], name: string): SkillDefinition | undefined {
	return skills.find((s) => s.name === name);
}
