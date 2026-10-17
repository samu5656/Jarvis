import { z } from 'zod';
import { JarvisTool, ToolContext, ToolResult } from '../types';

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  location?: string;
  description?: string;
  attendees?: string[];
}

export const ReadCalendarInputSchema = z.object({
  startDate: z.string().optional().describe('ISO date string for start range filter'),
  endDate: z.string().optional().describe('ISO date string for end range filter'),
  query: z.string().optional().describe('Optional title/description search keyword'),
});

export type ReadCalendarInput = z.infer<typeof ReadCalendarInputSchema>;

export class ReadCalendarTool implements JarvisTool<ReadCalendarInput, CalendarEvent[]> {
  readonly name = 'read_calendar';
  readonly description = 'Read and query calendar events within an optional time range or search query.';
  readonly risk = 'LOW' as const;
  readonly inputSchema = ReadCalendarInputSchema;

  private mockEvents: CalendarEvent[] = [
    {
      id: 'event_1',
      title: 'Weekly Team Sync',
      startTime: new Date(Date.now() + 3600000).toISOString(),
      endTime: new Date(Date.now() + 7200000).toISOString(),
      location: 'Google Meet',
      attendees: ['alice@example.com', 'bob@example.com'],
    },
    {
      id: 'event_2',
      title: 'Project Architecture Review',
      startTime: new Date(Date.now() + 86400000).toISOString(),
      endTime: new Date(Date.now() + 90000000).toISOString(),
      location: 'Conference Room B',
      attendees: ['lead@example.com'],
    },
  ];

  constructor(customEvents?: CalendarEvent[]) {
    if (customEvents) {
      this.mockEvents = customEvents;
    }
  }

  async execute(input: ReadCalendarInput, _context?: ToolContext): Promise<ToolResult<CalendarEvent[]>> {
    let filtered = [...this.mockEvents];

    if (input.startDate) {
      const startMs = new Date(input.startDate).getTime();
      filtered = filtered.filter((ev) => new Date(ev.endTime).getTime() >= startMs);
    }

    if (input.endDate) {
      const endMs = new Date(input.endDate).getTime();
      filtered = filtered.filter((ev) => new Date(ev.startTime).getTime() <= endMs);
    }

    if (input.query) {
      const q = input.query.toLowerCase();
      filtered = filtered.filter(
        (ev) =>
          ev.title.toLowerCase().includes(q) ||
          (ev.description && ev.description.toLowerCase().includes(q))
      );
    }

    return {
      success: true,
      data: filtered,
    };
  }
}
