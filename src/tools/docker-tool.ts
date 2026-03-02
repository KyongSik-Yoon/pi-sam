import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";

const DockerParams = Type.Object({
	command: Type.String({
		description:
			"Docker command to execute (e.g. 'ps', 'logs my-container', 'compose up -d', 'compose logs app')",
	}),
});

const BLOCKED_PATTERNS = [
	/\brm\s+-f\b/,
	/\bsystem\s+prune\b/,
	/\bvolume\s+rm\b/,
	/\bimage\s+rm\b/,
];

export function createDockerTool(cwd: string): ToolDefinition<typeof DockerParams> {
	return {
		name: "docker",
		label: "Docker",
		description:
			"Execute Docker and docker-compose commands. Supports ps, logs, compose up/down/logs, build, images, inspect. Destructive commands (rm -f, prune) are blocked.",
		parameters: DockerParams,
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const cmd = params.command.trim();

			if (BLOCKED_PATTERNS.some((pattern) => pattern.test(cmd))) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Blocked: this Docker command may be destructive. Use the bash tool directly if needed.`,
						},
					],
					details: { blocked: true, command: cmd },
				};
			}

			const fullCmd = cmd.startsWith("compose") ? `docker ${cmd}` : `docker ${cmd}`;

			const { execSync } = await import("child_process");
			try {
				const output = execSync(fullCmd, {
					cwd,
					encoding: "utf-8",
					timeout: 60000,
					maxBuffer: 2 * 1024 * 1024,
				});
				return {
					content: [{ type: "text" as const, text: output }],
					details: { command: fullCmd, success: true },
				};
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					content: [{ type: "text" as const, text: `Docker error: ${message}` }],
					details: { command: fullCmd, success: false, error: message },
				};
			}
		},
	};
}
