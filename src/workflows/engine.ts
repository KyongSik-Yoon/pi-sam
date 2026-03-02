import {
	createAgentSession,
	createCodingTools,
	createReadOnlyTools,
	SessionManager,
	DefaultResourceLoader,
} from "@mariozechner/pi-coding-agent";
import type { WorkflowContext, PhaseConfig, PhaseResult } from "./types.js";

/**
 * Parse a verifier's text output into a success/fail result.
 * Shared by autopilot and plan-execute workflows.
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
 * Run a single workflow phase by creating an ephemeral sub-agent session.
 */
export async function runPhase(
	ctx: WorkflowContext,
	config: PhaseConfig,
	input: string,
): Promise<PhaseResult> {
	ctx.onPhaseStart?.(config.name);

	const tools =
		config.tools === "full"
			? createCodingTools(ctx.cwd)
			: createReadOnlyTools(ctx.cwd);

	const resourceLoader = new DefaultResourceLoader({
		cwd: ctx.cwd,
		agentDir: ctx.agentDir,
		noExtensions: true,
		noSkills: true,
		noPromptTemplates: true,
		noThemes: true,
		appendSystemPrompt: config.systemPrompt,
	});
	await resourceLoader.reload();

	const { session } = await createAgentSession({
		cwd: ctx.cwd,
		agentDir: ctx.agentDir,
		authStorage: ctx.authStorage,
		modelRegistry: ctx.modelRegistry,
		model: ctx.model,
		thinkingLevel: ctx.thinkingLevel,
		tools,
		customTools: [],
		resourceLoader,
		sessionManager: SessionManager.inMemory(ctx.cwd),
	});

	// Stream output if callback provided
	if (ctx.onOutput) {
		const onOutput = ctx.onOutput;
		session.subscribe((event) => {
			if (
				event.type === "message_update" &&
				event.assistantMessageEvent.type === "text_delta"
			) {
				onOutput(event.assistantMessageEvent.delta);
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

	let success: boolean;
	let summary: string;

	if (config.extractResult) {
		const extracted = config.extractResult(lastText);
		success = extracted.success;
		summary = extracted.summary;
	} else {
		success = true;
		summary = lastText;
	}

	const result: PhaseResult = { success, summary, phaseName: config.name };
	ctx.onPhaseEnd?.(config.name, result);
	return result;
}

/**
 * Run a sequence of workflow phases, piping each phase's summary as input to the next.
 */
export async function runWorkflow(
	ctx: WorkflowContext,
	phases: PhaseConfig[],
	task: string,
): Promise<PhaseResult[]> {
	const results: PhaseResult[] = [];

	for (const phase of phases) {
		const input = results.length === 0
			? task
			: `## Original Task\n${task}\n\n## Previous Phase (${results[results.length - 1].phaseName}) Output\n${results[results.length - 1].summary}\n\n## Your Task\nProceed with the ${phase.name} phase.`;

		const result = await runPhase(ctx, phase, input);
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
): Promise<PhaseResult[]> {
	const results: PhaseResult[] = [];

	let verifyResult = await runPhase(ctx, verifyPhase, verifyInput);
	results.push(verifyResult);

	let fixCount = 0;
	while (!verifyResult.success && fixCount < maxFixes) {
		fixCount++;

		const fixInput = `## Original Task\n${task}\n\n## Verification Failure\n${verifyResult.summary}\n\n## Your Task\nFix the issues found during verification. This is fix attempt ${fixCount}/${maxFixes}.`;
		const fixResult = await runPhase(ctx, fixPhase, fixInput);
		results.push(fixResult);

		const reVerifyInput = `## Original Task\n${task}\n\n## Fix Applied\n${fixResult.summary}\n\n## Your Task\nRe-verify the implementation after fixes.`;
		verifyResult = await runPhase(ctx, verifyPhase, reVerifyInput);
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
): Promise<PhaseResult[]> {
	const results = await runWorkflow(ctx, mainPhases, task);
	const lastResult = results[results.length - 1];

	const verifyInput = `## Original Task\n${task}\n\n## Implementation Summary\n${lastResult.summary}\n\n## Your Task\nVerify the implementation.`;
	const loopResults = await runVerifyFixLoop(ctx, verifyPhase, fixPhase, task, verifyInput, maxFixes);
	results.push(...loopResults);

	return results;
}
