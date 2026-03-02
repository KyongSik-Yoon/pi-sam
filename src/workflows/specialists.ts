import {
	discoverAgents,
	getReviewerAgents,
	parseReviewFindings,
	type AgentDefinition,
} from "../agents/index.js";
import type { WorkflowContext, PhaseResult, PhaseConfig, WorkflowProgressCallback } from "./types.js";
import { runPhase } from "./engine.js";

/**
 * Run a single specialist review phase using a discovered reviewer agent.
 */
export async function runSpecialistReview(
	ctx: WorkflowContext,
	agent: AgentDefinition,
	scope: string,
	onProgress?: WorkflowProgressCallback,
): Promise<PhaseResult> {
	const reviewPhase: PhaseConfig = {
		name: "review",
		agent,
		extractResult: (text) => {
			const review = parseReviewFindings(text);
			return {
				success: review.passed,
				summary: text,
				review,
			};
		},
	};

	const specialty = agent.specialty ?? agent.name;
	const input = `## Review Scope\n${scope}\n\n## Your Task\nConduct a ${specialty} review of the code in scope. Use read-only tools to inspect relevant files.`;
	return runPhase(ctx, reviewPhase, input, onProgress);
}

/**
 * Run a specialist review by specialty name.
 * Discovers agents and finds the matching reviewer.
 */
export async function runSpecialistReviewByName(
	ctx: WorkflowContext,
	specialty: string,
	scope: string,
	onProgress?: WorkflowProgressCallback,
): Promise<PhaseResult> {
	const { agents } = discoverAgents(ctx.cwd, ctx.agentDir);
	const reviewers = getReviewerAgents(agents);
	const agent = reviewers.find((a) => a.specialty === specialty);

	if (!agent) {
		return {
			success: false,
			summary: `No reviewer agent found for specialty "${specialty}". Available: ${reviewers.map(a => a.specialty).join(", ")}`,
			phaseName: "review",
		};
	}

	return runSpecialistReview(ctx, agent, scope, onProgress);
}

/**
 * Run multiple specialist reviews in parallel and collect all results.
 * If specialties is empty, runs all discovered reviewer agents.
 */
export async function runMultiReview(
	ctx: WorkflowContext,
	specialties: string[],
	scope: string,
	onProgress?: WorkflowProgressCallback,
): Promise<PhaseResult[]> {
	const { agents } = discoverAgents(ctx.cwd, ctx.agentDir);
	const reviewers = getReviewerAgents(agents);

	const targetReviewers = specialties.length > 0
		? reviewers.filter((a) => specialties.includes(a.specialty!))
		: reviewers;

	if (targetReviewers.length === 0) {
		return [{
			success: false,
			summary: `No reviewer agents found. Available specialties: ${reviewers.map(a => a.specialty).join(", ")}`,
			phaseName: "review",
		}];
	}

	return Promise.all(
		targetReviewers.map((agent) => runSpecialistReview(ctx, agent, scope, onProgress)),
	);
}
