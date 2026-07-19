import { Injectable } from '@nestjs/common';
import { CanonicalWardrobe } from '../models/canonical-wardrobe';
import { CanonicalFashionSession } from '../models/canonical-fashion-session';
import {
  FashionSessionRepository,
  WardrobeRepository,
} from './wardrobe.repository';

function cloneWardrobe(w: CanonicalWardrobe): CanonicalWardrobe {
  return JSON.parse(JSON.stringify(w)) as CanonicalWardrobe;
}

function cloneSession(s: CanonicalFashionSession): CanonicalFashionSession {
  return JSON.parse(JSON.stringify(s)) as CanonicalFashionSession;
}

@Injectable()
export class InMemoryWardrobeRepository implements WardrobeRepository {
  private readonly byId = new Map<string, CanonicalWardrobe>();
  private readonly byUser = new Map<string, string>();

  async save(wardrobe: CanonicalWardrobe): Promise<CanonicalWardrobe> {
    const copy = cloneWardrobe(wardrobe);
    this.byId.set(copy.wardrobeId, copy);
    this.byUser.set(copy.userId, copy.wardrobeId);
    return cloneWardrobe(copy);
  }

  async findById(wardrobeId: string): Promise<CanonicalWardrobe | null> {
    const w = this.byId.get(wardrobeId);
    return w ? cloneWardrobe(w) : null;
  }

  async findByUserId(userId: string): Promise<CanonicalWardrobe | null> {
    const id = this.byUser.get(userId);
    if (!id) return null;
    return this.findById(id);
  }

  async delete(wardrobeId: string): Promise<boolean> {
    const w = this.byId.get(wardrobeId);
    if (!w) return false;
    this.byId.delete(wardrobeId);
    if (this.byUser.get(w.userId) === wardrobeId) {
      this.byUser.delete(w.userId);
    }
    return true;
  }

  async listUserIds(): Promise<string[]> {
    return [...this.byUser.keys()];
  }

  /** Test helper */
  clear(): void {
    this.byId.clear();
    this.byUser.clear();
  }
}

@Injectable()
export class InMemoryFashionSessionRepository
  implements FashionSessionRepository
{
  private readonly byId = new Map<string, CanonicalFashionSession>();
  private readonly byUser = new Map<string, string[]>();

  async save(session: CanonicalFashionSession): Promise<CanonicalFashionSession> {
    const copy = cloneSession(session);
    this.byId.set(copy.sessionId, copy);
    if (copy.userId) {
      const list = this.byUser.get(copy.userId) ?? [];
      if (!list.includes(copy.sessionId)) list.push(copy.sessionId);
      this.byUser.set(copy.userId, list);
    }
    return cloneSession(copy);
  }

  async findById(sessionId: string): Promise<CanonicalFashionSession | null> {
    const s = this.byId.get(sessionId);
    return s ? cloneSession(s) : null;
  }

  async findByUserId(userId: string): Promise<CanonicalFashionSession[]> {
    const ids = this.byUser.get(userId) ?? [];
    const out: CanonicalFashionSession[] = [];
    for (const id of ids) {
      const s = await this.findById(id);
      if (s) out.push(s);
    }
    return out;
  }

  async delete(sessionId: string): Promise<boolean> {
    const s = this.byId.get(sessionId);
    if (!s) return false;
    this.byId.delete(sessionId);
    if (s.userId) {
      const list = (this.byUser.get(s.userId) ?? []).filter((id) => id !== sessionId);
      this.byUser.set(s.userId, list);
    }
    return true;
  }

  clear(): void {
    this.byId.clear();
    this.byUser.clear();
  }
}
