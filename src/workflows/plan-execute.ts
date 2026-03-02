import type { WorkflowContext, PhaseConfig, PhaseResult, ConfirmResult } from "./types.js";
import { runPhase, runVerifyFixLoop, extractVerifyResult } from "./engine.js";
import {
	explorerPrompt,
	plannerPrompt,
	executorPrompt,
	verifierPrompt,
} from "./prompts.js";

/**
 * Run the plan-execute workflow with user confirmation gate.
 * explore → plan → [user confirms] → execute → verify (→ fix loop)
 */
export async function runPlanExecute(
	ctx: WorkflowContext,
	task: string,
	confirmFn: (plan: string) => Promise<ConfirmResult>,
): Promise<PhaseResult[]> {
	const basePrompt = "";
	const results: PhaseResult[] = [];

	// Phase 1: Explore
	const explorePhase: PhaseConfig = {
		name: "explore",
		systemPrompt: explorerPrompt(basePrompt),
		tools: "readonly",
	};
	const exploreResult = await runPhase(ctx, explorePhase, task);
	results.push(exploreResult);

	// Phase 2: Plan
	const planPhase: PhaseConfig = {
		name: "plan",
		systemPrompt: plannerPrompt(basePrompt),
		tools: "readonly",
	};
	const planInput = `## Original Task\n${task}\n\n## Exploration Results\n${exploreResult.summary}\n\n## Your Task\nCreate a detailed implementation plan.`;
	const planResult = await runPhase(ctx, planPhase, planInput);
	results.push(planResult);

	// Confirmation gate
	const confirmation = await confirmFn(planResult.summary);
	if (!confirmation.approved) {
		results.push({
			success: false,
			summary: `Plan rejected by user.${confirmation.feedback ? ` Feedback: ${confirmation.feedback}` : ""}`,
			phaseName: "plan",
		});
		return results;
	}

	const planContext = confirmation.feedback
		? `${planResult.summary}\n\n## User Feedback\n${confirmation.feedback}`
		: planResult.summary;

	// Phase 3: Execute
	const executePhase: PhaseConfig = {
		name: "execute",
		systemPrompt: executorPrompt(basePrompt),
		tools: "full",
	};
	const executeInput = `## Original Task\n${task}\n\n## Approved Plan\n${planContext}\n\n## Your Task\nImplement the plan.`;
	const executeResult = await runPhase(ctx, executePhase, executeInput);
	results.push(executeResult);

	// Phase 4: Verify with fix loop
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
	const verifyInput = `## Original Task\n${task}\n\n## Implementation Summary\n${executeResult.summary}\n\n## Your Task\nVerify the implementation.`;
	const loopResults = await runVerifyFixLoop(ctx, verifyPhase, fixPhase, task, verifyInput, 3);
	results.push(...loopResults);

	return results;
}
