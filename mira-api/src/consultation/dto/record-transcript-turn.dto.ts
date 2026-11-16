import { IsString, MaxLength, MinLength } from 'class-validator';

/** Persist a user + assistant turn without calling the LLM (link clarify, etc.). */
export class RecordTranscriptTurnDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  userContentAr!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  assistantContentAr!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(80)
  clientMessageId!: string;
}
