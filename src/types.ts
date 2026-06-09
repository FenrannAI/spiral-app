// SpiralRenderMode kept for saved-state compatibility — no longer drives rendering.
// All drawing now uses butt-cap segments. See SpiralCanvas.tsx for commented-out paths.
export type SpiralRenderMode = 'standard' | 'butt' | 'soft' | 'smooth' | 'ribbon';

export type VignetteShape = 'ellipse' | 'circle';

// Mathematical form of the spiral curve (replaces the render-mode selector in the UI)
export type SpiralMath = 'power' | 'log' | 'archimedean' | 'fermat';

// Geometry of the figure.
//   spiral             — classic winding arms (circular)
//   polygon            — winding arms warped to an N-gon, expanded to fill screen
//   concentricCircle   — nested filled rings (bullseye)
//   concentricPolygon  — nested filled N-gon bands
// The 'concentric*' forms draw closed nested loops instead of spiralling arms.
export type SpiralShape =
  | 'spiral'
  | 'polygon'
  | 'concentricCircle'
  | 'concentricPolygon';

export type TransitionType = 'linear' | 'ease' | 'pulse' | 'spinBurst' | 'fragment' | 'inversionPulse';

// Eyes direction: 'uniform' both spin the same way; 'alternating' opposite ways;
// 'mirror' opposite spin but mirrored geometry so both still pull in/out together.
export type FragmentDirectionMode = 'uniform' | 'alternating' | 'mirror';
// Retained for saved-state compatibility only — rendering no longer branches on it.
export type FragmentRenderMode   = 'clip' | 'blend' | 'feather';

// Compositing mode for the optional second spiral layer.
export type LayerBlendMode = 'screen' | 'multiply' | 'lighten' | 'normal';

// How a background image is fitted to the canvas.
//   cover   — fill canvas, preserve aspect, crop overflow
//   contain — fit entirely inside canvas, preserve aspect (may letterbox)
//   stretch — fill exactly, ignore aspect (may distort)
//   tile    — repeat at native size to fill
//   center  — single copy at native size, centred
export type BgFillMode = 'cover' | 'contain' | 'stretch' | 'tile' | 'center';

// A self-contained copy of the per-spiral *visual* fields, used by the optional
// second spiral layer. Global/effect fields (vignette, audio, strobe, text,
// tempo, hue) stay at the top level and are NOT duplicated here.
export type SecondarySpiral = {
  arms: number;
  turns: number;
  curve: number;
  width: number;
  rotationSpeed: number;
  direction: 1 | -1;
  wobble: number;
  wobblePhase: number;
  wobbleSpeed: number;
  spiralMath: SpiralMath;
  shape: SpiralShape;
  polygonSides: number;
  concentricTwist: number;
  colorMode: ColorMode;
  kaleidoscopeSectors: number;
  gradientType: 'Single' | 'Two' | 'Three';
  color1: string;
  color2: string;
  color3: string;
  taperStrength: number;
  armTaper: number;
  // When true, the second spiral ignores the global speed ramp (Pulse) and spins
  // at its own constant rate even while the primary spiral ramps.
  ignoreRamp: boolean;
  // Independent Afterimage Bloom for the second spiral. When enabled, the second
  // spiral gets its OWN decaying trail (separate buffers + settings) instead of
  // being folded into the primary spiral's bloom.
  afterimageEnabled: boolean;
  afterimageIntensity: number;   // 0–100
  afterimageDuration: number;    // 50–2000 ms
  afterimageHold: number;        // 0–500 ms
};

export type SequencePhase = {
  id: string;
  title: string;
  duration: number; // seconds to hold this phase
  // Fully-explicit visual settings for this phase, as a nested object (no
  // escaped JSON string, no deltas). Excludes base-only fields (maxFps,
  // highQuality, debugEnabled) and sequencer/runtime metadata.
  settings: Partial<AppState>;
  transitionType: TransitionType;
  transitionDuration: number; // seconds for the transition into this phase
};

export type RampMode = 'legacy' | 'sawtooth';

export type ZoomEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
export type ZoomDirection = 'in' | 'out';
export type ZoomMode = 'breathe' | 'tunnel';

export type ColorMode = 'default' | 'static' | 'kaleidoscopic';

export type TextAnimation = 'fade' | 'flash' | 'pulse';

// Text display mode.
//   phrase    — one line at a time, cycled (the classic behaviour)
//   rsvp      — Rapid Serial Visual Presentation: one WORD at a time, WPM-paced
//   wall      — all phrases shown at once as a static dimmed field
//   highlight — all words shown dimmed, a bright highlight sweeping through them
export type TextMode = 'phrase' | 'rsvp' | 'wall' | 'highlight';

// ── Master Tempo ─────────────────────────────────────────────────
/** Integer ratio of an effect's rate to the master BPM. Values < 1 are slower; > 1 are faster. */
export type TempoRatio = '1/8' | '1/4' | '1/2' | '1' | '2' | '4' | '8';

// ── Audio types ─────────────────────────────────────────────────
export type AudioBeatMode      = 'binaural' | 'isochronic' | 'monaural';
export type AudioWaveform      = 'sine' | 'triangle' | 'square' | 'sawtooth';
export type AudioDroneInterval = 'octave' | 'fifth' | 'fourth' | 'majorThird' | 'tritone' | 'minorSecond';
export type AudioNoiseType     = 'white' | 'pink' | 'brown';

export type AppState = {
  mode: 'Lighten' | 'Darken';
  // ── Background image ──────────────────────────────────────────────────────
  // Optional image loaded by URL that replaces the solid background; the spiral
  // blends over it via the usual Darken/Lighten compositing.
  bgImageEnabled: boolean;
  bgImageUrl: string;
  bgImageFill: BgFillMode;
  bgImageDim: number;   // 0–100 — fades the image toward the background colour
  bgImageBlur: number;  // 0–50 px blur
  arms: number;
  turns: number;
  curve: number;
  width: number;
  wobble: number;
  wobblePhase: number;
  wobbleSpeed: number;
  colorCyclingSpeed: number;
  rotationSpeed: number;
  direction: 1 | -1;
  gradientType: 'Single' | 'Two' | 'Three';
  color1: string;
  color2: string;
  color3: string;
  textEnabled: boolean;
  textLines: string;
  textColor: string;
  textBg: string;
  lineSpeed: number;
  lineTime: number;
  textSize: number; // multiplier 0.5–3.0
  textAnimation: TextAnimation;
  // ── Text display mode + per-mode options ──────────────────────────────────
  textMode: TextMode;
  wpm: number;                // 60–700 — RSVP pacing (words per minute)
  rsvpOrp: boolean;           // RSVP: highlight the optimal-recognition-point letter
  rsvpAnchor: boolean;        // RSVP: pin the ORP letter to screen centre (vs inline)
  wallOpacity: number;        // 0–100 — per-phrase alpha in 'wall' mode
  wallDensity: number;        // 20–400 — number of words packed into the wall
  highlightColor: string;     // hex — sweep colour in 'highlight' mode
  highlightSweepSpeed: number;// 0.5–12 words/sec — highlight advance rate
  customFontName: string;     // Google Fonts family name ('' = app default font)
  // Flash
  flashEnabled: boolean;
  flashColor: string;
  flashIntensity: number; // 0 to 100
  // Strobe
  intenseFlash: boolean;
  intenseStrobeDelay: number; // in ms
  strobeLength: number; // in ms
  strobeIntensity: number; // 0 to 100, opacity of strobe flash
  strobeColor1: string;
  strobeColor2: string;
  strobeColor3: string;
  strobeColorCount: number;
  // Speed ramping
  pulseSpeed: boolean;
  pulseMin: number;
  pulseMax: number;
  rampDuration: number; // Seconds for a full cycle
  // Individual ramping toggles
  rampSpiralSpeed: boolean;
  rampColorSpeed: boolean;
  rampTextSpeed: boolean;
  rampStrobeSpeed: boolean;
  // Ramp mode
  rampMode: RampMode;
  // Center Dot
  centerDotEnabled: boolean;
  centerDotRadius: number;
  centerDotColor: string;
  // Spiral render mode — retained for saved-state compatibility; UI removed
  spiralRenderMode: SpiralRenderMode;
  // Spiral mathematics — controls the radial growth curve
  spiralMath: SpiralMath;
  // Geometry / shape of each arm. 'spiral' keeps the classic look; the others
  // warp the angular mapping into nested polygons / roses / hearts.
  shape: SpiralShape;
  polygonSides: number;   // 3–12 — sides for 'polygon' / 'concentricPolygon'
  concentricTwist: number; // 0–1 — how much rings rotate relative to each other (concentricPolygon only)
  // ── Second spiral layer ───────────────────────────────────────────────────
  // An optional second spiral composited over the primary one. Its own spiral
  // visual fields live in the `secondary` sub-object so the global effect fields
  // (vignette, audio, text, tempo, hue…) are shared and not duplicated.
  secondaryEnabled: boolean;
  secondaryBlendMode: LayerBlendMode;
  secondaryOpacity: number;       // 0–100
  secondary: SecondarySpiral;
  // Random order for phrases
  randomOrder: boolean;
  // Debug panel toggle
  debugEnabled: boolean;
  // Color animation mode
  colorMode: ColorMode;
  kaleidoscopeSectors: number;
  // Framerate cap
  maxFps: number;
  // High-quality supersampling (2× offscreen render, downsampled). Device/perf
  // preference — not saved in presets, not animated by sequences.
  highQuality: boolean;
  // Inversion Pulse
  inversionEnabled: boolean;
  inversionRate: number;      // seconds between pulse starts [Min: 0.1, Default: 2.0]
  inversionDuration: number;  // seconds the inversion is held [Min: 0.05, Default: 0.08]
  inversionIntensity: number; // 0–100, maps to grey value for mix-blend-mode:difference
  rampInversionSpeed: boolean;// tie pulse rate to master speed ramp
  // Runtime-only: drives the 'inversionPulse' sequencer transition. -1 = no override
  // (normal inversion behavior); 0–100 = force the inversion overlay to this grey
  // intensity this frame, overriding the regular pulse during the transition.
  transitionInversion: number;
  // Zoom Tunnel
  zoomEnabled: boolean;
  zoomSpeed: number;          // cycles per second 0.1–10
  zoomDirection: ZoomDirection;
  zoomMin: number;            // minimum scale factor 0.25–1.0
  zoomMax: number;            // maximum scale factor 1.0–4.0
  zoomEasing: ZoomEasing;     // only used in tunnel mode
  zoomMode: ZoomMode;         // 'breathe' (sine, smooth) | 'tunnel' (sawtooth, instant reset)
  rampZoomSpeed: boolean;     // tie zoom speed to master speed ramp
  // Fragmentation
  fragmentEnabled: boolean;
  fragmentCols: number;              // 1–8 columns
  fragmentRows: number;              // 1–8 rows
  fragmentPhaseOffset: number;       // 0–360° cumulative offset per adjacent cell
  fragmentDirectionMode: FragmentDirectionMode;
  fragmentRenderMode: FragmentRenderMode;  // 'clip' | 'blend' | 'feather'
  fragmentBorderWidth: number;       // 0–20 px gap between cells (clip mode only)
  fragmentBorderColor: string;       // hex color of gap
  // Auto duty-cycle pulse
  fragmentAutoPulse: boolean;        // rhythmically toggle fragmentation on/off
  fragmentDutyCycle: number;         // 0–100 % of each cycle that fragmentation is "on"
  fragmentPulseRate: number;         // seconds per on/off cycle (when not tied to ramp)
  rampFragmentPulse: boolean;        // use master rampDuration as the pulse cycle
  // Hue Rotation
  hueRotation: number;               // 0–360° base hue offset applied to the spiral canvas
  hueRotateSpeed: number;            // degrees per second for a continuous rolling hue (0 = off)
  // Center Taper — how sharply arm width thins toward the centre (width exponent).
  // 0 = full/round core, 100 = thin/pointy core (≈ original linear taper).
  taperStrength: number;
  // Afterimage Bloom — deliberately retains a faint, decaying ghost of recent
  // frames so fast motion leaves trails. intensity controls how visible the
  // accumulated ghost is when blended back in; duration controls how long
  // (in ms) it takes to fade out.
  afterimageEnabled: boolean;
  afterimageIntensity: number;       // 0–100: opacity of the accumulated trail
  afterimageDuration: number;        // 50–2000 ms: approx. fade-out time
  afterimageHold: number;            // 0–500 ms: hold each frame this long before
                                     // capturing the next (0 = every frame; >0 gives
                                     // a stop-motion / hitched look)
  // Arm Taper
  armTaper: number;                  // 0–100%: outer fraction of each arm that fades to transparent
  // Cell Falloff (fragmentation blend mode)
  cellFalloff: number;               // 0–100: dims arm segments proportionally to distance from cell center
  // Eyes feature — two side-by-side spirals with a separation mask between them
  eyeSpread: number;                 // 0–100: how far each eye's visible region extends toward the other
  eyeSoftness: number;               // 0–100: softness of each eye's radial separation falloff
  // Vignette Overlay
  vignetteEnabled: boolean;
  vignetteIntensity: number;         // 0–100 edge opacity
  vignetteSize: number;              // 0–100 inner transparent radius as % of width
  vignetteColor: string;             // hex color of the vignette edges
  vignetteShape: VignetteShape;      // gradient shape: 'ellipse' (fits aspect) | 'circle'
  vignetteSoftness: number;          // 0–100 transition softness (low = hard ring, high = gradual)
  // ── Audio ──────────────────────────────────────────────────────────────────
  audioEnabled: boolean;            // master on/off (user-gesture-gated)
  audioVolume: number;              // 0–100, perceptual (x² curve)
  // Tone layer
  audioToneEnabled: boolean;
  audioBeatMode: AudioBeatMode;
  audioCarrierFreq: number;         // 50–800 Hz base pitch
  audioBeatFreq: number;            // 0.5–40 Hz brainwave-band beat
  audioWaveform: AudioWaveform;
  // Drone layer (harmonic enrichment)
  audioDroneEnabled: boolean;
  audioDroneInterval: AudioDroneInterval;
  audioDroneLevel: number;          // 0–100 mix
  // Noise layer (texture bed)
  audioNoiseEnabled: boolean;
  audioNoiseType: AudioNoiseType;
  audioNoiseLevel: number;          // 0–100 mix
  // Modulation (tremolo on master)
  audioTremoloRate: number;         // 0–10 Hz LFO; 0 = off
  audioTremoloDepth: number;        // 0–100 %
  // Ramp coupling
  rampAudioBeat: boolean;           // tie audioBeatFreq to the speed ramp (capped at 40 Hz)
  // ── Master Tempo ───────────────────────────────────────────────────────────
  /** Master on/off switch. When false the entire tempo system is bypassed. */
  masterTempoEnabled: boolean;
  /** Beats per minute driving the master phase clock (30–240). */
  masterTempoBpm: number;
  /** Show a pulsing corner indicator when the debug panel is also enabled. */
  masterTempoIndicator: boolean;
  /** Beats per measure for the time signature (2–16). Determines beat-offset range. */
  masterTempoBeats: number;
  // Per-system lock pairs — each system can be rate-locked to the master tempo.
  lockColorCycling: boolean;      lockColorCyclingRatio: TempoRatio;
  lockHueRotate: boolean;         lockHueRotateRatio: TempoRatio;
  // Edge-triggered locks also carry a beat-offset (1..masterTempoBeats):
  lockStrobe: boolean;            lockStrobeRatio: TempoRatio;        lockStrobeBeat: number;
  lockFragmentPulse: boolean;     lockFragmentPulseRatio: TempoRatio; lockFragmentPulseBeat: number;
  lockInversion: boolean;         lockInversionRatio: TempoRatio;     lockInversionBeat: number;
  lockText: boolean;              lockTextRatio: TempoRatio;          lockTextBeat: number;
  lockSpeedRamp: boolean;         lockSpeedRampRatio: TempoRatio;
  lockAudioTremolo: boolean;      lockAudioTremoloRatio: TempoRatio;
  lockAudioBeat: boolean;         lockAudioBeatRatio: TempoRatio;
  // Ramp epoch: performance.now() timestamp of the last sequencer start/loop.
  // Ramp calculations use (now - rampEpoch) so the sawtooth resets cleanly
  // to position 0 on each loop rather than continuing from wall-clock time.
  // Value of 0 = use absolute wall-clock time (non-sequencer behaviour).
  rampEpoch: number;
  // Sequencer
  sequencerEnabled: boolean;
  sequencerPlaying: boolean;
  sequencerLoop: boolean;
  sequenceTitle: string;
  sequencePhases: SequencePhase[];
};

export const initialState: AppState = {
  mode: 'Darken',
  bgImageEnabled: false,
  bgImageUrl: '',
  bgImageFill: 'cover',
  bgImageDim: 0,
  bgImageBlur: 0,
  arms: 6,
  turns: 3,
  curve: 4.5,
  width: 50,
  wobble: 0.1,
  wobblePhase: 0,
  wobbleSpeed: 1,
  colorCyclingSpeed: 1,
  rotationSpeed: 1,
  direction: -1,
  gradientType: 'Three',
  color1: '#ff0055',
  color2: '#00ffcc',
  color3: '#0055ff',
  textEnabled: false,
  textLines: 'Relax\\nLet go\\nFocus\\nBreathe',
  textColor: '#ffffff',
  textBg: 'rgba(0,0,0,0.5)',
  lineSpeed: 800,
  lineTime: 400,
  textSize: 1,
  textAnimation: 'fade',
  textMode: 'phrase',
  wpm: 300,
  rsvpOrp: false,
  rsvpAnchor: true,
  wallOpacity: 35,
  wallDensity: 200,
  highlightColor: '#ffdd00',
  highlightSweepSpeed: 3,
  customFontName: '',
  flashEnabled: false,
  flashColor: '#ffffff',
  flashIntensity: 50,
  intenseFlash: false,
  intenseStrobeDelay: 50,
  strobeLength: 20,
  strobeIntensity: 50,
  strobeColor1: '#ffffff',
  strobeColor2: '#ff0000',
  strobeColor3: '#0000ff',
  strobeColorCount: 2,
  pulseSpeed: false,
  pulseMin: 0.2,
  pulseMax: 1.8,
  rampDuration: 30,
  rampSpiralSpeed: false,
  rampColorSpeed: false,
  rampTextSpeed: false,
  rampStrobeSpeed: false,
  rampMode: 'sawtooth',
  centerDotEnabled: false,
  centerDotRadius: 10,
  centerDotColor: '#ffffff',
  spiralRenderMode: 'butt',
  spiralMath: 'log',
  shape: 'spiral',
  polygonSides: 5,
  concentricTwist: 0.6,
  secondaryEnabled: false,
  secondaryBlendMode: 'screen',
  secondaryOpacity: 70,
  secondary: {
    arms: 3,
    turns: 3,
    curve: 4.5,
    width: 40,
    rotationSpeed: 0.6,
    direction: 1,
    wobble: 0.1,
    wobblePhase: 0,
    wobbleSpeed: 1,
    spiralMath: 'log',
    shape: 'spiral',
    polygonSides: 5,
    concentricTwist: 0.6,
    colorMode: 'default',
    kaleidoscopeSectors: 8,
    gradientType: 'Two',
    color1: '#00ffcc',
    color2: '#0055ff',
    color3: '#ff0055',
    taperStrength: 85,
    armTaper: 0,
    ignoreRamp: false,
    afterimageEnabled: false,
    afterimageIntensity: 50,
    afterimageDuration: 300,
    afterimageHold: 0,
  },
  randomOrder: false,
  debugEnabled: false,
  colorMode: 'default',
  kaleidoscopeSectors: 8,
  maxFps: 144,
  highQuality: false,
  inversionEnabled: false,
  inversionRate: 2.0,
  inversionDuration: 0.08,
  inversionIntensity: 100,
  transitionInversion: -1,
  rampInversionSpeed: false,
  zoomEnabled: false,
  zoomSpeed: 0.4,
  zoomDirection: 'in',
  zoomMin: 1.0,
  zoomMax: 2.0,
  zoomEasing: 'ease-in',
  zoomMode: 'breathe',
  rampZoomSpeed: false,
  fragmentEnabled: false,
  fragmentCols: 2,
  fragmentRows: 1,
  fragmentPhaseOffset: 90,
  fragmentDirectionMode: 'alternating',
  fragmentRenderMode: 'blend',
  fragmentBorderWidth: 2,
  fragmentBorderColor: '#000000',
  fragmentAutoPulse: false,
  fragmentDutyCycle: 50,
  fragmentPulseRate: 4,
  rampFragmentPulse: false,
  hueRotation: 0,
  hueRotateSpeed: 0,
  taperStrength: 85,
  afterimageEnabled: false,
  afterimageIntensity: 50,
  afterimageDuration: 300,
  afterimageHold: 0,
  armTaper: 0,
  cellFalloff: 0,
  eyeSpread: 55,
  eyeSoftness: 60,
  vignetteEnabled: false,
  vignetteIntensity: 70,
  vignetteSize: 50,
  vignetteColor: '#000000',
  vignetteShape: 'ellipse',
  vignetteSoftness: 60,
  // ── Audio defaults — ready for relaxation, off until user enables ─────────
  audioEnabled: false,
  audioVolume: 35,
  audioToneEnabled: true,
  audioBeatMode: 'binaural',
  audioCarrierFreq: 220,
  audioBeatFreq: 6,
  audioWaveform: 'sine',
  audioDroneEnabled: false,
  audioDroneInterval: 'fifth',
  audioDroneLevel: 40,
  audioNoiseEnabled: false,
  audioNoiseType: 'brown',
  audioNoiseLevel: 25,
  audioTremoloRate: 0,
  audioTremoloDepth: 0,
  rampAudioBeat: false,
  // ── Master Tempo defaults ────────────────────────────────────────────────
  masterTempoEnabled: false,
  masterTempoBpm: 60,
  masterTempoIndicator: true,
  masterTempoBeats: 4,
  lockColorCycling: false,      lockColorCyclingRatio: '1',
  lockHueRotate: false,         lockHueRotateRatio: '1',
  lockStrobe: false,            lockStrobeRatio: '1',        lockStrobeBeat: 1,
  lockFragmentPulse: false,     lockFragmentPulseRatio: '1', lockFragmentPulseBeat: 1,
  lockInversion: false,         lockInversionRatio: '1',     lockInversionBeat: 1,
  lockText: false,              lockTextRatio: '1',          lockTextBeat: 1,
  lockSpeedRamp: false,         lockSpeedRampRatio: '1',
  lockAudioTremolo: false,      lockAudioTremoloRatio: '1',
  lockAudioBeat: false,         lockAudioBeatRatio: '1',
  rampEpoch: 0,
  sequencerEnabled: false,
  sequencerPlaying: false,
  sequencerLoop: true,
  sequenceTitle: 'My Sequence',
  sequencePhases: [],
};