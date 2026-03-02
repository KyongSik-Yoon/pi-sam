import { discoverAgents, getAgent } from "../agents/index.js";
import type { WorkflowContext, PhaseConfig, PhaseResult, WorkflowProgressCallback } from "./types.js";
import { runWorkflowWithFixLoop, extractVerifyResult } from "./engine.js";
import { parseReviewFindings } from "../agents/index.js";

/**
 * Run the full autopilot workflow: explore → plan → execute → verify (→ fix loop).
 *
 * Agent definitions are loaded from .md files via the discovery system.
 */
export async function runAutopilot(
	ctx: WorkflowContext,
	task: string,
	onProgress?: WorkflowProgressCallback,
): Promise<PhaseResult[]> {
	const { agents } = discoverAgents(ctx.cwd, ctx.agentDir);

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

	const explorePhase: PhaseConfig = {
		name: "explore",
		agent: explorer,
	};

	const planPhase: PhaseConfig = {
		name: "plan",
		agent: planner,
	};

	const executePhase: PhaseConfig = {
		name: "execute",
		agent: executor,
	};

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

	const fixPhase: PhaseConfig = {
		name: "fix",
		agent: executor,
	};

	const mainPhases = [explorePhase, planPhase, executePhase];
	return runWorkflowWithFixLoop(ctx, mainPhases, verifyPhase, fixPhase, task, 3, onProgress);
}
