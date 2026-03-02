import { Type } from "@sinclair/typebox";
import type { CustomAgentTool } from "@mariozechner/pi-coding-agent";

const K8sParams = Type.Object({
	command: Type.String({
		description:
			"kubectl command to execute (e.g. 'get pods', 'logs deployment/my-app', 'describe pod my-pod')",
	}),
	namespace: Type.Optional(
		Type.String({
			description: "Kubernetes namespace. Defaults to current context namespace.",
		}),
	),
});

const BLOCKED_COMMANDS = ["delete", "drain", "cordon", "taint", "replace --force"];

export function createK8sTool(cwd: string): CustomAgentTool<typeof K8sParams> {
	return {
		name: "k8s",
		label: "Kubernetes",
		description:
			"Execute kubectl commands to inspect and manage Kubernetes resources. Supports get, describe, logs, top, and other read/inspect commands. Destructive commands (delete, drain) are blocked by default.",
		parameters: K8sParams,
		async execute(_toolCallId, params, signal) {
			const cmd = params.command.trim();

			// Block destructive commands
			const firstWord = cmd.split(/\s+/)[0];
			if (BLOCKED_COMMANDS.some((blocked) => cmd.startsWith(blocked) || firstWord === blocked)) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Blocked: '${firstWord}' is a destructive kubectl command. Use the bash tool directly if you need to run this with user confirmation.`,
						},
					],
					details: { blocked: true, command: cmd },
				};
			}

			const nsFlag = params.namespace ? ` -n ${params.namespace}` : "";
			const fullCmd = `kubectl ${cmd}${nsFlag}`;

			const { execSync } = await import("child_process");
			try {
				const output = execSync(fullCmd, {
					cwd,
					encoding: "utf-8",
					timeout: 30000,
					maxBuffer: 1024 * 1024,
				});
				return {
					content: [{ type: "text" as const, text: output }],
					details: { command: fullCmd, success: true },
				};
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					content: [{ type: "text" as const, text: `kubectl error: ${message}` }],
					details: { command: fullCmd, success: false, error: message },
				};
			}
		},
	};
}
