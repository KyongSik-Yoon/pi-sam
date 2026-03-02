import { getModel } from "@mariozechner/pi-ai";
import chalk from "chalk";
import { createInterface } from "readline";
import {
	createAgentSession,
	createCodingTools,
	AuthStorage,
	ModelRegistry,
	SessionManager,
	SettingsManager,
	DefaultResourceLoader,
	type ToolDefinition,
	type ExtensionFactory,
} from "@mariozechner/pi-coding-agent";
import { join } from "path";
import { APP_NAME, VERSION, getAgentDir } from "./config.js";
import { getSystemPrompt } from "./system-prompt.js";
import { createK8sTool, createGradleTool, createDockerTool } from "./tools/index.js";
import { kotlinGuardHook, ktorHelperHook } from "./hooks/index.js";
import { isWorkflowCommand, handleWorkflowCommand, type WorkflowContext } from "./workflows/index.js";

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
  -t, --thinking <level>    Thinking level: off, low, medium, high
  -p, --print               Non-interactive print mode
  -c, --continue            Continue most recent session
  -h, --help                Show this help
  -v, --version             Show version

${chalk.bold("Workflow Commands (interactive mode):")}
  /autopilot <task>              Autonomous explore→plan→execute→verify pipeline
  /plan <task>                   Plan with user approval, then execute→verify
  /review <security|test|architecture|performance|all>  Specialist review
  /model                         Select model from available models
  /login                         OAuth login (Anthropic, GitHub Copilot, Gemini)
  /logout                        Remove saved credentials

${chalk.bold("Examples:")}
  ${APP_NAME}                                    Interactive mode
  ${APP_NAME} "Ktor 라우팅 코드를 리뷰해줘"       Single prompt
  ${APP_NAME} -m anthropic/claude-opus-4-6 -t high  With specific model
  echo "analyze this" | ${APP_NAME} -p             Piped input
`);
}

const OAUTH_PROVIDERS = ["anthropic", "github-copilot", "google-gemini-cli", "google-antigravity"] as const;

async function handleLoginCommand(
	rl: ReturnType<typeof createInterface>,
	authStorage: AuthStorage,
): Promise<void> {
	console.log(chalk.bold("\nOAuth Providers:"));
	OAUTH_PROVIDERS.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));

	const answer = await new Promise<string>((resolve) => {
		rl.question(chalk.cyan("Select provider (1-4): "), resolve);
	});

	const idx = parseInt(answer.trim(), 10) - 1;
	if (idx < 0 || idx >= OAUTH_PROVIDERS.length) {
		console.log(chalk.yellow("Invalid selection."));
		return;
	}

	const provider = OAUTH_PROVIDERS[idx];
	console.log(chalk.dim(`Logging in to ${provider}...`));

	try {
		await authStorage.login(provider as any, {
			onAuth: ({ url, instructions }) => {
				if (instructions) console.log(chalk.dim(instructions));
				console.log(chalk.bold(`\nOpen in browser: ${url}\n`));
			},
			onPrompt: async ({ message, placeholder }) => {
				const prompt = placeholder ? `${message} (${placeholder})` : message;
				return new Promise<string>((resolve) => {
					rl.question(chalk.cyan(`${prompt}: `), resolve);
				});
			},
			onProgress: (message) => {
				console.log(chalk.dim(message));
			},
		});
		console.log(chalk.green(`Logged in to ${provider} successfully.`));
	} catch (err: any) {
		console.log(chalk.red(`Login failed: ${err.message ?? err}`));
	}
}

async function handleModelCommand(
	rl: ReturnType<typeof createInterface>,
	session: Awaited<ReturnType<typeof createAgentSession>>["session"],
): Promise<void> {
	const PREFERRED_MODELS = ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"];
	const all = session.modelRegistry.getAvailable();
	const available = all.filter((m) => PREFERRED_MODELS.includes(m.id));
	if (available.length === 0) {
		console.log(chalk.yellow("No models available."));
		return;
	}

	const currentId = session.model?.id;
	console.log(chalk.bold("\nAvailable Models:"));
	available.forEach((m, i) => {
		const marker = m.id === currentId ? chalk.green(" (current)") : "";
		console.log(`  ${i + 1}. ${chalk.dim(m.provider + "/")}${m.id}${marker}`);
	});

	const answer = await new Promise<string>((resolve) => {
		rl.question(chalk.cyan(`Select model (1-${available.length}, q to cancel): `), resolve);
	});

	const trimmedAnswer = answer.trim();
	if (!trimmedAnswer || trimmedAnswer === "q") return;

	const idx = parseInt(trimmedAnswer, 10) - 1;
	if (idx < 0 || idx >= available.length) {
		console.log(chalk.yellow("Invalid selection."));
		return;
	}

	const selected = available[idx];
	try {
		await session.setModel(selected);
		console.log(chalk.green(`Model set to ${selected.provider}/${selected.id}`));
	} catch (err: any) {
		console.log(chalk.red(`Failed to set model: ${err.message ?? err}`));
	}
}

async function handleLogoutCommand(
	rl: ReturnType<typeof createInterface>,
	authStorage: AuthStorage,
): Promise<void> {
	const providers = authStorage.list();
	if (providers.length === 0) {
		console.log(chalk.yellow("No providers logged in."));
		return;
	}

	console.log(chalk.bold("\nLogged-in providers:"));
	providers.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));

	const answer = await new Promise<string>((resolve) => {
		rl.question(chalk.cyan(`Select provider to logout (1-${providers.length}): `), resolve);
	});

	const idx = parseInt(answer.trim(), 10) - 1;
	if (idx < 0 || idx >= providers.length) {
		console.log(chalk.yellow("Invalid selection."));
		return;
	}

	authStorage.logout(providers[idx]);
	console.log(chalk.green(`Logged out from ${providers[idx]}.`));
}

async function runInteractive(
	session: Awaited<ReturnType<typeof createAgentSession>>["session"],
	initialMessages: string[],
	workflowCtx: WorkflowContext,
	authStorage: AuthStorage,
): Promise<void> {
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	// Subscribe to session events for output
	session.subscribe((event) => {
		switch (event.type) {
			case "message_update":
				if (event.assistantMessageEvent.type === "text_delta") {
					process.stdout.write(event.assistantMessageEvent.delta);
				}
				break;
			case "tool_execution_start":
				console.log(chalk.dim(`\n[tool: ${event.toolName}]`));
				break;
			case "tool_execution_end":
				if (event.isError) {
					console.log(chalk.red(`[error]`));
				} else {
					console.log(chalk.dim(`[done]`));
				}
				break;
			case "agent_end":
				console.log();
				break;
		}
	});

	// Process initial messages first
	for (const msg of initialMessages) {
		console.log(chalk.cyan(`> ${msg}`));
		await session.prompt(msg);
	}

	// Interactive loop
	const prompt = (): Promise<string> =>
		new Promise((resolve) => {
			rl.question(chalk.cyan("> "), (answer) => resolve(answer));
		});

	while (true) {
		const input = await prompt();
		const trimmed = input.trim();

		if (!trimmed) continue;
		if (trimmed === "/exit" || trimmed === "/quit") {
			console.log(chalk.dim("Goodbye."));
			break;
		}

		if (trimmed === "/login") {
			await handleLoginCommand(rl, authStorage);
			continue;
		}

		if (trimmed === "/logout") {
			await handleLogoutCommand(rl, authStorage);
			continue;
		}

		if (trimmed === "/model") {
			await handleModelCommand(rl, session);
			continue;
		}

		if (isWorkflowCommand(trimmed)) {
			await handleWorkflowCommand(trimmed, workflowCtx);
			continue;
		}

		await session.prompt(trimmed);
	}

	rl.close();
}

async function runPrint(
	session: Awaited<ReturnType<typeof createAgentSession>>["session"],
	messages: string[],
): Promise<void> {
	session.subscribe((event) => {
		if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
			process.stdout.write(event.assistantMessageEvent.delta);
		}
	});

	for (const msg of messages) {
		await session.prompt(msg);
	}
	console.log();
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

	// Custom tools
	const customTools: ToolDefinition<any>[] = [
		createK8sTool(cwd),
		createGradleTool(cwd),
		createDockerTool(cwd),
	];

	// ResourceLoader with extensions
	const resourceLoader = new DefaultResourceLoader({
		cwd,
		agentDir,
		extensionFactories: [kotlinGuardHook, ktorHelperHook(cwd)],
		appendSystemPrompt: getSystemPrompt(""),
	});
	await resourceLoader.reload();

	// Create agent session
	const { session, modelFallbackMessage } = await createAgentSession({
		cwd,
		agentDir,
		model,
		thinkingLevel: parsed.thinking ?? "off",
		authStorage,
		modelRegistry,
		tools: createCodingTools(cwd),
		customTools,
		resourceLoader,
		sessionManager,
	});

	if (!session.model) {
		console.error(chalk.red("No models available."));
		console.error(chalk.yellow("\nSet an API key environment variable:"));
		console.error("  ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, etc.");

		// In non-interactive (print/pipe) mode, exit immediately
		if (parsed.print || !process.stdin.isTTY) {
			process.exit(1);
		}

		// Interactive mode: offer login before giving up
		console.log(chalk.cyan("\nOr login via OAuth to continue:"));
		const rl = createInterface({ input: process.stdin, output: process.stdout });

		let loggedIn = false;
		while (true) {
			const answer = await new Promise<string>((resolve) => {
				rl.question(chalk.cyan("Login now? (y/n): "), resolve);
			});
			const choice = answer.trim().toLowerCase();

			if (choice === "n" || choice === "no") {
				rl.close();
				process.exit(1);
			}
			if (choice === "y" || choice === "yes") {
				await handleLoginCommand(rl, authStorage);

				// Re-discover models after login
				modelRegistry.refresh();
				const retryResult = await createAgentSession({
					cwd,
					agentDir,
					model,
					thinkingLevel: parsed.thinking ?? "off",
					authStorage,
					modelRegistry,
					tools: createCodingTools(cwd),
					customTools,
					resourceLoader,
					sessionManager,
				});

				if (retryResult.session.model) {
					// Replace session references for the rest of main()
					Object.assign(session, retryResult.session);
					if (retryResult.modelFallbackMessage) {
						console.log(chalk.yellow(retryResult.modelFallbackMessage));
					}
					loggedIn = true;
					rl.close();
					break;
				}

				console.error(chalk.red("Still no models available. Try another provider?"));
				continue;
			}
		}

		if (!loggedIn) {
			process.exit(1);
		}
	}

	if (modelFallbackMessage) {
		console.log(chalk.yellow(modelFallbackMessage));
	}

	console.log(chalk.dim(`${APP_NAME} v${VERSION} | ${session.model!.id}`));

	// Build workflow context for slash commands
	const workflowCtx: WorkflowContext = {
		cwd,
		agentDir,
		authStorage,
		modelRegistry,
		model,
		thinkingLevel: parsed.thinking ?? "off",
		onPhaseStart: (phase) => {
			console.log(chalk.blue(`\n▶ Phase: ${phase}`));
		},
		onPhaseEnd: (phase, result) => {
			const icon = result.success ? chalk.green("✓") : chalk.red("✗");
			console.log(`${icon} ${chalk.bold(phase)} completed`);
		},
		onOutput: (delta) => {
			process.stdout.write(delta);
		},
	};

	if (parsed.print) {
		await runPrint(session, parsed.messages);
		process.exit(0);
	} else {
		await runInteractive(session, parsed.messages, workflowCtx, authStorage);
		process.exit(0);
	}
}
