import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { FACE_GATE_MESSAGES } from './youcam-face-errors';

const MIN_EDGE_PX = 320;
const MAX_EDGE_PX = 8000;
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ASPECT_RATIO = 2.6;

@Injectable()
export class FaceGateService {
  /** Structural validation before YouCam — complements on-device ML Kit. */
  async assertAnalyzablePhoto(imageBuffer: Buffer): Promise<void> {
    if (!imageBuffer?.length) {
      throw new BadRequestException(FACE_GATE_MESSAGES.empty);
    }

    if (imageBuffer.length > MAX_BYTES) {
      throw new BadRequestException(FACE_GATE_MESSAGES.tooLarge);
    }

    let meta: sharp.Metadata;
    try {
      meta = await sharp(imageBuffer, { failOn: 'none' }).rotate().metadata();
    } catch {
      throw new BadRequestException(FACE_GATE_MESSAGES.invalidImage);
    }

    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width < MIN_EDGE_PX || height < MIN_EDGE_PX) {
      throw new BadRequestException(FACE_GATE_MESSAGES.tooSmall);
    }

    if (width > MAX_EDGE_PX || height > MAX_EDGE_PX) {
      throw new BadRequestException(FACE_GATE_MESSAGES.tooLarge);
    }

    const shortEdge = Math.min(width, height);
    const longEdge = Math.max(width, height);
    if (longEdge / shortEdge > MAX_ASPECT_RATIO) {
      throw new BadRequestException(FACE_GATE_MESSAGES.extremeAspect);
    }
  }
}
