import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export const APP_NAME = "pi-sam";

function resolveVersion(): string {
	try {
		const packageJsonPath = new URL("../package.json", import.meta.url);
		const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
			version?: string;
		};
		return packageJson.version ?? "0.0.0";
	} catch {
		return "0.0.0";
	}
}

export const VERSION = resolveVersion();

export function getAgentDir(): string {
	return join(homedir(), `.${APP_NAME}`, "agent");
}

export function getSessionDir(): string {
	return join(homedir(), `.${APP_NAME}`, "sessions");
}
