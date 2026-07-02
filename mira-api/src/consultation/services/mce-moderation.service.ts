import { Injectable } from '@nestjs/common';
import { checkAdvisorGuard } from '../../advisor/engines/advisor-guard';
import { ADVISOR_DISCLAIMER_AR } from '../../advisor/contracts/advisor-response.interface';

export interface ModerationResult {
  blocked: boolean;
  safeReply?: string;
  reason?: string;
}

@Injectable()
export class MceModerationService {
  preCheck(message: string, isMinor: boolean): ModerationResult {
    const guard = checkAdvisorGuard(message);
    if (guard.blocked && guard.safeReply) {
      return { blocked: true, safeReply: guard.safeReply, reason: guard.reason };
    }

    if (isMinor && /تقشير|ريتينول|retinol|حمض|peel/i.test(message)) {
      return {
        blocked: true,
        safeReply:
          'للحفاظ على سلامتكِ، نركّز على عناية لطيفة ومناسبة لعمركِ. يمكنكِ سؤالي عن الترطيب والحماية من الشمس.',
        reason: 'minor_restricted',
      };
    }

    return { blocked: false };
  }

  disclaimer(): string {
    return ADVISOR_DISCLAIMER_AR;
  }
}
