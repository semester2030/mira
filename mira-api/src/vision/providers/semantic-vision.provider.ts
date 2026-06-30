import { GeometryPayload, SemanticsPayload } from '../schema/fashion-vision-document.v1';

export interface SemanticVisionInput {
  imageBuffer: Buffer;
  geometry?: GeometryPayload;
  locale?: string;
}

/** Semantic-only vision provider — attributes, no scores or recommendations. */
export interface SemanticVisionProvider {
  describe(input: SemanticVisionInput): Promise<SemanticsPayload>;
}

export const SEMANTIC_VISION_PROVIDER = Symbol('SEMANTIC_VISION_PROVIDER');
