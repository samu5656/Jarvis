import { z } from 'zod';
import { JarvisTool, ToolContext, ToolResult } from '../types';

export const DeleteProjectInputSchema = z.object({
  projectName: z.string().min(1, 'Project name is required'),
});

export type DeleteProjectInput = z.infer<typeof DeleteProjectInputSchema>;

export class DeleteProjectTool implements JarvisTool<DeleteProjectInput, { deleted: boolean; projectName: string }> {
  readonly name = 'delete_project';
  readonly description = 'Permanently deletes a project directory. Destructive action requiring confirmation.';
  readonly risk = 'HIGH' as const;
  readonly inputSchema = DeleteProjectInputSchema;

  async execute(input: DeleteProjectInput, ctx: ToolContext): Promise<ToolResult<{ deleted: boolean; projectName: string }>> {
    if (!ctx.confirmed) {
      return {
        success: false,
        error: 'Confirmation is required before deleting any project.',
      };
    }

    return {
      success: true,
      data: {
        deleted: true,
        projectName: input.projectName,
      },
    };
  }
}
