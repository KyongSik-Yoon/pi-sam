import { getModel } from "@mariozechner/pi-ai";
import {
	createAgentSession,
	createCodingTools,
	createReadOnlyTools,
	SessionManager,
	DefaultResourceLoader,
} from "@mariozechner/pi-coding-agent";
import type { AgentDefinition } from "../agents/index.js";
import { parseReviewFindings } from "../agents/index.js";
import type {
	WorkflowContext,
	PhaseConfig,
	PhaseResult,
	PhaseProgress,
	WorkflowProgressCallback,
} from "./types.js";

/**
 * Extract verify/review result from agent text output.
 * Uses structured finding parser for reviewer agents.
 */
export function extractVerifyResult(text: string): { success: boolean; summary: string } {
	const upper = text.toUpperCase();
	const hasFail =
		upper.includes("**STATUS:** FAIL") ||
		upper.includes("STATUS: FAIL") ||
		(upper.includes("FAIL") && !upper.includes("**STATUS:** PASS") && !upper.includes("STATUS: PASS"));
	const hasPass =
		upper.includes("**STATUS:** PASS") || upper.includes("STATUS: PASS");

	return {
		success: hasPass && !hasFail,
		summary: text,
	};
}

/**
 * Resolve model override from agent definition.
 * Falls back to workflow context model if agent doesn't specify one.
 */
function resolveModel(ctx: WorkflowContext, agent: AgentDefinition) {
	if (agent.model) {
		const parts = agent.model.split("/");
		if (parts.length === 2) {
			const resolved = getModel(parts[0] as any, parts[1]);
			if (resolved) return { model: resolved, thinkingLevel: agent.thinkingLevel ?? ctx.thinkingLevel };
		}
	}
	return { model: ctx.model, thinkingLevel: agent.thinkingLevel ?? ctx.thinkingLevel };
}

/**
 * Run a single workflow phase by creating an ephemeral sub-agent session.
 */
export async function runPhase(
	ctx: WorkflowContext,
	config: PhaseConfig,
	input: string,
	onProgress?: WorkflowProgressCallback,
): Promise<PhaseResult> {
	const startTime = Date.now();
	const agent = config.agent;

	const tools =
		agent.tools === "full"
			? createCodingTools(ctx.cwd)
			: createReadOnlyTools(ctx.cwd);

	const { model, thinkingLevel } = resolveModel(ctx, agent);

	const resourceLoader = new DefaultResourceLoader({
		cwd: ctx.cwd,
		agentDir: ctx.agentDir,
		noExtensions: true,
		noSkills: true,
		noPromptTemplates: true,
		noThemes: true,
		appendSystemPrompt: agent.systemPrompt,
	});
	await resourceLoader.reload();

	const { session } = await createAgentSession({
		cwd: ctx.cwd,
		agentDir: ctx.agentDir,
		authStorage: ctx.authStorage,
		modelRegistry: ctx.modelRegistry,
		model,
		thinkingLevel,
		tools,
		customTools: [],
		resourceLoader,
		sessionManager: SessionManager.inMemory(ctx.cwd),
	});

	// Track progress via session events
	let toolCount = 0;
	let currentTool: string | undefined;

	if (onProgress) {
		onProgress({
			phaseName: config.name,
			agentName: agent.name,
			status: "starting",
			toolCount: 0,
			elapsedMs: 0,
		});

		session.subscribe((event) => {
			if (event.type === "tool_execution_start") {
				toolCount++;
				currentTool = (event as any).toolName ?? undefined;
				onProgress({
					phaseName: config.name,
					agentName: agent.name,
					status: "running",
					toolCount,
					elapsedMs: Date.now() - startTime,
					currentTool,
				});
			} else if (event.type === "tool_execution_end") {
				currentTool = undefined;
				onProgress({
					phaseName: config.name,
					agentName: agent.name,
					status: "running",
					toolCount,
					elapsedMs: Date.now() - startTime,
				});
			}
		});
	}

	let lastText: string;
	try {
		await session.prompt(input);
		lastText = session.getLastAssistantText() ?? "";
	} finally {
		session.dispose();
	}

	const durationMs = Date.now() - startTime;

	let success: boolean;
	let summary: string;
	let review;

	if (config.extractResult) {
		const extracted = config.extractResult(lastText);
		success = extracted.success;
		summary = extracted.summary;
		review = extracted.review;
	} else if (agent.extractVerifyResult) {
		const extracted = extractVerifyResult(lastText);
		success = extracted.success;
		summary = extracted.summary;
		// Also parse structured findings
		review = parseReviewFindings(lastText);
		review.passed = success;
	} else {
		success = true;
		summary = lastText;
	}

	const result: PhaseResult = {
		success,
		summary,
		phaseName: config.name,
		review,
		durationMs,
		agentName: agent.name,
	};

	if (onProgress) {
		onProgress({
			phaseName: config.name,
			agentName: agent.name,
			status: success ? "completed" : "failed",
			toolCount,
			elapsedMs: durationMs,
		});
	}

	return result;
}

/**
 * Run a sequence of workflow phases, piping each phase's summary as input to the next.
 */
export async function runWorkflow(
	ctx: WorkflowContext,
	phases: PhaseConfig[],
	task: string,
	onProgress?: WorkflowProgressCallback,
): Promise<PhaseResult[]> {
	const results: PhaseResult[] = [];

	for (const phase of phases) {
		const input = results.length === 0
			? task
			: `## Original Task\n${task}\n\n## Previous Phase (${results[results.length - 1].phaseName}) Output\n${results[results.length - 1].summary}\n\n## Your Task\nProceed with the ${phase.name} phase.`;

		const result = await runPhase(ctx, phase, input, onProgress);
		results.push(result);

		if (!result.success && phase.name === "verify") {
			break;
		}
	}

	return results;
}

/**
 * Run a verify→fix loop. Re-verifies after each fix, up to maxFixes times.
 */
export async function runVerifyFixLoop(
	ctx: WorkflowContext,
	verifyPhase: PhaseConfig,
	fixPhase: PhaseConfig,
	task: string,
	verifyInput: string,
	maxFixes: number = 3,
	onProgress?: WorkflowProgressCallback,
): Promise<PhaseResult[]> {
	const results: PhaseResult[] = [];

	let verifyResult = await runPhase(ctx, verifyPhase, verifyInput, onProgress);
	results.push(verifyResult);

	let fixCount = 0;
	while (!verifyResult.success && fixCount < maxFixes) {
		fixCount++;

		const fixInput = `## Original Task\n${task}\n\n## Verification Failure\n${verifyResult.summary}\n\n## Your Task\nFix the issues found during verification. This is fix attempt ${fixCount}/${maxFixes}.`;
		const fixResult = await runPhase(ctx, fixPhase, fixInput, onProgress);
		results.push(fixResult);

		const reVerifyInput = `## Original Task\n${task}\n\n## Fix Applied\n${fixResult.summary}\n\n## Your Task\nRe-verify the implementation after fixes.`;
		verifyResult = await runPhase(ctx, verifyPhase, reVerifyInput, onProgress);
		results.push(verifyResult);
	}

	return results;
}

/**
 * Run a workflow with a verify→fix loop.
 * If verification fails, runs a fix phase and re-verifies, up to maxFixes times.
 */
export async function runWorkflowWithFixLoop(
	ctx: WorkflowContext,
	mainPhases: PhaseConfig[],
	verifyPhase: PhaseConfig,
	fixPhase: PhaseConfig,
	task: string,
	maxFixes: number = 3,
	onProgress?: WorkflowProgressCallback,
): Promise<PhaseResult[]> {
	const results = await runWorkflow(ctx, mainPhases, task, onProgress);
	const lastResult = results[results.length - 1];

	const verifyInput = `## Original Task\n${task}\n\n## Implementation Summary\n${lastResult.summary}\n\n## Your Task\nVerify the implementation.`;
	const loopResults = await runVerifyFixLoop(ctx, verifyPhase, fixPhase, task, verifyInput, maxFixes, onProgress);
	results.push(...loopResults);

	return results;
}
