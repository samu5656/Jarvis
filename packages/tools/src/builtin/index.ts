import { ToolRegistry } from '../registry';
import { CreateTaskTool } from './create-task';
import { CreateReminderTool } from './create-reminder';
import { OpenApplicationTool } from './open-application';
import { DeleteProjectTool } from './delete-project';
import { OpenFolderTool } from './open-folder';
import { OpenFileTool } from './open-file';
import { OpenUrlTool } from './open-url';
import { ReadCalendarTool } from './read-calendar';
import { DraftEmailTool, DraftStore } from './draft-email';
import { SendEmailTool } from './send-email';
import { SearchFilesTool } from './search-files';
import { ExtractDocumentTool } from './extract-document';
import { SummarizeDocumentTool } from './summarize-document';
import { WebSearchTool } from './web-search';
import { BrowserActionTool } from './browser-action';
import { PathAllowlist, UrlPolicy } from '../security/allowlist';

export * from './create-task';
export * from './create-reminder';
export * from './open-application';
export * from './delete-project';
export * from './open-folder';
export * from './open-file';
export * from './open-url';
export * from './read-calendar';
export * from './draft-email';
export * from './send-email';
export * from './search-files';
export * from './extract-document';
export * from './summarize-document';
export * from './web-search';
export * from './browser-action';

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
  registry.register(new ReadCalendarTool());
  registry.register(new DraftEmailTool());
  registry.register(new SendEmailTool());
  registry.register(new SearchFilesTool(sharedAllowlist));
  registry.register(new ExtractDocumentTool(sharedAllowlist));
  registry.register(new SummarizeDocumentTool(sharedAllowlist));
  registry.register(new WebSearchTool());
  registry.register(new BrowserActionTool());
  return registry;
}
