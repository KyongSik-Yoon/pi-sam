import type { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import type { Model } from "@mariozechner/pi-ai";
import type { ThinkingLevel } from "@mariozechner/pi-agent-core";

export type WorkflowPhase = "explore" | "plan" | "execute" | "verify" | "fix" | "review";

export interface PhaseResult {
	success: boolean;
	summary: string;
	phaseName: WorkflowPhase;
}

export interface WorkflowContext {
	cwd: string;
	agentDir: string;
	authStorage: AuthStorage;
	modelRegistry: ModelRegistry;
	model?: Model<any>;
	thinkingLevel: ThinkingLevel;
	onPhaseStart?: (phase: WorkflowPhase) => void;
	onPhaseEnd?: (phase: WorkflowPhase, result: PhaseResult) => void;
	onOutput?: (delta: string) => void;
}

export interface PhaseConfig {
	name: WorkflowPhase;
	systemPrompt: string;
	tools: "full" | "readonly";
	extractResult?: (text: string) => { success: boolean; summary: string };
}

export interface ConfirmResult {
	approved: boolean;
	feedback?: string;
}
