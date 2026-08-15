// Ambient decorative background: two mirrored sweeps of long curved strokes,
// adapted from a hero "floating paths" effect. The original drew 36 strokes
// per direction; PATH_COUNT is cut down for a lighter always-on animation, so
// STEP re-scales the per-index spacing to keep the same visual spread.

export const VIEWBOX = { width: 696, height: 316 };

const PATH_COUNT = 14;
const STEP = 36 / PATH_COUNT;

export interface BackgroundPath {
  d: string;
  strokeOpacity: number;
  strokeWidth: number;
}

export function generateBackgroundPaths(direction: 1 | -1): BackgroundPath[] {
  return Array.from({ length: PATH_COUNT }, (_, index) => {
    const i = index * STEP;
    const offset = i * 5 * direction;
    return {
      d: `M-${380 - offset} -${189 + i * 6}C-${380 - offset} -${189 + i * 6} -${312 - offset} ${216 - i * 6} ${152 - offset} ${343 - i * 6}C${616 - offset} ${470 - i * 6} ${684 - offset} ${875 - i * 6} ${684 - offset} ${875 - i * 6}`,
      strokeOpacity: Math.min(1, 0.1 + i * 0.03),
      strokeWidth: 0.5 + i * 0.03,
    };
  });
}
