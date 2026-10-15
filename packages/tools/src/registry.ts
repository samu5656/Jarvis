import { JarvisTool, RiskLevel } from './types';

export interface ToolMetadata {
  name: string;
  description: string;
  risk: RiskLevel;
}

export class ToolRegistry {
  private tools = new Map<string, JarvisTool>();

  register(tool: JarvisTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered.`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): JarvisTool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): JarvisTool[] {
    return Array.from(this.tools.values());
  }

  getMetadataList(): ToolMetadata[] {
    return this.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      risk: tool.risk,
    }));
  }
}
