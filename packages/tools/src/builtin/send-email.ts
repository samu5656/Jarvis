import { z } from 'zod';
import { JarvisTool, ToolContext, ToolResult } from '../types';
import { DraftStore, EmailDraft } from './draft-email';

export interface SentEmailResult {
  messageId: string;
  draftId?: string;
  to: string[];
  subject: string;
  sentAt: string;
  status: 'SENT';
}

export const SendEmailInputSchema = z.object({
  draftId: z.string().optional().describe('ID of the previously prepared draft to send'),
  to: z.array(z.string().email()).optional().describe('Recipient email addresses if sending directly'),
  subject: z.string().optional().describe('Subject line if sending directly'),
  body: z.string().optional().describe('Body content if sending directly'),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
}).refine(
  (data) => Boolean(data.draftId || (data.to && data.to.length > 0 && data.subject && data.body)),
  {
    message: 'Either draftId or complete email details (to, subject, body) must be provided.',
  }
);

export type SendEmailInput = z.infer<typeof SendEmailInputSchema>;

export class SendEmailTool implements JarvisTool<SendEmailInput, SentEmailResult> {
  readonly name = 'send_email';
  readonly description = 'Send an external email message. HIGH RISK: strictly requires explicit user confirmation before sending.';
  readonly risk = 'HIGH' as const;
  readonly inputSchema = SendEmailInputSchema;

  async execute(input: SendEmailInput, context?: ToolContext): Promise<ToolResult<SentEmailResult>> {
    // Defense-in-depth: Even inside the tool execution, double check confirmed flag
    if (!context?.confirmed) {
      return {
        success: false,
        error: 'Execution blocked: Sending an external email strictly requires explicit user confirmation.',
      };
    }

    let to: string[] = [];
    let subject = '';
    let body = '';

    if (input.draftId) {
      const draft = DraftStore.getDraft(input.draftId);
      if (!draft) {
        return {
          success: false,
          error: `Draft with ID "${input.draftId}" not found.`,
        };
      }
      to = draft.to;
      subject = draft.subject;
      body = draft.body;
    } else {
      to = input.to!;
      subject = input.subject!;
      body = input.body!;
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const sentResult: SentEmailResult = {
      messageId,
      draftId: input.draftId,
      to,
      subject,
      sentAt: new Date().toISOString(),
      status: 'SENT',
    };

    return {
      success: true,
      data: sentResult,
    };
  }
}
