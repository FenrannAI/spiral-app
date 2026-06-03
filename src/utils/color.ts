
import { RampMode } from '../types';

/**
 * Hex-string → [r, g, b] tuple cache.
 *
 * The gradient builder calls lerpColor 64 times per gradient × N gradients per
 * frame.  Every call previously ran a regex + 3 parseInt's on the same handful
 * of hex strings.  A trivial Map cache turns those parseInt's into a single
 * map lookup, eliminating thousands of redundant parses per second.
 *
 * The cache key set is bounded by the number of distinct hex colors in active
 * use (typically <50 across all gradient stops + UI palette), so unbounded
 * growth is not a practical concern.
 */
const HEX_RGB_CACHE = new Map<string, [number, number, number]>();

function parseHex(hex: string): [number, number, number] {
  const cached = HEX_RGB_CACHE.get(hex);
  if (cached) return cached;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  const rgb: [number, number, number] = result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
  HEX_RGB_CACHE.set(hex, rgb);
  return rgb;
}

/** Linear-interpolate between two hex colour strings.  Returns a hex string. */
export function lerpColor(c1: string, c2: string, amount: number): string {
  const [r1, g1, b1] = parseHex(c1);
  const [r2, g2, b2] = parseHex(c2);
  const r = Math.round(r1 + amount * (r2 - r1));
  const g = Math.round(g1 + amount * (g2 - g1));
  const b = Math.round(b1 + amount * (b2 - b1));
  return '#' +
    r.toString(16).padStart(2, '0') +
    g.toString(16).padStart(2, '0') +
    b.toString(16).padStart(2, '0');
}

/**
 * Legacy sine‑based speed ramp factor.
 * Oscillates between pulseMin and pulseMax.
 */
function computeSpeedRampLegacy(timeSec: number, pulseMin: number, pulseMax: number, rampDuration: number): number {
  const freq = (2 * Math.PI) / Math.max(0.1, rampDuration);
  const normalized = 0.5 + 0.5 * Math.sin(timeSec * freq);
  const factor = pulseMin + (pulseMax - pulseMin) * normalized;
  return Math.max(0.01, factor);
}

/**
 * New sawtooth speed ramp factor.
 * Starts at 1 (100%), increases linearly to pulseMax over rampDuration,
 * then resets instantly back to 1 and repeats.
 * Uses a small epsilon to snap exactly to 1.0 at the start of each cycle.
 */
function computeSpeedRampSawtooth(timeSec: number, pulseMax: number, rampDuration: number): number {
  const period = Math.max(0.1, rampDuration);
  const cycleTime = timeSec % period;
  const progress = cycleTime / period; // 0 -> 1 linearly

  // Snap to exactly 1.0 when near the beginning of the cycle
  if (progress < 1e-8) {
    return 1.0;
  }

  const factor = 1 + (pulseMax - 1) * progress;
  return Math.max(0.01, factor);
}

/**
 * Unified speed ramp factor that dispatches by mode.
 */
export function computeSpeedRampFactor(
  timeSec: number,
  pulseMin: number,
  pulseMax: number,
  rampDuration: number,
  mode: RampMode = 'legacy'
): number {
  if (mode === 'sawtooth') {
    return computeSpeedRampSawtooth(timeSec, pulseMax, rampDuration);
  }
  return computeSpeedRampLegacy(timeSec, pulseMin, pulseMax, rampDuration);
}
