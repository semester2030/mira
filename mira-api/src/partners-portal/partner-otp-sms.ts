/**
 * DEFERRED — not used by partner apply in this phase.
 * Admin review gates registration; phone OTP is a later milestone (not a closure blocker).
 *
 * Modes (PARTNER_OTP_SMS_MODE) when re-wired later:
 * - http: POST JSON { phone, code, purpose } to PARTNER_OTP_SMS_URL
 * - outbox: append to PARTNER_OTP_SMS_OUTBOX
 */
import { createHash, randomBytes } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export type PartnerOtpSmsResult = {
  delivered: true;
  channel: 'http' | 'outbox';
  /** Present only for outbox/dev inspection — never return to public clients in production. */
  outboxRef?: string;
};

export class PartnerOtpSmsError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PartnerOtpSmsError';
  }
}

export type PartnerOtpSmsConfig = {
  mode?: string | null;
  url?: string | null;
  outboxPath?: string | null;
  timeoutMs?: number;
};

export async function deliverPartnerPhoneOtp(
  phone: string,
  code: string,
  config: PartnerOtpSmsConfig,
): Promise<PartnerOtpSmsResult> {
  const mode = String(config.mode || '').trim().toLowerCase();
  if (!mode) {
    throw new PartnerOtpSmsError(
      'SMS_NOT_CONFIGURED',
      'مزوّد إرسال رمز التحقق غير مضبوط (PARTNER_OTP_SMS_MODE)',
    );
  }
  if (mode === 'http') {
    const url = String(config.url || '').trim();
    if (!url) {
      throw new PartnerOtpSmsError('SMS_NOT_CONFIGURED', 'PARTNER_OTP_SMS_URL مطلوب في وضع http');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 8000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          phone,
          code,
          purpose: 'partner_apply_phone',
          template: 'mira_partner_apply_otp',
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new PartnerOtpSmsError(
          'SMS_DELIVERY_FAILED',
          `فشل إرسال رمز التحقق (HTTP ${res.status})`,
        );
      }
      return { delivered: true, channel: 'http' };
    } catch (err) {
      if (err instanceof PartnerOtpSmsError) throw err;
      throw new PartnerOtpSmsError(
        'SMS_DELIVERY_FAILED',
        err instanceof Error ? err.message : 'فشل إرسال رمز التحقق',
      );
    } finally {
      clearTimeout(timer);
    }
  }
  if (mode === 'outbox') {
    const path =
      String(config.outboxPath || '').trim() ||
      '/tmp/mira-partner-otp-outbox.ndjson';
    await mkdir(dirname(path), { recursive: true }).catch(() => undefined);
    const ref = randomBytes(8).toString('hex');
    const line = JSON.stringify({
      at: new Date().toISOString(),
      ref,
      phoneHash: createHash('sha256').update(phone).digest('hex').slice(0, 16),
      phoneLast4: phone.slice(-4),
      code,
      purpose: 'partner_apply_phone',
    });
    await appendFile(path, line + '\n', 'utf8');
    return { delivered: true, channel: 'outbox', outboxRef: ref };
  }
  throw new PartnerOtpSmsError(
    'SMS_NOT_CONFIGURED',
    `وضع إرسال غير مدعوم: ${mode} (استخدم http أو outbox)`,
  );
}
