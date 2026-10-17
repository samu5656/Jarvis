import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { JarvisTool, ToolContext, ToolResult } from '../types';
import { PathAllowlist } from '../security/allowlist';

export interface FileSearchResultItem {
  name: string;
  relativePath: string;
  absolutePath: string;
  isDirectory: boolean;
  sizeBytes: number;
  modifiedAt: string;
}

export const SearchFilesInputSchema = z.object({
  query: z.string().min(1, 'Search query or file pattern cannot be empty'),
  directoryScope: z.string().optional().describe('Alias or path of the approved directory scope to search within'),
  maxResults: z.number().int().min(1).max(100).optional(),
});

export type SearchFilesInput = z.infer<typeof SearchFilesInputSchema>;

export class SearchFilesTool implements JarvisTool<SearchFilesInput, FileSearchResultItem[]> {
  readonly name = 'search_files';
  readonly description = 'Search for files by name/pattern within approved directory scopes only. Access to outside paths is strictly blocked.';
  readonly risk = 'LOW' as const;
  readonly inputSchema = SearchFilesInputSchema;

  private allowlist: PathAllowlist;

  constructor(allowlist: PathAllowlist) {
    this.allowlist = allowlist;
  }

  async execute(input: SearchFilesInput, _ctx: ToolContext): Promise<ToolResult<FileSearchResultItem[]>> {
    // Determine search root
    let targetRoot: string;
    if (input.directoryScope) {
      const verify = this.allowlist.resolveAndVerify(input.directoryScope);
      if (!verify.approved || !verify.resolvedPath) {
        return {
          success: false,
          error: verify.error || `Access denied: Target scope "${input.directoryScope}" is not in approved scopes.`,
        };
      }
      targetRoot = verify.resolvedPath;
    } else {
      const approvedList = this.allowlist.getApprovedList();
      if (approvedList.length === 0) {
        return {
          success: false,
          error: 'No approved directory scopes configured for file search.',
        };
      }
      targetRoot = approvedList[0].absolutePath;
    }

    const maxResults = input.maxResults || 20;
    const queryLower = input.query.toLowerCase();
    const results: FileSearchResultItem[] = [];

    const searchDirectory = (currentDir: string) => {
      if (results.length >= maxResults) return;

      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (results.length >= maxResults) break;

        // Skip hidden files and common massive dirs (node_modules, .git)
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
          continue;
        }

        const fullPath = path.join(currentDir, entry.name);
        
        // Scope verification check for defense in depth
        const verifyCheck = this.allowlist.resolveAndVerify(fullPath);
        if (!verifyCheck.approved) {
          continue;
        }

        if (entry.name.toLowerCase().includes(queryLower)) {
          let size = 0;
          let mtime = new Date().toISOString();
          try {
            const stat = fs.statSync(fullPath);
            size = stat.size;
            mtime = stat.mtime.toISOString();
          } catch {}

          results.push({
            name: entry.name,
            relativePath: path.relative(targetRoot, fullPath),
            absolutePath: fullPath,
            isDirectory: entry.isDirectory(),
            sizeBytes: size,
            modifiedAt: mtime,
          });
        }

        if (entry.isDirectory()) {
          searchDirectory(fullPath);
        }
      }
    };

    searchDirectory(targetRoot);

    return {
      success: true,
      data: results,
    };
  }
}
