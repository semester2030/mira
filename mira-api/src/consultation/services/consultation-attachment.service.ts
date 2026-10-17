import { ConflictException, Inject, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  ChatImageRef,
  ConsultationImageError,
  DEFAULT_DIALOGUE_LIMITS,
  DialogueLimits,
  DialogueResolution,
  attachmentExpired,
  cannotSeeImageReply,
  clarifyImageReply,
  dataUrlForJpeg,
  imageDirected,
  modelSupportsVisionReply,
  orphanStorageKeys,
  UPLOAD_GRACE_MS,
  prepareConsultationImage,
  readDialogueLimits,
  safeStorageKey,
  selectImagesForTurn,
  attachmentTokenSecret,
  purgeExpiredAttachments,
  signReadToken,
} from './consultation-dialogue';

export interface AttachmentRow {
  id: string;
  userId: string;
  sessionId: string;
  messageId: string | null;
  createdAt: Date;
  mimeType: string;
  byteSize: number;
  sha256: string;
  width: number | null;
  height: number | null;
  storageKey: string;
  status: 'ready' | 'failed' | 'delete_pending';
  deletedAt: Date | null;
  bytes: Buffer | null;
}

export interface AttachmentRepository {
  insert(row: AttachmentRow): Promise<void>;
  find(id: string): Promise<AttachmentRow | null>;
  listSession(userId: string, sessionId: string): Promise<AttachmentRow[]>;
  countSince(userId: string, since: Date): Promise<number>;
  bind(ids: string[], messageId: string, owner: { userId: string; sessionId: string }): Promise<void>;
  markDeleted(ids: string[], at: Date): Promise<void>;
  deleteStored(id: string, at: Date): Promise<'deleted' | 'failed'>;
  listOlderThan(cutoff: Date): Promise<AttachmentRow[]>;
  listRetryDeletes(): Promise<AttachmentRow[]>;
  storageKeys(): Promise<string[]>;
  inflightKeys(): string[];
  listDiskEntries(): Promise<Array<{ key: string; mtimeMs: number }>>;
  meta(id: string): Promise<Pick<AttachmentRow, 'id' | 'userId' | 'messageId' | 'status' | 'deletedAt'> | null>;
}

export class MemoryAttachmentRepository implements AttachmentRepository {
  readonly rows: AttachmentRow[] = [];

  async insert(row: AttachmentRow): Promise<void> {
    this.rows.push({ ...row, bytes: row.bytes ? Buffer.from(row.bytes) : null });
  }

  async find(id: string): Promise<AttachmentRow | null> {
    const row = this.rows.find((item) => item.id === id && !item.deletedAt) ?? null;
    if (!row || row.status === 'delete_pending') return null;
    return row;
  }

  async meta(id: string) {
    const row = this.rows.find((item) => item.id === id) ?? null;
    if (!row) return null;
    return { id: row.id, userId: row.userId, messageId: row.messageId, status: row.status, deletedAt: row.deletedAt };
  }

  async listSession(userId: string, sessionId: string): Promise<AttachmentRow[]> {
    return this.rows.filter((row) => row.userId === userId && row.sessionId === sessionId && !row.deletedAt && row.status !== 'delete_pending');
  }

  async countSince(userId: string, since: Date): Promise<number> {
    return this.rows.filter((row) => row.userId === userId && !row.deletedAt && row.createdAt >= since).length;
  }

  async bind(ids: string[], messageId: string, owner: { userId: string; sessionId: string }): Promise<void> {
    const owned = this.rows.filter((row) => ids.includes(row.id) && row.userId === owner.userId && row.sessionId === owner.sessionId && !row.deletedAt && (!row.messageId || row.messageId === messageId));
    if (owned.length !== ids.length) throw new NotFoundException('الصورة غير موجودة في هذه المحادثة.');
    for (const row of owned) row.messageId = messageId;
  }

  async markDeleted(ids: string[], at: Date): Promise<void> {
    for (const id of ids) await this.deleteStored(id, at);
  }

  protected async removeFile(_row: AttachmentRow): Promise<boolean> {
    return true;
  }

  async deleteStored(id: string, at: Date): Promise<'deleted' | 'failed'> {
    const row = this.rows.find((item) => item.id === id && !item.deletedAt);
    if (!row) return 'deleted';
    const removed = await this.removeFile(row);
    if (!removed) {
      row.status = 'delete_pending';
      return 'failed';
    }
    row.deletedAt = at;
    row.bytes = null;
    row.status = 'failed';
    return 'deleted';
  }

  async listRetryDeletes(): Promise<AttachmentRow[]> {
    return this.rows.filter((row) => !row.deletedAt && row.status === 'delete_pending');
  }

  inflightKeys(): string[] {
    return [];
  }

  async listDiskEntries(): Promise<Array<{ key: string; mtimeMs: number }>> {
    return [];
  }

  async listOlderThan(cutoff: Date): Promise<AttachmentRow[]> {
    return this.rows.filter((row) => !row.deletedAt && row.createdAt < cutoff);
  }

  async storageKeys(): Promise<string[]> {
    return this.rows.filter((row) => !row.deletedAt).map((row) => row.storageKey);
  }
}

export class PrivateFileAttachmentRepository implements AttachmentRepository {
  private readonly inflight = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly rootDir: string,
  ) {}

  inflightKeys(): string[] {
    return [...this.inflight];
  }

  pathFor(key: string): string {
    const full = resolve(this.rootDir, key);
    const root = resolve(this.rootDir);
    if (!full.startsWith(`${root}/`)) throw new ConsultationImageError('مسار المرفق غير مسموح.');
    return full;
  }

  async insert(row: AttachmentRow): Promise<void> {
    if (!row.bytes) throw new ConsultationImageError('تعذر حفظ الصورة.');
    const full = this.pathFor(row.storageKey);
    this.inflight.add(row.storageKey);
    try {
    await mkdir(dirname(full), { recursive: true, mode: 0o700 });
    await writeFile(full, row.bytes, { mode: 0o600 });
    try {
    await this.prisma.consultationAttachment.create({
      data: {
        id: row.id,
        userId: row.userId,
        sessionId: row.sessionId,
        messageId: row.messageId,
        mimeType: row.mimeType,
        byteSize: row.byteSize,
        sha256: row.sha256,
        width: row.width,
        height: row.height,
        storageKey: row.storageKey,
        status: row.status,
        createdAt: row.createdAt,
      },
    });
    } catch (error) {
      await rm(full, { force: true });
      throw error;
    }
    } finally {
      this.inflight.delete(row.storageKey);
    }
  }

  async find(id: string): Promise<AttachmentRow | null> {
    const row = await this.prisma.consultationAttachment.findFirst({ where: { id, deletedAt: null } });
    if (!row || row.status === 'delete_pending') return null;
    let bytes: Buffer | null = null;
    try {
      bytes = await readFile(this.pathFor(row.storageKey));
    } catch {
      bytes = null;
    }
    return this.toRow(row, bytes);
  }

  async listSession(userId: string, sessionId: string): Promise<AttachmentRow[]> {
    const rows = await this.prisma.consultationAttachment.findMany({
      where: { userId, sessionId, deletedAt: null, status: { not: 'delete_pending' } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toRow(row, null));
  }

  async countSince(userId: string, since: Date): Promise<number> {
    return this.prisma.consultationAttachment.count({
      where: { userId, deletedAt: null, createdAt: { gte: since } },
    });
  }

  async bind(ids: string[], messageId: string, owner: { userId: string; sessionId: string }): Promise<void> {
    const updated = await this.prisma.consultationAttachment.updateMany({
      where: {
        id: { in: ids },
        userId: owner.userId,
        sessionId: owner.sessionId,
        deletedAt: null,
        status: { not: 'delete_pending' },
        OR: [{ messageId: null }, { messageId }],
      },
      data: { messageId },
    });
    if (updated.count !== ids.length) throw new NotFoundException('الصورة غير موجودة في هذه المحادثة.');
  }

  async markDeleted(ids: string[], at: Date): Promise<void> {
    for (const id of ids) await this.deleteStored(id, at);
  }

  async meta(id: string) {
    const row = await this.prisma.consultationAttachment.findUnique({ where: { id } });
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      messageId: row.messageId,
      status: row.status as AttachmentRow['status'],
      deletedAt: row.deletedAt,
    };
  }

  async deleteStored(id: string, at: Date): Promise<'deleted' | 'failed'> {
    const row = await this.prisma.consultationAttachment.findFirst({ where: { id, deletedAt: null } });
    if (!row) return 'deleted';
    const full = this.pathFor(row.storageKey);
    let removed = false;
    try {
      await rm(full, { force: false });
      removed = true;
    } catch (error) {
      removed = (error as NodeJS.ErrnoException).code === 'ENOENT';
    }
    if (removed) {
      try {
        await readFile(full);
        removed = false;
      } catch {
        removed = true;
      }
    }
    if (!removed) {
      await this.prisma.consultationAttachment.update({
        where: { id },
        data: { status: 'delete_pending' },
      });
      return 'failed';
    }
    await this.prisma.consultationAttachment.update({
      where: { id },
      data: { deletedAt: at, status: 'failed' },
    });
    return 'deleted';
  }

  async listRetryDeletes(): Promise<AttachmentRow[]> {
    const rows = await this.prisma.consultationAttachment.findMany({
      where: { deletedAt: null, status: 'delete_pending' },
    });
    return rows.map((row) => this.toRow(row, null));
  }

  async storageKeys(): Promise<string[]> {
    const rows = await this.prisma.consultationAttachment.findMany({
      where: { deletedAt: null },
      select: { storageKey: true },
    });
    return rows.map((row) => row.storageKey);
  }

  async listDiskKeys(): Promise<string[]> {
    const found: string[] = [];
    const walk = async (dir: string, prefix: string) => {
      let entries: Array<{ name: string; isDirectory(): boolean }> = [];
      try {
        entries = await readdir(dir, { withFileTypes: true }) as typeof entries;
      } catch {
        return;
      }
      for (const entry of entries) {
        const name = String(entry.name);
        const rel = prefix ? `${prefix}/${name}` : name;
        if (entry.isDirectory()) await walk(join(dir, name), rel);
        else found.push(rel);
      }
    };
    await walk(this.rootDir, '');
    return found;
  }

  async listDiskEntries(): Promise<Array<{ key: string; mtimeMs: number }>> {
    const keys = await this.listDiskKeys();
    const entries: Array<{ key: string; mtimeMs: number }> = [];
    for (const key of keys) {
      try {
        const info = await stat(this.pathFor(key));
        entries.push({ key, mtimeMs: info.mtimeMs });
      } catch {
        entries.push({ key, mtimeMs: 0 });
      }
    }
    return entries;
  }

  async listOlderThan(cutoff: Date): Promise<AttachmentRow[]> {
    const rows = await this.prisma.consultationAttachment.findMany({
      where: { deletedAt: null, createdAt: { lt: cutoff } },
    });
    return rows.map((row) => this.toRow(row, null));
  }

  private toRow(row: {
    id: string;
    userId: string;
    sessionId: string;
    messageId: string | null;
    createdAt: Date;
    mimeType: string;
    byteSize: number;
    sha256: string;
    width: number | null;
    height: number | null;
    storageKey: string;
    status: string;
    deletedAt: Date | null;
  }, bytes: Buffer | null): AttachmentRow {
    return {
      id: row.id,
      userId: row.userId,
      sessionId: row.sessionId,
      messageId: row.messageId,
      createdAt: row.createdAt,
      mimeType: row.mimeType,
      byteSize: row.byteSize,
      sha256: row.sha256,
      width: row.width,
      height: row.height,
      storageKey: row.storageKey,
      status: row.status === 'ready' ? 'ready' : 'failed',
      deletedAt: row.deletedAt,
      bytes,
    };
  }
}

export async function removeUnsentAttachment(
  repo: AttachmentRepository,
  userId: string,
  attachmentId: string,
): Promise<void> {
  const row = await repo.meta(attachmentId);
  if (!row || row.userId !== userId || row.deletedAt) throw new NotFoundException('الصورة غير موجودة.');
  if (row.messageId) throw new ConsultationImageError('لا يمكن حذف صورة أُرسلت مع رسالة.');
  const result = await repo.deleteStored(row.id, new Date());
  if (result !== 'deleted') {
    throw new ConflictException({
      code: 'ATTACHMENT_DELETE_PENDING',
      message: 'تعذر حذف الملف الآن. مُنع الوصول وسيُعاد الحذف.',
    });
  }
}

function asRef(row: AttachmentRow, ordinal: number): ChatImageRef {
  return {
    id: row.id,
    userId: row.userId,
    sessionId: row.sessionId,
    messageId: row.messageId,
    createdAt: row.createdAt.toISOString(),
    bytesReady: row.status === 'ready' && row.bytes != null && row.bytes.length > 0,
    ordinal,
  };
}

export async function resolveDialogueTurn(input: {
  repo: AttachmentRepository;
  userId: string;
  sessionId: string;
  message: string;
  attachmentIds: string[];
  pinnedIds?: string[];
  history?: Array<{ role: string; content: string }>;
  model: string;
  limits?: DialogueLimits;
  now?: Date;
  loadBytes?: boolean;
}): Promise<DialogueResolution> {
  const limits = input.limits ?? DEFAULT_DIALOGUE_LIMITS;
  const now = input.now ?? new Date();
  const empty = { imageIds: [] as string[], dataUrls: [] as string[], imageLabels: [] as string[], pinIds: input.pinnedIds ?? [] };
  if (input.attachmentIds.length > limits.maxImagesPerMessage) {
    throw new ConsultationImageError(`الحد الأقصى ${limits.maxImagesPerMessage} صور في الرسالة.`);
  }
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const used = await input.repo.countSince(input.userId, since);
  if (input.attachmentIds.length && used > limits.maxImagesPerDay) {
    throw new ConsultationImageError('وصلتِ حد الصور اليومي. حاولي لاحقًا.');
  }
  const allRows = await input.repo.listSession(input.userId, input.sessionId);
  const sessionRows = allRows.filter((row) => !attachmentExpired(row.createdAt, limits.retentionDays, now));
  const byId = new Map(sessionRows.map((row, index) => [row.id, { row, index }]));
  for (const id of input.attachmentIds) {
    const found = await input.repo.find(id);
    if (!found || found.userId !== input.userId || found.sessionId !== input.sessionId) {
      throw new NotFoundException('الصورة غير موجودة في هذه المحادثة.');
    }
    if (found.deletedAt || attachmentExpired(found.createdAt, limits.retentionDays, now)) {
      throw new ConsultationImageError('انتهت مدة الاحتفاظ بهذه الصورة.');
    }
  }
  const current = input.attachmentIds.map((id) => {
    const hit = byId.get(id);
    if (!hit) throw new NotFoundException('الصورة غير موجودة في هذه المحادثة.');
    return asRef(hit.row, hit.index);
  });
  const priorRows = sessionRows.filter((row) => !input.attachmentIds.includes(row.id) && row.messageId);
  const prior = priorRows.map((row) => asRef(row, byId.get(row.id)?.index ?? 0));
  const selected = selectImagesForTurn({
    message: input.message,
    current,
    prior,
    pinnedIds: input.pinnedIds,
    history: input.history,
    limits,
  });
  if (selected.clarify) {
    return { ...empty, localReply: clarifyImageReply(), clarify: true, pinIds: selected.pinIds };
  }
  if (selected.missingPin || (imageDirected(input.message) && selected.images.length === 0 && allRows.length > sessionRows.length)) {
    return { ...empty, localReply: cannotSeeImageReply(), clarify: false, pinIds: [] };
  }
  const visionBlock = modelSupportsVisionReply(input.model, selected.images.length > 0);
  if (visionBlock) {
    return { ...empty, imageIds: selected.images.map((image) => image.id), localReply: visionBlock, clarify: false, pinIds: selected.pinIds };
  }
  const dataUrls: string[] = [];
  const imageLabels: string[] = [];
  for (const image of selected.images) {
    let row = byId.get(image.id)?.row ?? null;
    if (!row?.bytes?.length) row = await input.repo.find(image.id);
    if (!row?.bytes?.length || attachmentExpired(row.createdAt, limits.retentionDays, now)) {
      if (selected.images.length === 0) continue;
      return { ...empty, localReply: cannotSeeImageReply(), clarify: false, pinIds: selected.pinIds };
    }
    dataUrls.push(dataUrlForJpeg(row.bytes));
    imageLabels.push(image.labelAr);
  }
  return {
    imageIds: selected.images.map((image) => image.id),
    dataUrls,
    imageLabels,
    localReply: null,
    clarify: false,
    pinIds: selected.pinIds,
  };
}

@Injectable()
export class ConsultationDialogueService implements OnModuleInit, OnModuleDestroy {
  readonly limits: DialogueLimits;
  private readonly repo: PrivateFileAttachmentRepository;
  private readonly secret: string;
  private readonly sweepMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(ConfigService) config: ConfigService,
  ) {
    // Private files stay outside the database. On an ephemeral filesystem this directory
    // does not survive restart or deploy; production needs a durable disk or object storage.
    const dir = config.get<string>('MCE_ATTACHMENT_DIR')
      || join(process.cwd(), '.private', 'consultation-attachments');
    this.repo = new PrivateFileAttachmentRepository(prisma, dir);
    this.limits = readDialogueLimits({
      MCE_MAX_IMAGES_PER_MESSAGE: config.get<string>('MCE_MAX_IMAGES_PER_MESSAGE'),
      MCE_MAX_IMAGES_IN_CONTEXT: config.get<string>('MCE_MAX_IMAGES_IN_CONTEXT'),
      MCE_MAX_IMAGE_BYTES: config.get<string>('MCE_MAX_IMAGE_BYTES'),
      MCE_MAX_IMAGES_PER_DAY: config.get<string>('MCE_MAX_IMAGES_PER_DAY'),
      MCE_IMAGE_MAX_EDGE: config.get<string>('MCE_IMAGE_MAX_EDGE'),
      MCE_ATTACHMENT_RETENTION_DAYS: config.get<string>('MCE_ATTACHMENT_RETENTION_DAYS'),
      MCE_ATTACHMENT_TOKEN_TTL_SEC: config.get<string>('MCE_ATTACHMENT_TOKEN_TTL_SEC'),
    });
    this.secret = attachmentTokenSecret({
      attachmentSecret: config.get<string>('MCE_ATTACHMENT_TOKEN_SECRET'),
      jwtSecret: config.get<string>('JWT_SECRET'),
    }) ?? '';
    const sweep = Number(config.get<string>('MCE_ATTACHMENT_SWEEP_MS'));
    this.sweepMs = Number.isFinite(sweep) && sweep >= 1000 ? sweep : 60 * 60 * 1000;
  }

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.sweep();
    }, this.sweepMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async save(input: { userId: string; sessionId: string; bytes: Buffer; now?: Date }): Promise<AttachmentRow> {
    const now = input.now ?? new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    if (await this.repo.countSince(input.userId, since) >= this.limits.maxImagesPerDay) {
      throw new ConsultationImageError('وصلتِ حد الصور اليومي. حاولي لاحقًا.');
    }
    await this.purgeExpired(now);
    const prepared = await prepareConsultationImage(input.bytes, this.limits);
    const id = randomUUID();
    const row: AttachmentRow = {
      id,
      userId: input.userId,
      sessionId: input.sessionId,
      messageId: null,
      createdAt: now,
      mimeType: prepared.mimeType,
      byteSize: prepared.bytes.length,
      sha256: prepared.sha256,
      width: prepared.width,
      height: prepared.height,
      storageKey: safeStorageKey(input.userId, input.sessionId, id),
      status: 'ready',
      deletedAt: null,
      bytes: prepared.bytes,
    };
    await this.repo.insert(row);
    return { ...row, bytes: null };
  }

  async assertInSession(userId: string, sessionId: string, attachmentId: string, now = new Date()): Promise<void> {
    const row = await this.repo.find(attachmentId);
    if (!row || row.userId !== userId || row.sessionId !== sessionId) {
      throw new NotFoundException('الصورة غير موجودة في هذه المحادثة.');
    }
    if (attachmentExpired(row.createdAt, this.limits.retentionDays, now)) {
      throw new ConsultationImageError('انتهت مدة الاحتفاظ بهذه الصورة.');
    }
  }

  async readOwned(userId: string, attachmentId: string, now = new Date()): Promise<AttachmentRow> {
    const row = await this.repo.find(attachmentId);
    if (!row || row.userId !== userId || !row.bytes) throw new NotFoundException('الصورة غير موجودة.');
    if (attachmentExpired(row.createdAt, this.limits.retentionDays, now)) {
      throw new ConsultationImageError('انتهت مدة الاحتفاظ بهذه الصورة.');
    }
    return row;
  }

  readToken(userId: string, attachmentId: string, nowSec = Math.floor(Date.now() / 1000)): string | null {
    if (!this.secret) return null;
    return signReadToken({
      secret: this.secret,
      userId,
      attachmentId,
      expiresAtSec: nowSec + this.limits.readTokenTtlSec,
    });
  }

  async removeUnsent(userId: string, attachmentId: string): Promise<void> {
    await removeUnsentAttachment(this.repo, userId, attachmentId);
  }

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    const rows = await this.repo.listSession(userId, sessionId);
    await this.repo.markDeleted(rows.map((row) => row.id), new Date());
  }

  purgeExpired(now = new Date()) {
    return purgeExpiredAttachments(this.repo, this.limits.retentionDays, now);
  }

  async sweep(now = new Date()) {
    const expired = await this.purgeExpired(now);
    let retried = 0;
    for (const row of await this.repo.listRetryDeletes()) {
      if ((await this.repo.deleteStored(row.id, now)) === 'deleted') retried += 1;
    }
    const disk = await this.repo.listDiskEntries();
    const live = await this.repo.storageKeys();
    const recent = disk
      .filter((entry) => now.getTime() - entry.mtimeMs < UPLOAD_GRACE_MS)
      .map((entry) => entry.key);
    let orphans = 0;
    let orphanFailures = 0;
    for (const key of orphanStorageKeys(disk.map((entry) => entry.key), live, [...recent, ...this.repo.inflightKeys()])) {
      try {
        await rm(this.repo.pathFor(key), { force: false });
        orphans += 1;
      } catch {
        orphanFailures += 1;
      }
    }
    return { ...expired, orphans, orphanFailures, retried };
  }

  prepare(input: {
    userId: string;
    sessionId: string;
    message: string;
    attachmentIds: string[];
    pinnedIds?: string[];
    history?: Array<{ role: string; content: string }>;
    model: string;
    now?: Date;
  }): Promise<DialogueResolution> {
    return resolveDialogueTurn({ repo: this.repo, ...input, limits: this.limits });
  }

  bind(ids: string[], messageId: string, owner: { userId: string; sessionId: string }): Promise<void> {
    return this.repo.bind(ids, messageId, owner);
  }
}
