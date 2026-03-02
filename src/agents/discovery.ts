import { existsSync, readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { type AgentDefinition, type AgentSource, parseAgentFile } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Directories to scan for agent .md files */
function getDiscoveryPaths(cwd: string, agentDir: string): Array<{ dir: string; source: AgentSource }> {
	return [
		// Project-level agents (highest priority)
		{ dir: join(cwd, ".pi-sam", "agents"), source: "project" as AgentSource },
		// User-level agents
		{ dir: join(agentDir, "agents"), source: "user" as AgentSource },
	];
}

/**
 * Load all bundled agent definitions from the bundled/ directory
 * relative to this file (works for both src/ dev and dist/ production).
 */
function loadBundledAgents(): AgentDefinition[] {
	const bundledDir = join(__dirname, "bundled");

	if (!existsSync(bundledDir)) {
		return [];
	}

	return loadAgentsFromDir(bundledDir, "bundled");
}

/**
 * Load agent definitions from a directory.
 */
function loadAgentsFromDir(dirPath: string, source: AgentSource): AgentDefinition[] {
	if (!existsSync(dirPath)) return [];

	const agents: AgentDefinition[] = [];
	try {
		const files = readdirSync(dirPath).filter((f) => f.endsWith(".md")).sort();
		for (const file of files) {
			const filePath = join(dirPath, file);
			try {
				const content = readFileSync(filePath, "utf-8");
				agents.push(parseAgentFile(content, source, filePath));
			} catch {
				// Skip unparseable files
			}
		}
	} catch {
		// Directory not readable
	}
	return agents;
}

export interface DiscoveredAgents {
	agents: AgentDefinition[];
	/** Project-level agents directory (null if not found) */
	projectAgentsDir: string | null;
}

/**
 * Discover all available agents from bundled, user, and project directories.
 *
 * Priority (later overrides earlier): bundled < user < project.
 * Agents with the same name are overridden by higher-priority sources.
 */
export function discoverAgents(cwd: string, agentDir: string): DiscoveredAgents {
	const agentMap = new Map<string, AgentDefinition>();
	let projectAgentsDir: string | null = null;

	// 1. Bundled agents (lowest priority)
	for (const agent of loadBundledAgents()) {
		agentMap.set(agent.name, agent);
	}

	// 2. User and project agents (higher priority overrides)
	const paths = getDiscoveryPaths(cwd, agentDir);
	for (const { dir, source } of paths) {
		const dirAgents = loadAgentsFromDir(dir, source);
		for (const agent of dirAgents) {
			agentMap.set(agent.name, agent);
		}
		if (source === "project" && dirAgents.length > 0) {
			projectAgentsDir = dir;
		}
	}

	return {
		agents: Array.from(agentMap.values()),
		projectAgentsDir,
	};
}

/**
 * Get a specific agent by name.
 */
export function getAgent(agents: AgentDefinition[], name: string): AgentDefinition | undefined {
	return agents.find((a) => a.name === name);
}

/**
 * Get all reviewer agents (agents with a specialty field).
 */
export function getReviewerAgents(agents: AgentDefinition[]): AgentDefinition[] {
	return agents.filter((a) => a.specialty != null);
}

/**
 * Get all available specialties from discovered agents.
 */
export function getAvailableSpecialties(agents: AgentDefinition[]): string[] {
	return getReviewerAgents(agents).map((a) => a.specialty!);
}
