import type { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import type { Model } from "@mariozechner/pi-ai";
import type { ThinkingLevel } from "@mariozechner/pi-agent-core";
import type { AgentDefinition, ReviewResult } from "../agents/index.js";

export type WorkflowPhase = "explore" | "plan" | "execute" | "verify" | "fix" | "review";

export interface PhaseResult {
	success: boolean;
	summary: string;
	phaseName: WorkflowPhase;
	/** Structured review findings (populated by reviewer/verifier agents) */
	review?: ReviewResult;
	/** Execution metrics */
	durationMs?: number;
	/** Agent that produced this result */
	agentName?: string;
}

export interface WorkflowContext {
	cwd: string;
	agentDir: string;
	authStorage: AuthStorage;
	modelRegistry: ModelRegistry;
	model?: Model<any>;
	thinkingLevel: ThinkingLevel;
}

export interface PhaseConfig {
	name: WorkflowPhase;
	/** Agent definition (loaded from .md file) */
	agent: AgentDefinition;
	/** Override for extracting structured results from agent output */
	extractResult?: (text: string) => { success: boolean; summary: string; review?: ReviewResult };
}

/** Progress callback for tracking phase execution in real-time */
export interface PhaseProgress {
	phaseName: WorkflowPhase;
	agentName: string;
	status: "starting" | "running" | "completed" | "failed";
	toolCount: number;
	elapsedMs: number;
	/** Latest tool being executed */
	currentTool?: string;
}

export type WorkflowProgressCallback = (progress: PhaseProgress) => void;

export interface ConfirmResult {
	approved: boolean;
	feedback?: string;
}
