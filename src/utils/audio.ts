/**
 * Audio utility helpers — pure functions, no Web Audio dependencies.
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Converts a frequency in Hz to its closest equal-tempered note name.
 * A4 = 440 Hz = MIDI 69.
 * Returns e.g. "A3", "C#4", "F5".  Octave is the scientific pitch notation octave.
 */
export function freqToNote(freq: number): string {
  if (freq <= 0) return '—';
  const midi = 69 + 12 * Math.log2(freq / 440);
  const rounded = Math.round(midi);
  const noteIdx = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return `${NOTE_NAMES[noteIdx]}${octave}`;
}

/**
 * Maps a beat frequency (Hz) to its EEG brainwave band label.
 *   delta < 4 < theta < 8 < alpha < 13 < beta < 30 < gamma
 */
export function beatToBand(hz: number): string {
  if (hz < 4)  return 'delta';
  if (hz < 8)  return 'theta';
  if (hz < 13) return 'alpha';
  if (hz < 30) return 'beta';
  return 'gamma';
}

/**
 * Frequency ratios for the supported drone intervals (just-intonation-ish).
 * Used by AudioEngine to derive drone pitch from the carrier.
 */
export const DRONE_INTERVAL_RATIOS = {
  minorSecond: 16 / 15,
  majorThird:  5 / 4,
  fourth:      4 / 3,
  fifth:       3 / 2,
  tritone:     Math.SQRT2,
  octave:      2,
} as const;
