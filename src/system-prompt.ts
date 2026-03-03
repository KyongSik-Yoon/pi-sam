import { existsSync } from "fs";
import { join } from "path";

/** Detected project stack signals */
interface ProjectSignals {
	kotlin: boolean;
	java: boolean;
	typescript: boolean;
	javascript: boolean;
	python: boolean;
	go: boolean;
	rust: boolean;
	gradle: boolean;
	maven: boolean;
	docker: boolean;
	k8s: boolean;
}

function detectProject(cwd: string): ProjectSignals {
	const has = (file: string) => existsSync(join(cwd, file));

	return {
		kotlin: has("build.gradle.kts") || has("settings.gradle.kts") || has("src/main/kotlin"),
		java: has("src/main/java") || has("pom.xml") || has("build.gradle"),
		typescript: has("tsconfig.json"),
		javascript: has("package.json") && !has("tsconfig.json"),
		python: has("pyproject.toml") || has("setup.py") || has("requirements.txt") || has("Pipfile"),
		go: has("go.mod"),
		rust: has("Cargo.toml"),
		gradle: has("build.gradle.kts") || has("build.gradle") || has("gradlew"),
		maven: has("pom.xml"),
		docker: has("Dockerfile") || has("docker-compose.yml") || has("docker-compose.yaml"),
		k8s: has("k8s") || has("kubernetes") || has("helm") || has("Chart.yaml"),
	};
}

// ── Expertise blocks ──

const SKILLS_SECTION = `## Development Methodology: Superpowers Skills

You have access to a \`skill\` tool that provides structured development methodology skills.
These skills enforce proven workflows for brainstorming, TDD, debugging, planning, code review, and more.

### The Rule

**Before starting any task, check if a skill applies.** Even a 1% chance means invoke the skill.

- Use the \`skill\` tool with action "list" to see available skills.
- Use the \`skill\` tool with action "invoke" and a skill name to load it.
- When a skill is loaded, follow its instructions exactly.

### Key Skills

| Skill | When to use |
|-------|-------------|
| brainstorming | Before any creative/feature work — explore design before implementation |
| test-driven-development | When implementing any feature or bugfix — write tests first |
| systematic-debugging | When encountering bugs or test failures — investigate root cause |
| writing-plans | When you have a multi-step task — break it down before coding |
| verification-before-completion | Before claiming work is done — verify with evidence |
| requesting-code-review | After completing implementation — review before merging |

### Skill Priority

1. **Process skills first** (brainstorming, debugging) — determine HOW to approach
2. **Implementation skills second** (TDD, plans) — guide execution

"Build X" → brainstorming first, then implementation skills.
"Fix this bug" → systematic-debugging first, then domain-specific skills.`;

const KOTLIN_EXPERTISE = `### Kotlin & Ktor
- Ktor server architecture: routing, plugins (Authentication, ContentNegotiation, StatusPages, CORS, WebSockets), application modules
- Kotlin coroutines and structured concurrency (CoroutineScope, supervisorScope, async/await, Flow)
- Koin dependency injection (modules, single, factory, inject, get)
- Exposed ORM (DSL and DAO, transactions, migrations)
- Kotlin idioms: sealed classes, data classes, extension functions, scope functions (let, run, apply, also, with)
- kotlinx.serialization for JSON/Protobuf

**Conventions:**
- Follow Kotlin official coding conventions
- Prefer immutable data (val over var, immutable collections)
- Use coroutines over callbacks or blocking calls
- Prefer sealed hierarchies for state modeling
- Write concise Ktor routing with type-safe route definitions`;

const JAVA_EXPERTISE = `### Java & Spring
- Spring Boot application architecture and auto-configuration
- Spring MVC / WebFlux controllers and REST APIs
- Spring Data JPA, repositories, query methods
- Bean lifecycle, dependency injection (@Autowired, @Component, @Service)
- Maven / Gradle build configuration`;

const TYPESCRIPT_EXPERTISE = `### TypeScript & Node.js
- TypeScript type system: generics, union/intersection types, mapped types, conditional types
- Node.js runtime, async/await, streams, event loop
- Common frameworks: Express, Fastify, NestJS, Next.js
- Package management: npm, yarn, pnpm
- ESM vs CommonJS module systems`;

const PYTHON_EXPERTISE = `### Python
- Python idioms: list comprehensions, generators, decorators, context managers
- Type hints and mypy
- Common frameworks: FastAPI, Django, Flask
- Package management: pip, poetry, uv
- Virtual environments and dependency management`;

const GO_EXPERTISE = `### Go
- Go idioms: interfaces, goroutines, channels, error handling patterns
- Standard library: net/http, encoding/json, context, sync
- Common frameworks: Gin, Echo, Chi
- Go modules and dependency management
- Concurrency patterns and best practices`;

const RUST_EXPERTISE = `### Rust
- Ownership, borrowing, lifetimes
- Traits, generics, and error handling (Result, Option)
- Common crates: tokio, serde, actix-web, axum
- Cargo build system and dependency management
- Async runtime and concurrency patterns`;

const GRADLE_EXPERTISE = `### Gradle
- Gradle Kotlin DSL (build.gradle.kts) build configuration
- Multi-project builds, dependency management
- Custom tasks and plugins
- Build caching and optimization`;

const K8S_EXPERTISE = `### Kubernetes & DevOps
- Pod, Deployment, Service, Ingress, ConfigMap, Secret manifests
- Helm charts and Kustomize overlays
- HPA, VPA autoscaling
- Liveness/readiness/startup probes
- kubectl operations and debugging`;

const DOCKER_EXPERTISE = `### Docker
- Dockerfile best practices, multi-stage builds
- Docker Compose for local development
- Image optimization and layer caching`;

const MSA_EXPERTISE = `### MSA Architecture
- Service decomposition and bounded contexts
- API Gateway patterns (Kong, Envoy)
- Event-driven architecture (Kafka, RabbitMQ)
- Circuit breaker, retry, bulkhead patterns
- Distributed tracing (OpenTelemetry, Jaeger)`;

const MONITORING_EXPERTISE = `### Monitoring & Observability
- Prometheus metrics exposition
- Grafana dashboard design
- Structured logging (JSON format)
- Log aggregation (ELK, Loki)`;

const COMMON_FOOTER = `### Language
- Respond in Korean when the user writes in Korean
- Respond in English when the user writes in English
- Use English for code comments and commit messages`;

export function getSystemPrompt(basePrompt: string, cwd?: string): string {
	const signals = cwd ? detectProject(cwd) : null;

	// Universal section: superpowers skills
	const sections: string[] = [SKILLS_SECTION];

	// Build identity + expertise based on detected project
	if (!signals || noSignals(signals)) {
		// No project detected or no cwd — generic coding agent
		sections.push(`## pi-sam: Coding Agent

You are pi-sam, a versatile coding agent. Adapt your expertise to the project at hand.
Examine the project structure, languages, and frameworks before giving advice.`);
	} else {
		const stacks = describeStacks(signals);
		sections.push(`## pi-sam: ${stacks} Specialist

You are pi-sam, a coding agent specialized for this project's stack.`);

		// Language expertise (only include what's detected)
		const expertise: string[] = [];
		if (signals.kotlin) expertise.push(KOTLIN_EXPERTISE);
		if (signals.java && !signals.kotlin) expertise.push(JAVA_EXPERTISE);
		if (signals.typescript) expertise.push(TYPESCRIPT_EXPERTISE);
		if (signals.javascript && !signals.typescript) expertise.push(TYPESCRIPT_EXPERTISE.replace("TypeScript & Node.js", "JavaScript & Node.js"));
		if (signals.python) expertise.push(PYTHON_EXPERTISE);
		if (signals.go) expertise.push(GO_EXPERTISE);
		if (signals.rust) expertise.push(RUST_EXPERTISE);

		// Build/infra expertise
		if (signals.gradle && !signals.kotlin) expertise.push(GRADLE_EXPERTISE);
		if (signals.k8s) expertise.push(K8S_EXPERTISE);
		if (signals.docker && !signals.k8s) expertise.push(DOCKER_EXPERTISE);

		// Architecture expertise (only for backend-heavy projects)
		if (signals.kotlin || signals.java || signals.go) {
			expertise.push(MSA_EXPERTISE);
			expertise.push(MONITORING_EXPERTISE);
		}

		if (expertise.length > 0) {
			sections.push("### Expertise\n");
			sections.push(expertise.join("\n\n"));
		}
	}

	sections.push(COMMON_FOOTER);

	return `${basePrompt}\n\n${sections.join("\n\n")}`;
}

function noSignals(s: ProjectSignals): boolean {
	return !s.kotlin && !s.java && !s.typescript && !s.javascript && !s.python && !s.go && !s.rust;
}

function describeStacks(s: ProjectSignals): string {
	const parts: string[] = [];
	if (s.kotlin) parts.push("Kotlin/Ktor");
	if (s.java && !s.kotlin) parts.push("Java/Spring");
	if (s.typescript) parts.push("TypeScript");
	if (s.javascript && !s.typescript) parts.push("JavaScript");
	if (s.python) parts.push("Python");
	if (s.go) parts.push("Go");
	if (s.rust) parts.push("Rust");
	if (s.k8s) parts.push("Kubernetes");
	return parts.join(" + ") || "Coding";
}
