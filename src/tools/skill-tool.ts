import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { discoverSkills, getSkill } from "../skills/index.js";

const SkillParams = Type.Object({
	action: Type.Union([Type.Literal("list"), Type.Literal("invoke")], {
		description: 'Action to perform: "list" to show all available skills, "invoke" to load a skill by name.',
	}),
	name: Type.Optional(
		Type.String({
			description: 'Skill name to invoke (required when action is "invoke"). Example: "brainstorming", "test-driven-development".',
		}),
	),
});

export function summarizeSkillToolResultForDisplay(details: unknown): string {
	if (!details || typeof details !== "object") return "";

	const action = Reflect.get(details, "action");
	if (action !== "invoke") return "";

	const skill = Reflect.get(details, "skill");
	if (typeof skill === "string" && skill.trim().length > 0) {
		return `Using skill: ${skill}`;
	}

	return "Using skill";
}

/**
 * Create a tool that lets the LLM discover and invoke superpowers skills.
 * Works with any model — skills are bundled and discovered at runtime.
 */
export function createSkillTool(cwd: string, agentDir: string): ToolDefinition<typeof SkillParams> {
	return {
		name: "skill",
		label: "Superpowers Skill",
		description:
			"Discover and invoke development methodology skills (superpowers). " +
			'Use action "list" to see all available skills with descriptions, or ' +
			'action "invoke" with a skill name to load its full content and follow it. ' +
			"Skills provide structured workflows for brainstorming, TDD, debugging, planning, code review, and more.",
		parameters: SkillParams,
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const { skills } = discoverSkills(cwd, agentDir);

			if (params.action === "list") {
				if (skills.length === 0) {
					return {
						content: [{ type: "text" as const, text: "No skills found." }],
						details: { action: "list", count: 0 },
					};
				}

				const lines = ["# Available Skills", ""];
				for (const s of skills) {
					lines.push(`- ${s.name} | source: ${s.source} | path: ${s.filePath ?? "(unknown)"}`);
				}

				return {
					content: [{ type: "text" as const, text: lines.join("\n") }],
					details: { action: "list", count: skills.length },
				};
			}

			// action === "invoke"
			if (!params.name?.trim()) {
				return {
					content: [{ type: "text" as const, text: 'Error: "name" parameter is required when action is "invoke".' }],
					details: { action: "invoke", error: "missing_name" },
				};
			}

			const skillName = params.name.trim();
			const skill = getSkill(skills, skillName);

			if (!skill) {
				const available = skills.map((s) => s.name).join(", ");
				return {
					content: [
						{
							type: "text" as const,
							text: `Skill "${skillName}" not found. Available skills: ${available}`,
						},
					],
					details: { action: "invoke", error: "not_found", requested: skillName },
				};
			}

			const lines = [
				`# Skill: ${skill.name}`,
				"",
				`- source: ${skill.source}`,
				`- path: ${skill.filePath ?? "(unknown)"}`,
			];

			return {
				content: [
					{
						type: "text" as const,
						text: lines.join("\n"),
					},
				],
				details: { action: "invoke", skill: skill.name, source: skill.source, path: skill.filePath },
			};
		},
		renderResult(result) {
			const summary = summarizeSkillToolResultForDisplay(result.details);
			return new Text(summary, 0, 0);
		},
	};
}
