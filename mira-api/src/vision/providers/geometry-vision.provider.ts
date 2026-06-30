import { GeometryPayload } from '../schema/fashion-vision-document.v1';

/** Geometry-only vision provider — no occasion, user, scores, or recommendations. */
export interface GeometryVisionProvider {
  segment(imageBuffer: Buffer): Promise<GeometryPayload>;
}

export const GEOMETRY_VISION_PROVIDER = Symbol('GEOMETRY_VISION_PROVIDER');
