import { ChatMessage } from '@jarvis/llm';
import { ConversationTurn } from './types';

export class ConversationManager {
  private sessions = new Map<string, ConversationTurn[]>();
  private readonly maxTurns: number;

  constructor(options: { maxTurns?: number } = {}) {
    this.maxTurns = options.maxTurns ?? 20;
  }

  getHistory(sessionId: string): ConversationTurn[] {
    return this.sessions.get(sessionId) ?? [];
  }

  addTurn(sessionId: string, turn: Omit<ConversationTurn, 'id' | 'timestamp'>): ConversationTurn {
    const history = this.sessions.get(sessionId) ?? [];
    const newTurn: ConversationTurn = {
      ...turn,
      id: `turn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };

    history.push(newTurn);
    if (history.length > this.maxTurns) {
      history.splice(0, history.length - this.maxTurns);
    }

    this.sessions.set(sessionId, history);
    return newTurn;
  }

  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  toLLMMessages(sessionId: string, systemPrompt: string): ChatMessage[] {
    const history = this.getHistory(sessionId);
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    for (const turn of history) {
      if (turn.role === 'user') {
        messages.push({ role: 'user', content: turn.content });
      } else if (turn.role === 'assistant') {
        messages.push({ role: 'assistant', content: turn.content });
      }
    }

    return messages;
  }
}
