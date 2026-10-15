import { z } from 'zod';
import { JarvisTool, ToolContext, ToolResult } from '../types';
import { PathAllowlist } from '../security/allowlist';
import { spawn } from 'child_process';

export const OpenFolderInputSchema = z.object({
  path: z.string().min(1, 'Folder path or alias is required'),
});

export type OpenFolderInput = z.infer<typeof OpenFolderInputSchema>;

export class OpenFolderTool implements JarvisTool<OpenFolderInput, { opened: boolean; resolvedPath: string }> {
  readonly name = 'open_folder';
  readonly description = 'Opens an approved project directory or folder in Windows Explorer.';
  readonly risk = 'MEDIUM' as const;
  readonly inputSchema = OpenFolderInputSchema;
  private allowlist: PathAllowlist;

  constructor(allowlist?: PathAllowlist) {
    this.allowlist = allowlist || new PathAllowlist({
      flowforge: process.cwd(),
      jarvis: process.cwd(),
    });
  }

  setAllowlist(allowlist: PathAllowlist): void {
    this.allowlist = allowlist;
  }

  async execute(input: OpenFolderInput, _ctx: ToolContext): Promise<ToolResult<{ opened: boolean; resolvedPath: string }>> {
    const check = this.allowlist.resolveAndVerify(input.path);
    if (!check.approved || !check.resolvedPath) {
      return {
        success: false,
        error: check.error || `Path "${input.path}" is not in the approved folder allowlist.`,
      };
    }

    try {
      if (process.platform === 'win32') {
        const child = spawn('explorer.exe', [check.resolvedPath], { detached: true, stdio: 'ignore' });
        child.unref();
      }
      return {
        success: true,
        data: {
          opened: true,
          resolvedPath: check.resolvedPath,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to open folder: ${err.message}`,
      };
    }
  }
}
