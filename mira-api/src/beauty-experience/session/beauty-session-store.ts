import {
  BeautyAnalysisSources,
  withAnalysisSources,
} from './analysis-sources';
import {
  BeautyAttempt,
  BeautyCollection,
  BeautyFavorite,
  BeautyLook,
  BeautySession,
  BeautySessionState,
  BeautyShareRecord,
  createBeautySession,
} from './beauty-session';
import { BeautyCapabilityId } from '../capability/capability-ids';
import { BeautyRuntimeState } from '../runtime/beauty-runtime-state';
import { newTraceId } from '../../ports/shared/result-meta';

/**
 * In-memory Mira-owned session store (foundation).
 * Providers own nothing.
 */
export class BeautySessionStore {
  private readonly sessions = new Map<string, BeautySession>();
  private readonly attempts = new Map<string, BeautyAttempt>();
  private readonly looks = new Map<string, BeautyLook>();
  private readonly favorites = new Map<string, BeautyFavorite>();
  private readonly collections = new Map<string, BeautyCollection>();
  private readonly shares = new Map<string, BeautyShareRecord>();

  create(userId?: string): BeautySession {
    const session = createBeautySession(userId);
    this.sessions.set(session.sessionId, session);
    return this.cloneSession(session);
  }

  get(sessionId: string): BeautySession | undefined {
    const s = this.sessions.get(sessionId);
    return s ? this.cloneSession(s) : undefined;
  }

  setState(sessionId: string, state: BeautySessionState): BeautySession {
    const s = this.require(sessionId);
    s.state = state;
    s.updatedAt = new Date().toISOString();
    return this.cloneSession(s);
  }

  attachAnalysisSources(
    sessionId: string,
    sources: BeautyAnalysisSources,
  ): BeautySession {
    const s = this.require(sessionId);
    s.analysisSources = withAnalysisSources(s.analysisSources, sources);
    s.state = s.state === 'created' ? 'enriched' : s.state;
    s.updatedAt = new Date().toISOString();
    return this.cloneSession(s);
  }

  addLook(
    sessionId: string,
    labelEn?: string,
    labelAr?: string,
  ): BeautyLook {
    const s = this.require(sessionId);
    const look: BeautyLook = {
      lookId: newTraceId('look'),
      sessionId,
      labelEn,
      labelAr,
      attemptIds: [],
      createdAt: new Date().toISOString(),
    };
    this.looks.set(look.lookId, look);
    s.lookIds.push(look.lookId);
    s.updatedAt = new Date().toISOString();
    return { ...look, attemptIds: [...look.attemptIds] };
  }

  addAttempt(input: {
    sessionId: string;
    lookId: string;
    capabilityId: BeautyCapabilityId;
    runtime: BeautyRuntimeState;
    providerId?: string;
    metrics?: BeautyAttempt['metrics'];
    resultRef?: string;
  }): BeautyAttempt {
    const s = this.require(input.sessionId);
    const look = this.looks.get(input.lookId);
    if (!look || look.sessionId !== input.sessionId) {
      throw new Error('Look not found in session');
    }
    const attempt: BeautyAttempt = {
      attemptId: newTraceId('battempt'),
      sessionId: input.sessionId,
      lookId: input.lookId,
      capabilityId: input.capabilityId,
      createdAt: new Date().toISOString(),
      runtime: input.runtime,
      providerId: input.providerId,
      metrics: input.metrics,
      resultRef: input.resultRef,
    };
    this.attempts.set(attempt.attemptId, attempt);
    look.attemptIds.push(attempt.attemptId);
    s.attemptIds.push(attempt.attemptId);
    s.state = 'trying';
    s.runtime = input.runtime;
    s.updatedAt = new Date().toISOString();
    return { ...attempt };
  }

  addFavorite(sessionId: string, lookId: string): BeautyFavorite {
    const s = this.require(sessionId);
    if (!s.lookIds.includes(lookId)) throw new Error('Look not in session');
    const fav: BeautyFavorite = {
      favoriteId: newTraceId('bfav'),
      lookId,
      sessionId,
      createdAt: new Date().toISOString(),
    };
    this.favorites.set(fav.favoriteId, fav);
    s.favoriteIds.push(fav.favoriteId);
    s.state = 'saved';
    s.updatedAt = new Date().toISOString();
    return { ...fav };
  }

  addCollection(
    sessionId: string,
    titleEn: string,
    titleAr: string,
    lookIds: string[],
  ): BeautyCollection {
    const s = this.require(sessionId);
    for (const id of lookIds) {
      if (!s.lookIds.includes(id)) throw new Error(`Look ${id} not in session`);
    }
    const col: BeautyCollection = {
      collectionId: newTraceId('bcol'),
      titleEn,
      titleAr,
      lookIds: [...lookIds],
      createdAt: new Date().toISOString(),
    };
    this.collections.set(col.collectionId, col);
    s.collectionIds.push(col.collectionId);
    s.updatedAt = new Date().toISOString();
    return { ...col, lookIds: [...col.lookIds] };
  }

  addShare(sessionId: string, lookId?: string): BeautyShareRecord {
    const s = this.require(sessionId);
    if (lookId && !s.lookIds.includes(lookId)) {
      throw new Error('Look not in session');
    }
    const share: BeautyShareRecord = {
      shareId: newTraceId('bshare'),
      sessionId,
      lookId,
      createdAt: new Date().toISOString(),
      revoked: false,
    };
    this.shares.set(share.shareId, share);
    s.shareIds.push(share.shareId);
    s.state = 'shared';
    s.updatedAt = new Date().toISOString();
    return { ...share };
  }

  getAttempt(attemptId: string): BeautyAttempt | undefined {
    const a = this.attempts.get(attemptId);
    return a ? { ...a } : undefined;
  }

  getLook(lookId: string): BeautyLook | undefined {
    const l = this.looks.get(lookId);
    return l ? { ...l, attemptIds: [...l.attemptIds] } : undefined;
  }

  listAttempts(sessionId: string): BeautyAttempt[] {
    const s = this.require(sessionId);
    return s.attemptIds
      .map((id) => this.attempts.get(id)!)
      .filter(Boolean)
      .map((a) => ({ ...a }));
  }

  listLooks(sessionId: string): BeautyLook[] {
    const s = this.require(sessionId);
    return s.lookIds
      .map((id) => this.looks.get(id)!)
      .filter(Boolean)
      .map((l) => ({ ...l, attemptIds: [...l.attemptIds] }));
  }

  private require(sessionId: string): BeautySession {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error(`Session not found: ${sessionId}`);
    return s;
  }

  private cloneSession(s: BeautySession): BeautySession {
    return {
      ...s,
      analysisSources: {
        ...s.analysisSources,
        extra: s.analysisSources.extra
          ? { ...s.analysisSources.extra }
          : undefined,
      },
      attemptIds: [...s.attemptIds],
      lookIds: [...s.lookIds],
      favoriteIds: [...s.favoriteIds],
      collectionIds: [...s.collectionIds],
      shareIds: [...s.shareIds],
      runtime: { ...s.runtime },
    };
  }
}
