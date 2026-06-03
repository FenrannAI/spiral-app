
/**
 * debugStore — mutable singleton written by SpiralCanvas every animation frame.
 * ControlsPanel polls this at ~10 Hz when the debug tab is active.
 *
 * Fields are grouped by system for clarity and future global-clock sync work.
 */

export const debugStore: {
  // ── Global clock ──────────────────────────────────────────────────────────
  /** Seconds since the first animation frame — monotonic, never resets. */
  sessionTime: number;
  /** Wall-clock timestamp of first frame (performance.now()). 0 until first frame. */
  sessionStartMs: number;

  // ── Frame performance ─────────────────────────────────────────────────────
  fps: number;
  /** Raw delta between the last two rAF timestamps, in ms. */
  frameTimeMs: number;
  /** Total frames rendered since page load. */
  frameCount: number;
  /** Canvas logical size at last draw (px). */
  canvasWidth: number;
  canvasHeight: number;

  // ── Motion ────────────────────────────────────────────────────────────────
  /** Current rotation accumulator value (radians, unbounded). */
  rotationAngle: number;
  /** Signed effective rotation speed applied this frame (rad/s). */
  effectiveSpeed: number;
  /** Speed ramp multiplier. 1.0 when ramp is off. */
  rampFactor: number;

  // ── Color ─────────────────────────────────────────────────────────────────
  /** Color cycling phase accumulator (0 – unbounded, mod in rendering). */
  colorPhase: number;
  /** Current animated hue offset in degrees. */
  hueOffsetDeg: number;

  // ── Master Tempo ──────────────────────────────────────────────────────────
  /** Current BPM (0 when disabled). */
  masterTempoBpm: number;
  /** Monotonically increasing phase accumulator (whole + fractional beats). */
  masterPhaseRaw: number;
  /** Current beat phase 0–1 sawtooth derived from masterPhaseRaw. */
  masterBeatPhase: number;
  /** Total complete beats since start. */
  beatCount: number;

  // ── Audio ─────────────────────────────────────────────────────────────────
  /** AudioContext state string, or 'off' when audio is disabled. */
  audioContextState: string;
  /** Beat frequency actually in use this frame (after ramp), Hz. */
  effectiveBeatFreq: number;

} = {
  sessionTime:       0,
  sessionStartMs:    0,
  fps:               0,
  frameTimeMs:       0,
  frameCount:        0,
  canvasWidth:       0,
  canvasHeight:      0,
  rotationAngle:     0,
  effectiveSpeed:    0,
  rampFactor:        1,
  colorPhase:        0,
  hueOffsetDeg:      0,
  masterTempoBpm:    0,
  masterPhaseRaw:    0,
  masterBeatPhase:   0,
  beatCount:         0,
  audioContextState: 'off',
  effectiveBeatFreq: 0,
};
