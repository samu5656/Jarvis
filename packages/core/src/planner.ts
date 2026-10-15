import { OrchestratorPlan, ToolCallRequest, ToolManifest } from './types';

export class StructuredPlanner {
  static parsePlan(rawText: string, availableTools: ToolManifest[]): OrchestratorPlan {
    const cleaned = rawText.trim();
    let jsonString = cleaned;

    // Extract JSON block if surrounded by markdown code fences
    const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonString = jsonMatch[1].trim();
    } else {
      // Find outermost curly brackets
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonString = cleaned.substring(firstBrace, lastBrace + 1);
      }
    }

    try {
      const parsed = JSON.parse(jsonString);

      const thought = typeof parsed.thought === 'string' ? parsed.thought : 'Processed user intent.';
      const response = typeof parsed.response === 'string' ? parsed.response : cleaned;

      let toolCall: ToolCallRequest | undefined = undefined;

      if (parsed.toolCall && typeof parsed.toolCall === 'object' && parsed.toolCall.toolName) {
        const toolName = String(parsed.toolCall.toolName);
        const args = (typeof parsed.toolCall.arguments === 'object' && parsed.toolCall.arguments !== null)
          ? parsed.toolCall.arguments
          : {};

        const manifest = availableTools.find((t) => t.name.toLowerCase() === toolName.toLowerCase());
        if (manifest) {
          toolCall = {
            toolName: manifest.name,
            arguments: args,
            risk: manifest.risk,
          };
        } else {
          // Tool not recognized in registry
          return {
            thought: `Tool "${toolName}" was proposed but is not registered in available tools.`,
            response: `I wanted to use ${toolName}, but that tool is not available in my system.`,
          };
        }
      }

      return {
        thought,
        toolCall,
        response,
      };
    } catch {
      // Fallback for conversational plain text responses
      return {
        thought: 'Direct conversational response without tool execution.',
        response: cleaned,
      };
    }
  }
}
