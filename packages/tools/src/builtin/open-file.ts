import { z } from 'zod';
import { JarvisTool, ToolContext, ToolResult } from '../types';
import { PathAllowlist } from '../security/allowlist';
import { spawn } from 'child_process';

export const OpenFileInputSchema = z.object({
  filePath: z.string().min(1, 'File path is required'),
});

export type OpenFileInput = z.infer<typeof OpenFileInputSchema>;

export class OpenFileTool implements JarvisTool<OpenFileInput, { opened: boolean; resolvedPath: string }> {
  readonly name = 'open_file';
  readonly description = 'Opens an approved file within an authorized directory scope.';
  readonly risk = 'MEDIUM' as const;
  readonly inputSchema = OpenFileInputSchema;
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

  async execute(input: OpenFileInput, _ctx: ToolContext): Promise<ToolResult<{ opened: boolean; resolvedPath: string }>> {
    const check = this.allowlist.resolveAndVerify(input.filePath);
    if (!check.approved || !check.resolvedPath) {
      return {
        success: false,
        error: check.error || `File "${input.filePath}" is outside approved directories.`,
      };
    }

    try {
      if (process.platform === 'win32') {
        const child = spawn('cmd.exe', ['/c', 'start', '""', check.resolvedPath], {
          detached: true,
          stdio: 'ignore',
        });
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
        error: `Failed to open file: ${err.message}`,
      };
    }
  }
}
