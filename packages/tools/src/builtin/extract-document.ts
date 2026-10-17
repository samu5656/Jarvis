import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { JarvisTool, ToolContext, ToolResult } from '../types';
import { PathAllowlist } from '../security/allowlist';

export interface ExtractedDocument {
  filePath: string;
  fileName: string;
  extension: string;
  content: string;
  sizeBytes: number;
  totalLines: number;
}

export const ExtractDocumentInputSchema = z.object({
  filePath: z.string().min(1, 'File path cannot be empty'),
  maxBytes: z.number().int().min(100).max(1000000).optional(),
});

export type ExtractDocumentInput = z.infer<typeof ExtractDocumentInputSchema>;

export class ExtractDocumentTool implements JarvisTool<ExtractDocumentInput, ExtractedDocument> {
  readonly name = 'extract_document';
  readonly description = 'Extract text content from documents/code files inside approved directories. Access to unauthorized paths is rejected.';
  readonly risk = 'LOW' as const;
  readonly inputSchema = ExtractDocumentInputSchema;

  private allowlist: PathAllowlist;

  constructor(allowlist: PathAllowlist) {
    this.allowlist = allowlist;
  }

  async execute(input: ExtractDocumentInput, _ctx: ToolContext): Promise<ToolResult<ExtractedDocument>> {
    // 1. Verify path is within approved scope
    const verification = this.allowlist.resolveAndVerify(input.filePath);
    if (!verification.approved || !verification.resolvedPath) {
      return {
        success: false,
        error: verification.error || `Access denied: File "${input.filePath}" is outside approved directory scopes.`,
      };
    }

    const targetPath = verification.resolvedPath;

    // 2. Check if file exists and is not a directory
    try {
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        return {
          success: false,
          error: `Target path "${input.filePath}" is a directory, not a document.`,
        };
      }

      const maxBytes = input.maxBytes || 100000;
      let content = fs.readFileSync(targetPath, 'utf8');
      if (content.length > maxBytes) {
        content = content.slice(0, maxBytes) + '\n... [TRUNCATED DUE TO SIZE LIMIT]';
      }

      const totalLines = content.split(/\r?\n/).length;

      return {
        success: true,
        data: {
          filePath: targetPath,
          fileName: path.basename(targetPath),
          extension: path.extname(targetPath).toLowerCase(),
          content,
          sizeBytes: stat.size,
          totalLines,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to extract document: ${err.message}`,
      };
    }
  }
}
