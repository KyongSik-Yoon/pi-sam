import type { WorkflowContext, PhaseConfig, PhaseResult } from "./types.js";
import { runWorkflowWithFixLoop, extractVerifyResult } from "./engine.js";
import {
	explorerPrompt,
	plannerPrompt,
	executorPrompt,
	verifierPrompt,
} from "./prompts.js";

/**
 * Run the full autopilot workflow: explore → plan → execute → verify (→ fix loop).
 */
export async function runAutopilot(
	ctx: WorkflowContext,
	task: string,
): Promise<PhaseResult[]> {
	const basePrompt = ctx.systemPrompt("");

	const explorePhase: PhaseConfig = {
		name: "explore",
		systemPrompt: explorerPrompt(basePrompt),
		tools: "readonly",
	};

	const planPhase: PhaseConfig = {
		name: "plan",
		systemPrompt: plannerPrompt(basePrompt),
		tools: "readonly",
	};

	const executePhase: PhaseConfig = {
		name: "execute",
		systemPrompt: executorPrompt(basePrompt),
		tools: "full",
	};

	const verifyPhase: PhaseConfig = {
		name: "verify",
		systemPrompt: verifierPrompt(basePrompt),
		tools: "readonly",
		extractResult: extractVerifyResult,
	};

	const fixPhase: PhaseConfig = {
		name: "fix",
		systemPrompt: executorPrompt(basePrompt),
		tools: "full",
	};

	const mainPhases = [explorePhase, planPhase, executePhase];
	return runWorkflowWithFixLoop(ctx, mainPhases, verifyPhase, fixPhase, task, 3);
}
