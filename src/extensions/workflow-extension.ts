import type { ExtensionFactory } from "@mariozechner/pi-coding-agent";
import { runAutopilot } from "../workflows/autopilot.js";
import { runPlanExecute } from "../workflows/plan-execute.js";
import {
	runSpecialistReview,
	runMultiReview,
	type Specialty,
} from "../workflows/specialists.js";
import type { WorkflowContext, PhaseResult, ConfirmResult } from "../workflows/types.js";

const VALID_SPECIALTIES: Specialty[] = ["security", "test", "architecture", "performance"];

function formatResults(results: PhaseResult[]): string {
	const lines = ["**Workflow Summary**", ""];
	for (const r of results) {
		const icon = r.success ? "✓" : "✗";
		lines.push(`- ${icon} **${r.phaseName}**`);
	}
	const allPassed = results.every((r) => r.success);
	lines.push("");
	lines.push(allPassed ? "Workflow completed successfully." : "Workflow completed with issues.");
	return lines.join("\n");
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
				const results = await runAutopilot(workflowCtx, args.trim());
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

				const results = await runPlanExecute(workflowCtx, args.trim(), confirmFn);
				pi.sendUserMessage(formatResults(results));
			},
		});

		pi.registerCommand("review", {
			description: "Specialist review (security|test|architecture|performance|all)",
			handler: async (args, ctx) => {
				const specialty = args?.trim().toLowerCase() ?? "";

				if (specialty === "all") {
					ctx.ui.notify("Running all reviews...", "info");
					const results = await runMultiReview(
						workflowCtx,
						VALID_SPECIALTIES,
						"Review the project's recent code and overall codebase quality.",
					);
					pi.sendUserMessage(formatResults(results));
					return;
				}

				if (!specialty || !VALID_SPECIALTIES.includes(specialty as Specialty)) {
					ctx.ui.notify(
						`Usage: /review <${VALID_SPECIALTIES.join("|")}|all>`,
						"warning",
					);
					return;
				}

				ctx.ui.notify(`${specialty} review...`, "info");
				const result = await runSpecialistReview(
					workflowCtx,
					specialty as Specialty,
					"Review the project's recent code changes and relevant files.",
				);
				pi.sendUserMessage(formatResults([result]));
			},
		});
	};
}
