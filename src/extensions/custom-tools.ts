import type { ExtensionFactory } from "@mariozechner/pi-coding-agent";
import { createK8sTool } from "../tools/k8s-tool.js";
import { createGradleTool } from "../tools/gradle-tool.js";
import { createDockerTool } from "../tools/docker-tool.js";
import { createSkillTool } from "../tools/skill-tool.js";

/**
 * Extension that registers custom tools via pi.registerTool().
 *
 * 커스텀 도구를 customTools 대신 extension으로 등록해야
 * InteractiveMode가 toolDefinition을 찾을 수 있고,
 * renderCall/renderResult 커스텀 렌더러가 동작합니다.
 *
 * (getRegisteredToolDefinition()이 extensionRunner.getAllRegisteredTools()만 조회하므로)
 */
export function customToolsExtension(cwd: string, agentDir: string): ExtensionFactory {
	return (pi) => {
		pi.registerTool(createK8sTool(cwd));
		pi.registerTool(createGradleTool(cwd));
		pi.registerTool(createDockerTool(cwd));
		pi.registerTool(createSkillTool(cwd, agentDir));
	};
}
