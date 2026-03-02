import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";

const GradleParams = Type.Object({
	task: Type.String({
		description:
			"Gradle task to run (e.g. 'build', 'test', 'dependencies', 'bootRun', 'classes')",
	}),
	args: Type.Optional(
		Type.String({
			description: "Additional Gradle arguments (e.g. '--info', '--stacktrace', '-x test')",
		}),
	),
	subproject: Type.Optional(
		Type.String({
			description: "Subproject path for multi-module builds (e.g. ':app', ':core:domain')",
		}),
	),
});

export function createGradleTool(cwd: string): ToolDefinition<typeof GradleParams> {
	return {
		name: "gradle",
		label: "Gradle",
		description:
			"Run Gradle tasks for Kotlin/Java projects. Supports build, test, dependencies, and custom tasks. Automatically detects gradlew wrapper.",
		parameters: GradleParams,
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const { existsSync } = await import("fs");
			const { join } = await import("path");

			// Detect gradle wrapper
			const gradlew = join(cwd, "gradlew");
			const gradle = existsSync(gradlew) ? "./gradlew" : "gradle";

			const taskRef = params.subproject ? `${params.subproject}:${params.task}` : params.task;
			const extraArgs = params.args ? ` ${params.args}` : "";
			const fullCmd = `${gradle} ${taskRef}${extraArgs}`;

			const { execSync } = await import("child_process");
			try {
				const output = execSync(fullCmd, {
					cwd,
					encoding: "utf-8",
					timeout: 300000, // 5 min for builds
					maxBuffer: 5 * 1024 * 1024,
					env: { ...process.env, TERM: "dumb" }, // disable Gradle rich console
				});
				return {
					content: [{ type: "text" as const, text: output }],
					details: { command: fullCmd, success: true },
				};
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					content: [{ type: "text" as const, text: `Gradle error:\n${message}` }],
					details: { command: fullCmd, success: false, error: message },
				};
			}
		},
	};
}
