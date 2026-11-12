/**
 * Partner OTP delivery: never claim success without a configured sender.
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deliverPartnerPhoneOtp, PartnerOtpSmsError } from './partner-otp-sms';
import { publicContactPhone } from '../marketplace/partner-public-contact';

async function main() {
  assert.equal(
    publicContactPhone({ contactPhone: '0500000000', activitiesMeta: { publicContactVisible: false } }),
    null,
  );
  assert.equal(
    publicContactPhone({ contactPhone: '0500000000', activitiesMeta: {} }),
    null,
  );
  assert.equal(
    publicContactPhone({
      contactPhone: '0500000000',
      activitiesMeta: { publicContactVisible: true },
    }),
    '0500000000',
  );

  await assert.rejects(
    () => deliverPartnerPhoneOtp('0500000000', '123456', { mode: null }),
    (err: unknown) => err instanceof PartnerOtpSmsError && err.code === 'SMS_NOT_CONFIGURED',
  );

  const dir = await mkdtemp(join(tmpdir(), 'mira-otp-'));
  const outbox = join(dir, 'outbox.ndjson');
  const delivered = await deliverPartnerPhoneOtp('0501234567', '654321', {
    mode: 'outbox',
    outboxPath: outbox,
  });
  assert.equal(delivered.delivered, true);
  assert.equal(delivered.channel, 'outbox');
  const lines = (await readFile(outbox, 'utf8')).trim().split('\n');
  assert.equal(lines.length, 1);
  const row = JSON.parse(lines[0]);
  assert.equal(row.code, '654321');
  assert.equal(row.phoneLast4, '4567');
  assert.ok(!('phone' in row), 'full phone must not be stored in outbox');

  await rm(dir, { recursive: true, force: true });
  console.log('OK partner-otp-sms schema');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
