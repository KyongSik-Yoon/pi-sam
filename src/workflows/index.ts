import chalk from "chalk";
import { createInterface } from "readline";
import type { WorkflowContext, ConfirmResult, PhaseResult } from "./types.js";
import { runAutopilot } from "./autopilot.js";
import { runPlanExecute } from "./plan-execute.js";
import { runSpecialistReview, runMultiReview, type Specialty } from "./specialists.js";

const WORKFLOW_COMMANDS = ["/autopilot", "/plan", "/review"];

/**
 * Check if user input is a workflow command.
 */
export function isWorkflowCommand(input: string): boolean {
	const cmd = input.split(/\s+/)[0]?.toLowerCase();
	return WORKFLOW_COMMANDS.includes(cmd);
}

/**
 * Prompt the user to confirm or reject a plan via readline.
 */
async function interactiveConfirm(plan: string): Promise<ConfirmResult> {
	console.log(chalk.bold("\n--- Proposed Plan ---\n"));
	console.log(plan);
	console.log(chalk.bold("\n--- End Plan ---\n"));

	const rl = createInterface({ input: process.stdin, output: process.stdout });
	const answer = await new Promise<string>((resolve) => {
		rl.question(
			chalk.cyan("Approve this plan? [y]es / [n]o / [e]dit feedback: "),
			resolve,
		);
	});

	const trimmed = answer.trim().toLowerCase();
	if (trimmed === "y" || trimmed === "yes") {
		rl.close();
		return { approved: true };
	}

	if (trimmed === "e" || trimmed === "edit") {
		const feedback = await new Promise<string>((resolve) => {
			rl.question(chalk.cyan("Enter feedback: "), resolve);
		});
		rl.close();
		return { approved: true, feedback: feedback.trim() || undefined };
	}

	rl.close();
	return { approved: false };
}

/**
 * Print a summary of workflow results.
 */
function printResults(results: PhaseResult[]): void {
	console.log(chalk.bold("\n--- Workflow Summary ---"));
	for (const r of results) {
		const icon = r.success ? chalk.green("✓") : chalk.red("✗");
		console.log(`  ${icon} ${chalk.bold(r.phaseName)}`);
	}
	const allPassed = results.every((r) => r.success);
	console.log(
		allPassed
			? chalk.green("\nWorkflow completed successfully.")
			: chalk.yellow("\nWorkflow completed with issues."),
	);
}

/**
 * Handle a workflow slash command.
 */
export async function handleWorkflowCommand(
	input: string,
	ctx: WorkflowContext,
): Promise<void> {
	const parts = input.split(/\s+/);
	const cmd = parts[0].toLowerCase();
	const args = parts.slice(1).join(" ").trim();

	switch (cmd) {
		case "/autopilot": {
			if (!args) {
				console.log(chalk.yellow("Usage: /autopilot <task description>"));
				return;
			}
			console.log(chalk.bold(`\nAutopilot: ${args}\n`));
			const results = await runAutopilot(ctx, args);
			printResults(results);
			break;
		}

		case "/plan": {
			if (!args) {
				console.log(chalk.yellow("Usage: /plan <task description>"));
				return;
			}
			console.log(chalk.bold(`\nPlan & Execute: ${args}\n`));
			const results = await runPlanExecute(ctx, args, interactiveConfirm);
			printResults(results);
			break;
		}

		case "/review": {
			const validSpecialties: Specialty[] = ["security", "test", "architecture", "performance"];
			const specialty = args.toLowerCase();

			if (specialty === "all") {
				console.log(chalk.bold("\nRunning all reviews...\n"));
				const results = await runMultiReview(
					ctx,
					validSpecialties,
					"Review the project's recent code and overall codebase quality.",
				);
				printResults(results);
				return;
			}

			if (!specialty || !validSpecialties.includes(specialty as Specialty)) {
				console.log(
					chalk.yellow(
						`Usage: /review <${validSpecialties.join("|")}|all>`,
					),
				);
				return;
			}

			console.log(chalk.bold(`\n${specialty} review...\n`));
			const result = await runSpecialistReview(
				ctx,
				specialty as Specialty,
				"Review the project's recent code changes and relevant files.",
			);
			printResults([result]);
			break;
		}

		default:
			console.log(chalk.yellow(`Unknown workflow command: ${cmd}`));
	}
}

export type { WorkflowContext, PhaseResult, ConfirmResult } from "./types.js";
export { runAutopilot } from "./autopilot.js";
export { runPlanExecute } from "./plan-execute.js";
export { runSpecialistReview, runMultiReview } from "./specialists.js";
