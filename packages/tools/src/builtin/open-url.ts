import { z } from 'zod';
import { JarvisTool, ToolContext, ToolResult } from '../types';
import { UrlPolicy } from '../security/allowlist';
import { spawn } from 'child_process';

export const OpenUrlInputSchema = z.object({
  url: z.string().min(1, 'URL is required'),
});

export type OpenUrlInput = z.infer<typeof OpenUrlInputSchema>;

export class OpenUrlTool implements JarvisTool<OpenUrlInput, { opened: boolean; url: string }> {
  readonly name = 'open_url';
  readonly description = 'Opens an approved HTTP or HTTPS web URL in the default browser.';
  readonly risk = 'LOW' as const;
  readonly inputSchema = OpenUrlInputSchema;
  private urlPolicy = new UrlPolicy();

  async execute(input: OpenUrlInput, _ctx: ToolContext): Promise<ToolResult<{ opened: boolean; url: string }>> {
    const check = this.urlPolicy.verify(input.url);
    if (!check.approved || !check.url) {
      return {
        success: false,
        error: check.error || `Invalid or unapproved URL policy for "${input.url}".`,
      };
    }

    try {
      if (process.platform === 'win32') {
        const child = spawn('cmd.exe', ['/c', 'start', '""', check.url], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
      }
      return {
        success: true,
        data: {
          opened: true,
          url: check.url,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to open URL: ${err.message}`,
      };
    }
  }
}
