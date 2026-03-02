import { homedir } from "os";
import { join } from "path";

export const APP_NAME = "pi-sam";
export const VERSION = "0.1.0";

export function getAgentDir(): string {
	return join(homedir(), `.${APP_NAME}`, "agent");
}

export function getSessionDir(): string {
	return join(homedir(), `.${APP_NAME}`, "sessions");
}
