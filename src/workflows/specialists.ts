import type { WorkflowContext, PhaseResult, PhaseConfig } from "./types.js";
import { runPhase } from "./engine.js";
import { reviewerPrompt } from "./prompts.js";

export type Specialty = "security" | "test" | "architecture" | "performance";

/**
 * Run a single specialist review phase.
 */
export async function runSpecialistReview(
	ctx: WorkflowContext,
	specialty: Specialty,
	scope: string,
): Promise<PhaseResult> {
	const basePrompt = ctx.systemPrompt("");

	const reviewPhase: PhaseConfig = {
		name: "review",
		systemPrompt: reviewerPrompt(basePrompt, specialty),
		tools: "readonly",
	};

	const input = `## Review Scope\n${scope}\n\n## Your Task\nConduct a ${specialty} review of the code in scope. Use read-only tools to inspect relevant files.`;
	return runPhase(ctx, reviewPhase, input);
}

/**
 * Run multiple specialist reviews in parallel and collect all results.
 */
export async function runMultiReview(
	ctx: WorkflowContext,
	specialties: Specialty[],
	scope: string,
): Promise<PhaseResult[]> {
	return Promise.all(
		specialties.map((specialty) => runSpecialistReview(ctx, specialty, scope)),
	);
}
