import { z } from 'zod';
import { JarvisTool, ToolContext, ToolResult } from '../types';

export interface EmailDraft {
  draftId: string;
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  createdAt: string;
  status: 'DRAFT';
}

export const DraftEmailInputSchema = z.object({
  to: z.array(z.string().email()).min(1, 'At least one recipient is required'),
  subject: z.string().min(1, 'Subject cannot be empty'),
  body: z.string().min(1, 'Email body cannot be empty'),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
});

export type DraftEmailInput = z.infer<typeof DraftEmailInputSchema>;

// In-memory store for drafts accessible by send_email
export class DraftStore {
  private static drafts: Map<string, EmailDraft> = new Map();

  static saveDraft(draft: EmailDraft): void {
    this.drafts.set(draft.draftId, draft);
  }

  static getDraft(draftId: string): EmailDraft | undefined {
    return this.drafts.get(draftId);
  }

  static getAllDrafts(): EmailDraft[] {
    return Array.from(this.drafts.values());
  }

  static clear(): void {
    this.drafts.clear();
  }
}

export class DraftEmailTool implements JarvisTool<DraftEmailInput, EmailDraft> {
  readonly name = 'draft_email';
  readonly description = 'Draft an email message safely without sending it. Returns a draft preview with draft ID.';
  readonly risk = 'LOW' as const;
  readonly inputSchema = DraftEmailInputSchema;

  async execute(input: DraftEmailInput, _context?: ToolContext): Promise<ToolResult<EmailDraft>> {
    const draftId = `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const draft: EmailDraft = {
      draftId,
      to: input.to,
      subject: input.subject,
      body: input.body,
      cc: input.cc,
      bcc: input.bcc,
      createdAt: new Date().toISOString(),
      status: 'DRAFT',
    };

    DraftStore.saveDraft(draft);

    return {
      success: true,
      data: draft,
    };
  }
}
