import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MceLlmService } from './mce-llm.service';
import { ConsultationMessageService } from './consultation-message.service';
import { dialogueMemoryLines } from './consultation-dialogue';

const COMPACT_EVERY_TURNS = 8;

@Injectable()
export class MceMemoryCompactionService {
  constructor(
    private readonly messages: ConsultationMessageService,
    private readonly llm: MceLlmService,
    private readonly config: ConfigService,
  ) {}

  shouldCompact(turnCount: number): boolean {
    return turnCount > 0 && turnCount % COMPACT_EVERY_TURNS === 0;
  }

  async compact(sessionId: string, existingSummary: string | null): Promise<string> {
    const history = await this.messages.recentPairs(sessionId, 16);
    if (history.length === 0) return existingSummary ?? '';

    const ruleSummary = this.ruleBasedSummary(history, existingSummary);
    if (!this.llm.isConfigured()) {
      return ruleSummary;
    }

    try {
      const { payload } = await this.llm.complete([
        {
          role: 'system',
          content:
            'لخّصي محادثة استشارة جمال بالعربية في 4-6 جمل. احفظي التفضيلات وتصحيحاتها ومراجع الصور. لا تُخترعي أرقاماً.',
        },
        {
          role: 'user',
          content: [
            existingSummary ? `ملخص سابق:\n${existingSummary}` : '',
            'الرسائل الأخيرة:',
            history.map((h) => `${h.role}: ${h.content}`).join('\n'),
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ]);
      const text = payload.answerAr?.trim();
      return [text || ruleSummary, ...dialogueMemoryLines(history)].filter(Boolean).join('\n').slice(0, 1200);
    } catch {
      return ruleSummary;
    }
  }

  private ruleBasedSummary(
    history: Array<{ role: string; content: string; attachmentIds?: string[] }>,
    existing: string | null,
  ): string {
    const memory = dialogueMemoryLines(history);
    const snippets = history
      .filter((h) => h.role === 'user')
      .slice(-4)
      .map((h) => h.content.slice(0, 140));
    return [existing?.slice(0, 400), ...memory, snippets.join(' · ')].filter(Boolean).join('\n').slice(0, 1200);
  }
}
