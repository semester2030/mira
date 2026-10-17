import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { CommerceService } from '../marketplace/commerce.service';
import { JOURNEY_MAX_EVENTS, JOURNEY_RETENTION_MS, recordJourney, storedJourneyEvents } from '../marketplace/journey-events';
import { PrismaService } from '../prisma/prisma.service';
import { COMMERCIAL_GAP_AR, guardCommercialTurn } from './services/mce-commercial-guard';
import { MceModerationService } from './services/mce-moderation.service';
import { McePromptAssemblerService } from './services/mce-prompt-assembler.service';

const repo = resolve(__dirname, '../../..');

function read(path: string): string {
  return readFileSync(resolve(repo, path), 'utf8');
}

function qualityFixes(): void {
  const html = read('website/privacy.html');
  assert.equal(html.includes('4 أكتوبر 2026'), true);
  assert.equal(html.includes('سبعة أيام'), true);
  assert.equal(html.includes('ثلاثة أيام أو سبعة'), false);
  assert.equal(html.includes('لا نعدك بحذف فوري من النسخ'), true);

  const prompt = new McePromptAssemblerService(new MceModerationService()).buildMessages({
    snapshot: {
      schemaVersion: '1.0.0',
      builtAt: '2026-10-11T12:00:00.000Z',
      user: { locale: 'ar', isMinor: false, subscriptionPlan: 'free' },
    } as never,
    factRegistry: [{ id: 'skin.moisture', labelAr: 'الترطيب', valueAr: '70', confidence: 'high' }],
    history: [],
    userMessage: 'هل هذه النصيحة إعلان مدفوع؟',
  }).map((row) => row.content).join('\n');
  assert.equal(prompt.includes('ليست إعلانًا مدفوعًا'), true);

  const hydration = guardCommercialTurn(
    'البشرة الجافة تحتاج ترطيبًا. السعر 99 ريال وهو متوفر.',
    [{ id: 'skin.moisture', labelAr: 'الترطيب', valueAr: '70', confidence: 'high' }],
    'اشرحي ترطيب بشرتي فقط',
  );
  assert.equal(hydration.text.includes('ترطيب'), true);
  assert.equal(hydration.text.includes(COMMERCIAL_GAP_AR), false);
  assert.equal(hydration.text.includes('99'), false);

  const asked = guardCommercialTurn(
    'السعر 99 ريال',
    [],
    'كم سعر المنتج؟',
  );
  assert.equal(asked.text.includes(COMMERCIAL_GAP_AR), true);
  const priceOnly = guardCommercialTurn('السعر 99 ريال ومتوفر اليوم.', [], 'ما الروتين؟');
  assert.equal(priceOnly.text.includes('99'), false);
  assert.equal(priceOnly.text.includes(COMMERCIAL_GAP_AR), true);
}

function configuredDatabaseUrl(): string {
  const line = read('mira-api/.env').split('\n').find((row) => row.startsWith('DATABASE_URL='));
  return line?.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '') ?? '';
}

async function retentionAndFailure(): Promise<void> {
  const source = configuredDatabaseUrl();
  const configured = new URL(source);
  if (!['localhost', '127.0.0.1', '::1'].includes(configured.hostname)) throw new Error('REFUSED database host is not local');
  const url = new URL(`postgresql://${process.env.USER ?? 'localhost'}@${configured.hostname}:${configured.port || 5432}/mira_open_items_test`);
  process.env.DATABASE_URL = url.toString();
  const prisma = new PrismaClient();
  try {
    await prisma.journeyEvent.deleteMany();
    const ancient = new Date(Date.now() - JOURNEY_RETENTION_MS - 60_000);
    await prisma.journeyEvent.create({ data: { name: 'service_viewed', kind: 'service', createdAt: ancient } });
    await prisma.journeyEvent.createMany({
      data: Array.from({ length: JOURNEY_MAX_EVENTS }, (_, index) => ({ name: 'order_started', kind: 'order', code: `n${index}` })),
    });
    await recordJourney({ name: 'order_completed', kind: 'order', subjectId: 'cap-check' }, prisma);
    assert.equal(await prisma.journeyEvent.count(), JOURNEY_MAX_EVENTS);
    assert.equal(await prisma.journeyEvent.count({ where: { createdAt: { lt: new Date(Date.now() - JOURNEY_RETENTION_MS) } } }), 0);
    const names = (await storedJourneyEvents(prisma)).map((event) => event.name);
    assert.equal(names.includes('order_completed'), true);
    assert.equal(names.includes('service_viewed'), false);
    const stored = JSON.stringify(names);
    assert.equal(stored.includes('@'), false);

    const reread = execFileSync('./node_modules/.bin/tsx', ['-e', `
      import { PrismaClient } from '@prisma/client';
      async function main() {
        const prisma = new PrismaClient();
        const count = await prisma.journeyEvent.count();
        console.log(String(count));
        await prisma.$disconnect();
      }
      void main();
    `], { cwd: resolve(repo, 'mira-api'), env: process.env, encoding: 'utf8' }).trim();
    assert.equal(reread, String(JOURNEY_MAX_EVENTS));

    const commerce = new CommerceService(prisma as unknown as PrismaService);
    const original = prisma.journeyEvent.create.bind(prisma.journeyEvent);
    prisma.journeyEvent.create = (async () => { throw new Error('measurement down'); }) as typeof prisma.journeyEvent.create;
    try {
      await assert.rejects(
        () => commerce.createOrder({ type: 'customer', id: 'rc3', userId: 'rc3' }, { idempotencyKey: 'rc3-fail' }),
        (error: unknown) => {
          const body = error && typeof error === 'object' && 'getResponse' in error
            ? (error as { getResponse: () => { code?: string } }).getResponse()
            : {};
          return typeof body.code === 'string' && body.code.length > 0;
        },
      );
    } finally {
      prisma.journeyEvent.create = original;
    }
  } finally {
    await prisma.journeyEvent.deleteMany().catch(() => undefined);
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  qualityFixes();
  await retentionAndFailure();
  console.log('OPEN_ITEMS_RC3_PASS');
}

void main();
