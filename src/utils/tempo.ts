/**
 * Master Tempo utilities
 *
 * Converts BPM + TempoRatio to concrete rate values, and applies those
 * values to a copy of AppState so all downstream rendering code stays
 * unaware of the lock system.
 */

import { AppState, TempoRatio } from '../types';
import { computeSpeedRampFactor } from './color';

export const TEMPO_RATIOS: TempoRatio[] = ['1/8', '1/4', '1/2', '1', '2', '4', '8'];

/** Convert a TempoRatio string to a numeric multiplier (relative to 1 beat). */
export function ratioToNumber(r: TempoRatio): number {
  switch (r) {
    case '1/8': return 1 / 8;
    case '1/4': return 1 / 4;
    case '1/2': return 1 / 2;
    case '1':   return 1;
    case '2':   return 2;
    case '4':   return 4;
    case '8':   return 8;
  }
}

/**
 * Seconds per one cycle at the given BPM and ratio.
 * Ratio > 1 = faster than master (shorter period).
 * Ratio < 1 = slower than master (longer period).
 */
export function tempoPeriodSec(bpm: number, ratio: TempoRatio): number {
  return (60 / bpm) / ratioToNumber(ratio);
}

/**
 * Cycles per second (Hz) at the given BPM and ratio.
 */
export function tempoRateHz(bpm: number, ratio: TempoRatio): number {
  return (bpm / 60) * ratioToNumber(ratio);
}

/**
 * Milliseconds until the next occurrence of beatOffset (1-indexed) within
 * a measure of beatsPerMeasure, given the current master phase.
 *
 * Used by edge-triggered overlay components (InversionOverlay, TextOverlay)
 * to schedule their next fire time without relying on React renders.
 *
 * Returns a safe default (one beat period) if the session clock hasn't
 * started yet (sessionStartMs === 0).
 */
export function msUntilNextBeatOffset(
  bpm: number,
  beatsPerMeasure: number,
  beatOffset: number,   // 1-indexed: 1 = downbeat, 2 = beat 2, etc.
  sessionStartMs: number
): number {
  const beatPeriodMs = (60 / bpm) * 1000;

  if (sessionStartMs === 0) return beatPeriodMs; // canvas not started yet

  const now = performance.now();
  const sessionTimeSec = (now - sessionStartMs) / 1000;
  const masterPhase = sessionTimeSec * (bpm / 60); // total beats elapsed

  // targetBeat is 0-indexed
  const targetBeat = Math.max(0, Math.min(beatsPerMeasure - 1, beatOffset - 1));

  // Phase of the start of the target beat within the current measure
  const measureIdx = Math.floor(masterPhase / beatsPerMeasure);
  let nextFirePhase = measureIdx * beatsPerMeasure + targetBeat;

  // If we've already passed that beat this measure, go to next measure
  if (nextFirePhase <= masterPhase) {
    nextFirePhase += beatsPerMeasure;
  }

  const phaseDiff = nextFirePhase - masterPhase;
  // masterPhase increases at BPM/60 per second, so: ms = phaseDiff / (BPM/60) * 1000
  return Math.max(16, phaseDiff * beatPeriodMs);
}

/**
 * Apply master tempo locks to a state object.
 *
 * Returns a new state copy where each locked RATE-BASED system's field is
 * replaced with the tempo-derived value. Edge-triggered systems (strobe,
 * inversion, text, fragment pulse) are handled directly by their components
 * using msUntilNextBeatOffset — this function does not override their fields.
 *
 * Special case — lockSpeedRamp:
 *   Instead of setting rampDuration (which makes ramp cycles the same length
 *   as a beat — far too fast), we compute the current ramp factor and use it
 *   to modulate masterTempoBpm. This makes the ramp a BPM envelope: the tempo
 *   breathes slowly up and down, and all locked effects follow together.
 *
 * Pass the original (user-edited) state to ControlsPanel so sliders
 * continue to display the user's base values.
 */
export function applyMasterTempo(state: AppState): AppState {
  if (!state.masterTempoEnabled) return state;

  const bpm = state.masterTempoBpm;
  const derived: Partial<AppState> = {};

  // ── BPM Envelope (speed ramp modulates BPM) ───────────────────────────────
  let effectiveBpm = bpm;
  if (state.lockSpeedRamp && state.pulseSpeed) {
    const timeSec = (performance.now() - state.rampEpoch) / 1000;
    const factor = computeSpeedRampFactor(
      timeSec, state.pulseMin, state.pulseMax, state.rampDuration, state.rampMode
    );
    effectiveBpm = Math.max(10, Math.min(240, bpm * factor));
    // Expose the ramped BPM so canvas / debug panel show the live value
    derived.masterTempoBpm = effectiveBpm;
  }

  // ── Rate-based locks (use effectiveBpm so ramp modulation flows through) ──

  // Color cycling — colorCyclingSpeed is in cycles/sec
  if (state.lockColorCycling) {
    derived.colorCyclingSpeed = tempoRateHz(effectiveBpm, state.lockColorCyclingRatio);
  }

  // Hue rotate — hueRotateSpeed is in degrees/sec; one full cycle = 360°
  if (state.lockHueRotate) {
    derived.hueRotateSpeed = tempoRateHz(effectiveBpm, state.lockHueRotateRatio) * 360;
  }

  // Audio tremolo — audioTremoloRate is Hz, capped at 10
  if (state.lockAudioTremolo) {
    derived.audioTremoloRate = Math.min(10, tempoRateHz(effectiveBpm, state.lockAudioTremoloRatio));
  }

  // Audio beat — audioBeatFreq is Hz, capped at 40
  if (state.lockAudioBeat) {
    derived.audioBeatFreq = Math.min(40, Math.max(0.5, tempoRateHz(effectiveBpm, state.lockAudioBeatRatio)));
  }

  // ── Edge-triggered systems ────────────────────────────────────────────────
  // Strobe, Inversion, Text: scheduling is handled inside each component
  // via msUntilNextBeatOffset. We do NOT override their rate fields here.

  // Fragment pulse: handled inside SpiralCanvas using masterPhaseRef directly.
  // We pass through fragmentPulseRate unchanged so the old path still works
  // when masterTempoEnabled is false.

  if (Object.keys(derived).length === 0) return state;
  return { ...state, ...derived };
}

/**
 * Human-readable label for a TempoRatio, e.g. '1/4' → '¼×', '4' → '4×'.
 */
export function ratioLabel(r: TempoRatio): string {
  switch (r) {
    case '1/8': return '⅛×';
    case '1/4': return '¼×';
    case '1/2': return '½×';
    case '1':   return '1×';
    case '2':   return '2×';
    case '4':   return '4×';
    case '8':   return '8×';
  }
}
