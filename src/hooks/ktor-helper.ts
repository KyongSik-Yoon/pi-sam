import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { HookFactory } from "@mariozechner/pi-coding-agent";

interface ProjectInfo {
	type: "ktor" | "spring-boot" | "kotlin" | "java" | "unknown";
	buildSystem: "gradle-kts" | "gradle" | "maven" | "unknown";
	hasDocker: boolean;
	hasK8s: boolean;
	modules: string[];
}

function detectProject(cwd: string): ProjectInfo {
	const info: ProjectInfo = {
		type: "unknown",
		buildSystem: "unknown",
		hasDocker: false,
		hasK8s: false,
		modules: [],
	};

	// Detect build system
	if (existsSync(join(cwd, "build.gradle.kts"))) {
		info.buildSystem = "gradle-kts";
	} else if (existsSync(join(cwd, "build.gradle"))) {
		info.buildSystem = "gradle";
	} else if (existsSync(join(cwd, "pom.xml"))) {
		info.buildSystem = "maven";
	}

	// Detect project type
	if (existsSync(join(cwd, "src", "main", "resources", "application.conf"))) {
		info.type = "ktor";
	} else if (existsSync(join(cwd, "src", "main", "resources", "application.yaml"))) {
		info.type = info.buildSystem === "gradle-kts" ? "ktor" : "spring-boot";
	} else if (existsSync(join(cwd, "src", "main", "resources", "application.properties"))) {
		info.type = "spring-boot";
	} else if (existsSync(join(cwd, "src", "main", "kotlin"))) {
		info.type = "kotlin";
	} else if (existsSync(join(cwd, "src", "main", "java"))) {
		info.type = "java";
	}

	// Detect Docker
	info.hasDocker =
		existsSync(join(cwd, "Dockerfile")) ||
		existsSync(join(cwd, "docker-compose.yml")) ||
		existsSync(join(cwd, "docker-compose.yaml"));

	// Detect K8s manifests
	const k8sDirs = ["k8s", "kubernetes", "deploy", "manifests", "helm"];
	info.hasK8s = k8sDirs.some((dir) => existsSync(join(cwd, dir)));

	// Detect submodules
	const settingsFile = join(cwd, "settings.gradle.kts");
	if (existsSync(settingsFile)) {
		try {
			const content = readFileSync(settingsFile, "utf-8");
			const includePattern = /include\s*\(\s*"([^"]+)"\s*\)/g;
			let match;
			while ((match = includePattern.exec(content)) !== null) {
				info.modules.push(match[1]);
			}
		} catch {
			// ignore read errors
		}
	}

	return info;
}

function formatProjectContext(info: ProjectInfo): string {
	const lines: string[] = ["## Detected Project Context"];

	const typeLabels: Record<string, string> = {
		ktor: "Ktor (Kotlin)",
		"spring-boot": "Spring Boot",
		kotlin: "Kotlin",
		java: "Java",
		unknown: "Unknown",
	};

	lines.push(`- **Type**: ${typeLabels[info.type]}`);
	lines.push(`- **Build**: ${info.buildSystem}`);

	if (info.hasDocker) lines.push("- **Docker**: detected");
	if (info.hasK8s) lines.push("- **Kubernetes**: manifests detected");
	if (info.modules.length > 0) {
		lines.push(`- **Modules**: ${info.modules.join(", ")}`);
	}

	if (info.type === "ktor") {
		lines.push("");
		lines.push("### Ktor Hints");
		lines.push("- Config: `src/main/resources/application.conf` (HOCON) or `application.yaml`");
		lines.push("- Entry: `fun main()` -> `embeddedServer(Netty, ...)` or `EngineMain.main(args)`");
		lines.push("- Routing: `routing { get(\"/\") { ... } }` in module functions");
		lines.push("- Plugins: `install(ContentNegotiation)`, `install(Authentication)`, etc.");
	}

	return lines.join("\n");
}

export function ktorHelperHook(cwd: string): HookFactory {
	return (pi) => {
		let contextInjected = false;

		pi.on("agent_start", async () => {
			// Pre-detect on first agent start
			contextInjected = false;
		});

		pi.on("turn_start", async () => {
			if (!contextInjected) {
				const info = detectProject(cwd);
				if (info.type !== "unknown") {
					const context = formatProjectContext(info);
					pi.send(`<project-context>\n${context}\n</project-context>`);
				}
				contextInjected = true;
			}
		});
	};
}
