import { getModel } from "@mariozechner/pi-ai";
import chalk from "chalk";
import {
	createAgentSession,
	createCodingTools,
	AuthStorage,
	ModelRegistry,
	SessionManager,
	DefaultResourceLoader,
	InteractiveMode,
	runPrintMode,
} from "@mariozechner/pi-coding-agent";
import { join } from "path";
import { APP_NAME, VERSION, getAgentDir } from "./config.js";
import { getSystemPrompt } from "./system-prompt.js";
import { kotlinGuardHook, ktorHelperHook } from "./hooks/index.js";
import { workflowExtension, brandingHeaderExtension, minimalReadRendererExtension, customToolsExtension, zaiLoginCommandExtension, helpExtension } from "./extensions/index.js";
import type { WorkflowContext } from "./workflows/types.js";

interface ParsedArgs {
	model?: string;
	thinking?: "off" | "low" | "medium" | "high";
	print: boolean;
	continue_: boolean;
	messages: string[];
	help: boolean;
	version: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
	const parsed: ParsedArgs = {
		print: false,
		continue_: false,
		messages: [],
		help: false,
		version: false,
	};

	let i = 0;
	while (i < args.length) {
		const arg = args[i];
		switch (arg) {
			case "--model":
			case "-m":
				parsed.model = args[++i];
				break;
			case "--thinking":
			case "-t":
				parsed.thinking = args[++i] as ParsedArgs["thinking"];
				break;
			case "--print":
			case "-p":
				parsed.print = true;
				break;
			case "--continue":
			case "-c":
				parsed.continue_ = true;
				break;
			case "--help":
			case "-h":
				parsed.help = true;
				break;
			case "--version":
			case "-v":
				parsed.version = true;
				break;
			default:
				if (!arg.startsWith("-")) {
					parsed.messages.push(arg);
				}
				break;
		}
		i++;
	}

	return parsed;
}

function printHelp(): void {
	console.log(`${chalk.bold(APP_NAME)} v${VERSION} - Kotlin/Ktor Backend Coding Agent

${chalk.bold("Usage:")}
  ${APP_NAME} [options] [message...]

${chalk.bold("Options:")}
  -m, --model <model>       Model to use (e.g. anthropic/claude-sonnet-4-6)
  -t, --thinking <level>    Thinking level: off, low, medium, high (default: high)
  -p, --print               Non-interactive print mode
  -c, --continue            Continue most recent session
  -h, --help                Show this help
  -v, --version             Show version

${chalk.bold("Workflow Commands (interactive mode):")}
  /autopilot <task>         Autonomous explore→plan→execute→verify pipeline
  /plan <task>              Plan with user approval, then execute→verify
  /review <specialty|all>   Specialist review (security|test|architecture|performance)
  /zai-login                Z.AI API key login (open page + validate + save)

${chalk.bold("Examples:")}
  ${APP_NAME}                                    Interactive mode
  ${APP_NAME} "Ktor 라우팅 코드를 리뷰해줘"       Single prompt
  ${APP_NAME} -m anthropic/claude-opus-4-6 -t high  With specific model
  echo "analyze this" | ${APP_NAME} -p             Piped input
`);
}

export async function main(args: string[]) {
	const parsed = parseArgs(args);

	if (parsed.version) {
		console.log(VERSION);
		process.exit(0);
	}

	if (parsed.help) {
		printHelp();
		process.exit(0);
	}

	// Read piped stdin
	if (!process.stdin.isTTY) {
		const stdinContent = await new Promise<string | undefined>((resolve) => {
			let data = "";
			process.stdin.setEncoding("utf8");
			process.stdin.on("data", (chunk) => {
				data += chunk;
			});
			process.stdin.on("end", () => {
				resolve(data.trim() || undefined);
			});
			process.stdin.resume();
		});
		if (stdinContent) {
			parsed.print = true;
			parsed.messages.unshift(stdinContent);
		}
	}

	const cwd = process.cwd();
	const agentDir = getAgentDir();
	const defaultThinkingLevel = parsed.thinking ?? "high";

	// Auth & model registry
	const authStorage = AuthStorage.create(join(agentDir, "auth.json"));
	const modelRegistry = new ModelRegistry(authStorage, join(agentDir, "models.json"));

	// Resolve model
	const model = parsed.model
		? (() => {
				const parts = parsed.model!.split("/");
				if (parts.length === 2) {
					return getModel(parts[0] as any, parts[1]) ?? undefined;
				}
				return undefined;
			})()
		: undefined;

	// Session manager
	let sessionManager: SessionManager | undefined;
	if (parsed.continue_) {
		sessionManager = SessionManager.continueRecent(cwd);
	}

	// Workflow context for extension
	const workflowCtx: WorkflowContext = {
		cwd,
		agentDir,
		authStorage,
		modelRegistry,
		model,
		thinkingLevel: defaultThinkingLevel,
	};

	// ResourceLoader with extensions
	const resourceLoader = new DefaultResourceLoader({
		cwd,
		agentDir,
		extensionFactories: [
			kotlinGuardHook,
			ktorHelperHook(cwd),
			helpExtension(),
			workflowExtension(workflowCtx),
			brandingHeaderExtension,
			minimalReadRendererExtension,
			customToolsExtension(cwd, agentDir),
			zaiLoginCommandExtension,
		],
		appendSystemPrompt: getSystemPrompt("", cwd),
	});
	await resourceLoader.reload();

	// Create agent session
	const { session, modelFallbackMessage } = await createAgentSession({
		cwd,
		agentDir,
		model,
		thinkingLevel: defaultThinkingLevel,
		authStorage,
		modelRegistry,
		tools: createCodingTools(cwd),
		resourceLoader,
		sessionManager,
	});

	if (parsed.print) {
		// Print mode
		if (!session.model) {
			console.error(chalk.red("No models available. Set an API key or run interactively to login."));
			process.exit(1);
		}
		await runPrintMode(session, {
			mode: "text",
			initialMessage: parsed.messages[0],
			messages: parsed.messages.slice(1),
		});
		process.exit(0);
	} else {
		// Interactive mode with full TUI
		const mode = new InteractiveMode(session, {
			modelFallbackMessage,
			initialMessage: parsed.messages[0],
			initialMessages: parsed.messages.slice(1),
		});
		await mode.run();
		process.exit(0);
	}
}
