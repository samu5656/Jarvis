import { z } from 'zod';
import { JarvisTool, ToolContext, ToolResult } from '../types';
import { spawn } from 'child_process';

export interface AppLaunchDefinition {
  id: string;
  command: string;
  args?: string[];
  description: string;
}

export const APPROVED_APPLICATION_MAP: Record<string, AppLaunchDefinition> = {
  vscode: { id: 'vscode', command: 'code', description: 'Visual Studio Code' },
  code: { id: 'code', command: 'code', description: 'Visual Studio Code' },
  notepad: { id: 'notepad', command: 'notepad.exe', description: 'Windows Notepad' },
  terminal: { id: 'terminal', command: 'wt.exe', description: 'Windows Terminal' },
  explorer: { id: 'explorer', command: 'explorer.exe', description: 'Windows File Explorer' },
  calculator: { id: 'calculator', command: 'calc.exe', description: 'Windows Calculator' },
  chrome: { id: 'chrome', command: 'cmd.exe', args: ['/c', 'start', 'chrome'], description: 'Google Chrome' },
  browser: { id: 'browser', command: 'cmd.exe', args: ['/c', 'start', 'msedge'], description: 'Default Web Browser' },
};

export const OpenApplicationInputSchema = z.object({
  appId: z.string().min(1, 'appId is required'),
});

export type OpenApplicationInput = z.infer<typeof OpenApplicationInputSchema>;

export class OpenApplicationTool implements JarvisTool<OpenApplicationInput, { appId: string; status: string; application: string }> {
  readonly name = 'open_application';
  readonly description = 'Launches or focuses an approved Windows application from the allowlist (e.g., vscode, notepad, chrome).';
  readonly risk = 'MEDIUM' as const;
  readonly inputSchema = OpenApplicationInputSchema;

  async execute(input: OpenApplicationInput, _ctx: ToolContext): Promise<ToolResult<{ appId: string; status: string; application: string }>> {
    const normalizedApp = input.appId.toLowerCase().trim();
    const appDef = APPROVED_APPLICATION_MAP[normalizedApp];

    if (!appDef) {
      const approvedNames = Object.keys(APPROVED_APPLICATION_MAP).join(', ');
      return {
        success: false,
        error: `Application "${input.appId}" is not in the approved application allowlist. Approved: [${approvedNames}].`,
      };
    }

    try {
      if (process.platform === 'win32') {
        const child = spawn(appDef.command, appDef.args || [], {
          detached: true,
          stdio: 'ignore',
        });
        child.on('error', () => {
          // Process launch handled gracefully
        });
        child.unref();
      }

      return {
        success: true,
        data: {
          appId: appDef.id,
          application: appDef.description,
          status: 'LAUNCHED',
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to launch application: ${err.message}`,
      };
    }
  }
}
