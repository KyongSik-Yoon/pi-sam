import type { HookFactory } from "@mariozechner/pi-coding-agent";

const SENSITIVE_FILE_PATTERNS = [
	/application-prod\.(conf|yml|yaml|properties)$/,
	/\.env\.prod/,
	/\.env\.production/,
	/secrets?\.(yml|yaml|json|conf)$/,
	/credentials\.(json|properties)$/,
	/keystore\.(jks|p12|pfx)$/,
];

const DANGEROUS_BASH_PATTERNS = [
	/\brm\s+-rf\s+\//,
	/\bkubectl\s+delete\b/,
	/\bkubectl\s+drain\b/,
	/\bdocker\s+rm\s+-f\b/,
	/\bdocker\s+system\s+prune\b/,
	/\bgit\s+push\s+--force\b/,
	/\bgit\s+reset\s+--hard\b/,
];

export const kotlinGuardHook: HookFactory = (pi) => {
	pi.on("tool_call", async (event) => {
		const toolName = event.toolName;

		// Block dangerous bash commands
		if (toolName === "bash") {
			const command = event.input?.command as string | undefined;
			if (command) {
				for (const pattern of DANGEROUS_BASH_PATTERNS) {
					if (pattern.test(command)) {
						return {
							block: true,
							reason: `Blocked potentially destructive command: ${command.slice(0, 80)}`,
						};
					}
				}
			}
		}

		// Warn on sensitive file edits
		if (toolName === "write" || toolName === "edit") {
			const path = (event.input?.file_path ?? event.input?.path) as string | undefined;
			if (path) {
				for (const pattern of SENSITIVE_FILE_PATTERNS) {
					if (pattern.test(path)) {
						return {
							block: true,
							reason: `Blocked edit to sensitive file: ${path}. Production config files should not be modified by the agent.`,
						};
					}
				}
			}
		}

		return undefined;
	});
};
