import { CreateMemoryInput, Memory, MemoryQuery } from './types';

export interface MemoryStorage {
  save(memory: Memory): Promise<void>;
  findById(id: string): Promise<Memory | null>;
  query(params: MemoryQuery): Promise<Memory[]>;
  delete(id: string): Promise<boolean>;
  clear(userId: string): Promise<void>;
}

export class InMemoryMemoryStorage implements MemoryStorage {
  private items = new Map<string, Memory>();

  async save(memory: Memory): Promise<void> {
    this.items.set(memory.id, memory);
  }

  async findById(id: string): Promise<Memory | null> {
    return this.items.get(id) || null;
  }

  async query(params: MemoryQuery): Promise<Memory[]> {
    let results = Array.from(this.items.values()).filter((m) => m.userId === params.userId);

    if (params.type) {
      results = results.filter((m) => m.type === params.type);
    }

    if (params.importance) {
      results = results.filter((m) => m.importance === params.importance);
    }

    if (params.query && params.query.trim()) {
      const q = params.query.toLowerCase().trim();
      const keywords = q.split(/\s+/).filter((w) => w.length > 2);
      results = results.filter((m) => {
        const contentLower = m.content.toLowerCase();
        return keywords.some((k) => contentLower.includes(k)) || contentLower.includes(q);
      });
    }

    // Sort by importance (HIGH > MEDIUM > LOW) then by date desc
    const importanceRank: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    results.sort((a, b) => {
      const rankDiff = (importanceRank[b.importance] || 1) - (importanceRank[a.importance] || 1);
      if (rankDiff !== 0) return rankDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    if (params.limit && params.limit > 0) {
      results = results.slice(0, params.limit);
    }

    return results;
  }

  async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }

  async clear(userId: string): Promise<void> {
    for (const [id, m] of this.items.entries()) {
      if (m.userId === userId) {
        this.items.delete(id);
      }
    }
  }
}

export class MemoryService {
  private storage: MemoryStorage;

  constructor(storage?: MemoryStorage) {
    this.storage = storage || new InMemoryMemoryStorage();
  }

  async remember(userId: string, input: CreateMemoryInput): Promise<Memory> {
    const now = new Date().toISOString();
    const memory: Memory = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      type: input.type,
      content: input.content,
      source: input.source,
      importance: input.importance || 'LOW',
      createdAt: now,
      updatedAt: now,
    };
    await this.storage.save(memory);
    return memory;
  }

  async recall(userId: string, query?: string, options?: { type?: any; limit?: number }): Promise<Memory[]> {
    return await this.storage.query({
      userId,
      query,
      type: options?.type,
      limit: options?.limit ?? 5,
    });
  }

  async forget(id: string): Promise<boolean> {
    return await this.storage.delete(id);
  }

  getStorage(): MemoryStorage {
    return this.storage;
  }
}
