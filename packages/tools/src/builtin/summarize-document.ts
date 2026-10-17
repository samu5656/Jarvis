import { z } from 'zod';
import { JarvisTool, ToolContext, ToolResult } from '../types';
import { PathAllowlist } from '../security/allowlist';
import { ExtractDocumentTool } from './extract-document';

export interface DocumentSummary {
  filePath?: string;
  originalLength: number;
  summaryLength: number;
  bulletPoints: string[];
  summaryText: string;
}

export const SummarizeDocumentInputSchema = z.object({
  filePath: z.string().optional().describe('Path to the approved document to summarize'),
  rawText: z.string().optional().describe('Direct text content to summarize'),
  maxBullets: z.number().int().min(1).max(10).optional(),
}).refine(
  (data) => Boolean(data.filePath || data.rawText),
  { message: 'Either filePath (within approved directories) or rawText must be provided.' }
);

export type SummarizeDocumentInput = z.infer<typeof SummarizeDocumentInputSchema>;

export class SummarizeDocumentTool implements JarvisTool<SummarizeDocumentInput, DocumentSummary> {
  readonly name = 'summarize_document';
  readonly description = 'Summarize document contents or text extracts within approved directory scopes. Blocked for unauthorized paths.';
  readonly risk = 'LOW' as const;
  readonly inputSchema = SummarizeDocumentInputSchema;

  private extractor: ExtractDocumentTool;

  constructor(allowlist: PathAllowlist) {
    this.extractor = new ExtractDocumentTool(allowlist);
  }

  async execute(input: SummarizeDocumentInput, ctx: ToolContext): Promise<ToolResult<DocumentSummary>> {
    let textToSummarize = '';

    if (input.filePath) {
      const extractResult = await this.extractor.execute({ filePath: input.filePath }, ctx);
      if (!extractResult.success || !extractResult.data) {
        return {
          success: false,
          error: extractResult.error || 'Failed to extract document for summarization.',
        };
      }
      textToSummarize = extractResult.data.content;
    } else if (input.rawText) {
      textToSummarize = input.rawText;
    }

    if (!textToSummarize.trim()) {
      return {
        success: false,
        error: 'No text content available to summarize.',
      };
    }

    // Heuristic/algorithmic structured summarization (works offline without external LLM call dependency)
    const paragraphs = textToSummarize
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 20);

    const maxBullets = input.maxBullets || 5;
    const bullets: string[] = [];

    for (const para of paragraphs) {
      if (bullets.length >= maxBullets) break;
      // Get the key first sentence of each paragraph
      const firstSentence = para.split(/[.!?]\s+/)[0]?.trim();
      if (firstSentence && firstSentence.length > 15) {
        bullets.push(firstSentence.endsWith('.') ? firstSentence : `${firstSentence}.`);
      }
    }

    // If no multi-sentence paragraphs found, extract top non-empty lines
    if (bullets.length === 0) {
      const lines = textToSummarize.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 10);
      bullets.push(...lines.slice(0, maxBullets));
    }

    const summaryText = bullets.join(' ');

    return {
      success: true,
      data: {
        filePath: input.filePath,
        originalLength: textToSummarize.length,
        summaryLength: summaryText.length,
        bulletPoints: bullets,
        summaryText,
      },
    };
  }
}
