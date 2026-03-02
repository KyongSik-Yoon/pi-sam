import { discoverAgents, getAgent, parseReviewFindings } from "../agents/index.js";
import type { WorkflowContext, PhaseConfig, PhaseResult, ConfirmResult, WorkflowProgressCallback } from "./types.js";
import { runPhase, runVerifyFixLoop, extractVerifyResult } from "./engine.js";

/**
 * Run the plan-execute workflow with user confirmation gate.
 * explore → plan → [user confirms] → execute → verify (→ fix loop)
 */
export async function runPlanExecute(
	ctx: WorkflowContext,
	task: string,
	confirmFn: (plan: string) => Promise<ConfirmResult>,
	onProgress?: WorkflowProgressCallback,
): Promise<PhaseResult[]> {
	const { agents } = discoverAgents(ctx.cwd, ctx.agentDir);
	const results: PhaseResult[] = [];

	const explorer = getAgent(agents, "explorer");
	const planner = getAgent(agents, "planner");
	const executor = getAgent(agents, "executor");
	const verifier = getAgent(agents, "verifier");

	if (!explorer || !planner || !executor || !verifier) {
		return [{
			success: false,
			summary: `Missing required agents. Found: ${agents.map(a => a.name).join(", ")}. Need: explorer, planner, executor, verifier.`,
			phaseName: "explore",
		}];
	}

	// Phase 1: Explore
	const explorePhase: PhaseConfig = { name: "explore", agent: explorer };
	const exploreResult = await runPhase(ctx, explorePhase, task, onProgress);
	results.push(exploreResult);

	// Phase 2: Plan
	const planPhase: PhaseConfig = { name: "plan", agent: planner };
	const planInput = `## Original Task\n${task}\n\n## Exploration Results\n${exploreResult.summary}\n\n## Your Task\nCreate a detailed implementation plan.`;
	const planResult = await runPhase(ctx, planPhase, planInput, onProgress);
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
	const executePhase: PhaseConfig = { name: "execute", agent: executor };
	const executeInput = `## Original Task\n${task}\n\n## Approved Plan\n${planContext}\n\n## Your Task\nImplement the plan.`;
	const executeResult = await runPhase(ctx, executePhase, executeInput, onProgress);
	results.push(executeResult);

	// Phase 4: Verify with fix loop
	const verifyPhase: PhaseConfig = {
		name: "verify",
		agent: verifier,
		extractResult: (text) => {
			const base = extractVerifyResult(text);
			const review = parseReviewFindings(text);
			review.passed = base.success;
			return { ...base, review };
		},
	};
	const fixPhase: PhaseConfig = { name: "fix", agent: executor };
	const verifyInput = `## Original Task\n${task}\n\n## Implementation Summary\n${executeResult.summary}\n\n## Your Task\nVerify the implementation.`;
	const loopResults = await runVerifyFixLoop(ctx, verifyPhase, fixPhase, task, verifyInput, 3, onProgress);
	results.push(...loopResults);

	return results;
}
