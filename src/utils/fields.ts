import { AppState } from '../types';

/**
 * Base-only fields: meaningful at the top level of a preset/sequence, but NOT
 * inside an individual phase and never changed by playback. (More may be added.)
 */
export const BASE_ONLY = new Set<keyof AppState>([
  'maxFps', 'highQuality', 'debugEnabled',
]);

/**
 * Fields excluded from ALL exported settings (runtime-only, archived/no-op, or
 * sequencer metadata that is serialized separately at the top level).
 */
export const NON_SETTINGS = new Set<keyof AppState>([
  // Runtime-only
  'rampEpoch', 'sequencerPlaying', 'transitionInversion', 'textBg',
  // Archived / no runtime effect
  'spiralRenderMode',
  'zoomEnabled', 'zoomSpeed', 'zoomDirection', 'zoomMin', 'zoomMax', 'zoomEasing', 'zoomMode', 'rampZoomSpeed',
  'fragmentCols', 'fragmentRows', 'fragmentRenderMode', 'fragmentBorderWidth', 'fragmentBorderColor',
  'cellFalloff', 'fragmentAutoPulse', 'fragmentDutyCycle', 'fragmentPulseRate', 'rampFragmentPulse',
  'lockFragmentPulse', 'lockFragmentPulseRatio', 'lockFragmentPulseBeat',
  // Sequencer metadata (serialized at the top level, not inside settings)
  'sequencerEnabled', 'sequencerPlaying', 'sequencerLoop', 'sequenceTitle', 'sequencePhases',
]);

/** True if a key belongs inside a phase's fully-explicit `settings` object. */
export const isPhaseSetting = (key: keyof AppState) => !NON_SETTINGS.has(key) && !BASE_ONLY.has(key);
