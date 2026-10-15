import { ToolRegistry } from '../registry';
import { CreateTaskTool } from './create-task';
import { CreateReminderTool } from './create-reminder';
import { OpenApplicationTool } from './open-application';
import { DeleteProjectTool } from './delete-project';
import { OpenFolderTool } from './open-folder';
import { OpenFileTool } from './open-file';
import { OpenUrlTool } from './open-url';
import { PathAllowlist } from '../security/allowlist';

export * from './create-task';
export * from './create-reminder';
export * from './open-application';
export * from './delete-project';
export * from './open-folder';
export * from './open-file';
export * from './open-url';

export function createDefaultToolRegistry(allowlist?: PathAllowlist): ToolRegistry {
  const sharedAllowlist = allowlist || new PathAllowlist({
    flowforge: process.cwd(),
    jarvis: process.cwd(),
  });

  const registry = new ToolRegistry();
  registry.register(new CreateTaskTool());
  registry.register(new CreateReminderTool());
  registry.register(new OpenApplicationTool());
  registry.register(new OpenFolderTool(sharedAllowlist));
  registry.register(new OpenFileTool(sharedAllowlist));
  registry.register(new OpenUrlTool());
  registry.register(new DeleteProjectTool());
  return registry;
}
