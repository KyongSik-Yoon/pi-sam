import type { ExtensionFactory } from "@mariozechner/pi-coding-agent";
import { runAutopilot } from "../workflows/autopilot.js";
import { runPlanExecute } from "../workflows/plan-execute.js";
import {
	runSpecialistReviewByName,
	runMultiReview,
} from "../workflows/specialists.js";
import {
	discoverAgents,
	getAvailableSpecialties,
	type ReviewFinding,
	type ReviewResult,
} from "../agents/index.js";
import type { WorkflowContext, PhaseResult, ConfirmResult, PhaseProgress } from "../workflows/types.js";

function formatFindings(review: ReviewResult): string {
	if (review.findings.length === 0) return "";

	const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
	const sorted = [...review.findings].sort(
		(a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5),
	);

	const lines: string[] = ["", "**Findings:**"];
	for (const f of sorted) {
		const icon = f.severity === "critical" ? "🔴" : f.severity === "high" ? "🟠" : f.severity === "medium" ? "🟡" : f.severity === "low" ? "🔵" : "⚪";
		const location = f.file ? (f.line ? `${f.file}:${f.line}` : f.file) : "";
		const locationStr = location ? ` \`${location}\`` : "";
		lines.push(`- ${icon} **${f.severity}**${locationStr} ${f.description}`);
	}
	return lines.join("\n");
}

function formatResults(results: PhaseResult[]): string {
	const lines = ["**Workflow Summary**", ""];

	for (const r of results) {
		const icon = r.success ? "✓" : "✗";
		const duration = r.durationMs ? ` (${(r.durationMs / 1000).toFixed(1)}s)` : "";
		const agent = r.agentName ? ` [${r.agentName}]` : "";
		lines.push(`- ${icon} **${r.phaseName}**${agent}${duration}`);

		// Include structured findings if present
		if (r.review && r.review.findings.length > 0) {
			const findingsStr = formatFindings(r.review);
			if (findingsStr) lines.push(findingsStr);
		}
	}

	const allPassed = results.every((r) => r.success);
	lines.push("");
	lines.push(allPassed ? "Workflow completed successfully." : "Workflow completed with issues.");

	// Summary stats
	const totalDuration = results.reduce((sum, r) => sum + (r.durationMs ?? 0), 0);
	if (totalDuration > 0) {
		lines.push(`Total duration: ${(totalDuration / 1000).toFixed(1)}s`);
	}

	return lines.join("\n");
}

function createProgressCallback(
	notify: (msg: string, level: "info" | "warning") => void,
): (progress: PhaseProgress) => void {
	return (progress) => {
		const { phaseName, agentName, status, toolCount, elapsedMs, currentTool } = progress;
		const elapsed = (elapsedMs / 1000).toFixed(1);

		if (status === "starting") {
			notify(`▶ ${phaseName} [${agentName}] starting...`, "info");
		} else if (status === "running" && currentTool) {
			notify(`⚙ ${phaseName} [${agentName}] ${currentTool} (${toolCount} tools, ${elapsed}s)`, "info");
		} else if (status === "completed") {
			notify(`✓ ${phaseName} [${agentName}] completed (${toolCount} tools, ${elapsed}s)`, "info");
		} else if (status === "failed") {
			notify(`✗ ${phaseName} [${agentName}] failed (${elapsed}s)`, "warning");
		}
	};
}

/**
 * Create an extension factory that registers workflow slash commands.
 * Commands: /autopilot, /plan, /review
 */
export function workflowExtension(
	workflowCtx: WorkflowContext,
): ExtensionFactory {
	return (pi) => {
		pi.registerCommand("autopilot", {
			description: "Autonomous explore→plan→execute→verify pipeline",
			handler: async (args, ctx) => {
				if (!args?.trim()) {
					ctx.ui.notify("Usage: /autopilot <task description>", "warning");
					return;
				}
				ctx.ui.notify(`Autopilot: ${args}`, "info");
				const onProgress = createProgressCallback((msg, level) => ctx.ui.notify(msg, level));
				const results = await runAutopilot(workflowCtx, args.trim(), onProgress);
				pi.sendUserMessage(formatResults(results));
			},
		});

		pi.registerCommand("plan", {
			description: "Plan with user approval, then execute→verify",
			handler: async (args, ctx) => {
				if (!args?.trim()) {
					ctx.ui.notify("Usage: /plan <task description>", "warning");
					return;
				}
				ctx.ui.notify(`Plan & Execute: ${args}`, "info");

				const confirmFn = async (plan: string): Promise<ConfirmResult> => {
					const ok = await ctx.ui.confirm(
						"Approve Plan?",
						plan.slice(0, 500) + (plan.length > 500 ? "\n..." : ""),
					);
					if (ok) {
						return { approved: true };
					}
					return { approved: false };
				};

				const onProgress = createProgressCallback((msg, level) => ctx.ui.notify(msg, level));
				const results = await runPlanExecute(workflowCtx, args.trim(), confirmFn, onProgress);
				pi.sendUserMessage(formatResults(results));
			},
		});

		pi.registerCommand("review", {
			description: "Specialist review (dynamic: discovers available reviewer agents)",
			handler: async (args, ctx) => {
				const specialty = args?.trim().toLowerCase() ?? "";

				// Dynamically discover available specialties
				const { agents } = discoverAgents(workflowCtx.cwd, workflowCtx.agentDir);
				const availableSpecialties = getAvailableSpecialties(agents);

				if (specialty === "all") {
					ctx.ui.notify(`Running all reviews (${availableSpecialties.join(", ")})...`, "info");
					const onProgress = createProgressCallback((msg, level) => ctx.ui.notify(msg, level));
					const results = await runMultiReview(
						workflowCtx,
						availableSpecialties,
						"Review the project's recent code and overall codebase quality.",
						onProgress,
					);
					pi.sendUserMessage(formatResults(results));
					return;
				}

				if (!specialty || !availableSpecialties.includes(specialty)) {
					ctx.ui.notify(
						`Usage: /review <${availableSpecialties.join("|")}|all>`,
						"warning",
					);
					return;
				}

				ctx.ui.notify(`${specialty} review...`, "info");
				const onProgress = createProgressCallback((msg, level) => ctx.ui.notify(msg, level));
				const result = await runSpecialistReviewByName(
					workflowCtx,
					specialty,
					"Review the project's recent code changes and relevant files.",
					onProgress,
				);
				pi.sendUserMessage(formatResults([result]));
			},
		});
	};
}
