import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { ControlsPanel } from './features/controls/ControlsPanel';
import { SpiralCanvas } from './features/spiral/SpiralCanvas';
import { InversionOverlay } from './features/effects/InversionOverlay';
import { VignetteOverlay } from './features/effects/VignetteOverlay';
import { TextOverlay } from './features/text/TextOverlay';
import { WarningModal } from './features/modal/WarningModal';
import { useAudio } from './features/audio/useAudio';
import { usePersistentState } from './utils/hooks';
import { AppState, initialState, TransitionType } from './types';
import { applyMasterTempo } from './utils/tempo';
import { isPhaseSetting } from './utils/fields';

/* ── field categories for interpolation ───────────────────────── */

/** Parameters that change smoothly during transitions */
const MOTION_FIELDS: (keyof AppState)[] = [
  'turns', 'curve', 'width', 'wobble', 'wobblePhase', 'wobbleSpeed',
  'colorCyclingSpeed', 'rotationSpeed', 'lineSpeed', 'lineTime', 'textSize',
  'flashIntensity', 'intenseStrobeDelay', 'strobeLength', 'strobeIntensity',
  'pulseMin', 'pulseMax', 'rampDuration', 'centerDotRadius',
  // Inversion Pulse
  'inversionRate', 'inversionDuration', 'inversionIntensity',
  // Zoom Tunnel (archived — fields kept for saved-state compat)
  // 'zoomSpeed', 'zoomMin', 'zoomMax',
  // Fragmentation
  'fragmentPhaseOffset', 'fragmentBorderWidth', 'fragmentDutyCycle', 'fragmentPulseRate',
  // Hue Rotation, Arm Taper, Cell Falloff & Vignette
  'hueRotation', 'hueRotateSpeed', 'taperStrength', 'armTaper', 'cellFalloff', 'eyeSpread', 'eyeSoftness', 'vignetteIntensity', 'vignetteSize', 'vignetteSoftness',
  // Afterimage Bloom
  'afterimageIntensity', 'afterimageDuration',
  // Audio (continuous params)
  'audioVolume', 'audioCarrierFreq', 'audioBeatFreq', 'audioDroneLevel',
  'audioNoiseLevel', 'audioTremoloRate', 'audioTremoloDepth',
  // Master Tempo
  'masterTempoBpm',
];

/** Discrete fields that must snap at end-of-transition, never lerp */
const STRUCTURE_FIELDS: (keyof AppState)[] = [
  'arms', 'direction', 'gradientType', 'textAnimation', 'mode',
  'spiralRenderMode', 'spiralMath', 'colorMode', 'kaleidoscopeSectors', 'strobeColorCount',
  'rampMode',
  // Zoom Tunnel (archived)
  // 'zoomDirection', 'zoomEasing', 'zoomMode',
  // Fragmentation
  'fragmentCols', 'fragmentRows', 'fragmentDirectionMode', 'fragmentRenderMode',
  // Vignette (shape is discrete)
  'vignetteShape',
  // Audio (discrete enum-like fields)
  'audioBeatMode', 'audioWaveform', 'audioDroneInterval', 'audioNoiseType',
  // Master Tempo ratios + beat offsets (snap at transition end)
  'lockColorCyclingRatio', 'lockHueRotateRatio', 'lockStrobeRatio',
  'lockFragmentPulseRatio', 'lockInversionRatio', 'lockTextRatio',
  'lockSpeedRampRatio', 'lockAudioTremoloRatio', 'lockAudioBeatRatio',
  'masterTempoBeats',
  'lockStrobeBeat', 'lockFragmentPulseBeat', 'lockInversionBeat', 'lockTextBeat',
];

/** Boolean / meta fields that must snap instantly */
const SNAP_FIELDS: (keyof AppState)[] = [
  'textEnabled', 'flashEnabled', 'intenseFlash', 'pulseSpeed',
  'rampSpiralSpeed', 'rampColorSpeed', 'rampTextSpeed', 'rampStrobeSpeed',
  'centerDotEnabled', 'randomOrder', 'afterimageEnabled',
  'sequencerEnabled', 'sequencerPlaying', 'sequencerLoop',
  // Inversion Pulse
  'inversionEnabled', 'rampInversionSpeed',
  // Zoom Tunnel (archived)
  // 'zoomEnabled', 'rampZoomSpeed',
  // Fragmentation
  'fragmentEnabled', 'fragmentAutoPulse', 'rampFragmentPulse',
  // Vignette
  'vignetteEnabled',
  // Audio (booleans)
  'audioEnabled', 'audioToneEnabled', 'audioDroneEnabled', 'audioNoiseEnabled',
  'rampAudioBeat',
  // Master Tempo (booleans snap instantly)
  'masterTempoEnabled', 'masterTempoIndicator',
  'lockColorCycling', 'lockHueRotate', 'lockStrobe', 'lockFragmentPulse',
  'lockInversion', 'lockText', 'lockSpeedRamp', 'lockAudioTremolo', 'lockAudioBeat',
];

/** Colour hex fields that are lerped */
const COLOR_FIELDS: (keyof AppState)[] = [
  'color1', 'color2', 'color3', 'textColor', 'flashColor',
  'centerDotColor', 'strobeColor1', 'strobeColor2', 'strobeColor3',
  'fragmentBorderColor',
  // Vignette
  'vignetteColor',
];

/* ── easing helpers ─────────────────────────────────────────────── */

const easeLinear = (t: number) => t;
const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Sine overshoot that peaks ~12% past target then settles */
const easeOvershoot = (t: number) => {
  if (t >= 1) return 1;
  return t + 0.12 * Math.sin(t * Math.PI * 2);
};

const lerpNum = (a: number, b: number, t: number) => a + (b - a) * t;

const lerpColor = (from: string, to: string, t: number): string => {
  const parse = (hex: string) => {
    const s = hex.replace('#', '');
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const r = Math.round(lerpNum(r1, r2, t));
  const g = Math.round(lerpNum(g1, g2, t));
  const b = Math.round(lerpNum(b1, b2, t));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

/* ── component ────────────────────────────────────────────────── */

function App() {
  const [state, setState, loaded] = usePersistentState<AppState>('hypno-spiral-state', initialState);
  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState(-1);
  // Phase-edit mode: index of the phase being edited, or null for the base preset.
  const [editingPhaseIndex, setEditingPhaseIndex] = useState<number | null>(null);

  const phaseTimerRef = useRef<number | undefined>(undefined);
  const transitionRAFRef = useRef<number | undefined>(undefined);
  const activeRef = useRef(true);
  // prevSnapshotRef stores the full AppState applied at the end of each phase,
  // used only as the interpolation start point for the next transition.
  const prevSnapshotRef = useRef<AppState | null>(null);

  const updateState = useCallback((partial: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...partial }));
  }, [setState]);

  // Exit phase-edit if the phase disappears (deleted) or playback starts.
  useEffect(() => {
    if (editingPhaseIndex === null) return;
    if (state.sequencerPlaying || editingPhaseIndex >= state.sequencePhases.length) {
      setEditingPhaseIndex(null);
    }
  }, [editingPhaseIndex, state.sequencerPlaying, state.sequencePhases.length]);

  // The phase currently being edited (if any).
  const editingPhase = editingPhaseIndex !== null ? state.sequencePhases[editingPhaseIndex] : undefined;

  // While editing a phase, the canvas + controls preview that phase by merging
  // its settings over the base state (base-only/global fields stay from base).
  // The base preset's own visual fields are never overwritten.
  const effectiveState: AppState = editingPhase
    ? { ...state, ...editingPhase.settings }
    : state;

  // Updates from the Controls panel are routed: while editing a phase, fields
  // that belong to a phase are written into that phase's `settings`; everything
  // else (base-only/global) writes to the top-level base state.
  const updateStateRouted = useCallback((partial: Partial<AppState>) => {
    if (editingPhaseIndex === null) { updateState(partial); return; }
    const idx = editingPhaseIndex;
    setState(prev => {
      const phase = prev.sequencePhases[idx];
      if (!phase) return { ...prev, ...partial };
      const phasePart: Record<string, unknown> = {};
      const basePart: Record<string, unknown> = {};
      (Object.keys(partial) as (keyof AppState)[]).forEach(k => {
        if (isPhaseSetting(k)) phasePart[k] = (partial as Record<string, unknown>)[k];
        else basePart[k] = (partial as Record<string, unknown>)[k];
      });
      const phases = [...prev.sequencePhases];
      phases[idx] = { ...phase, settings: { ...phase.settings, ...phasePart } };
      return { ...prev, ...basePart, sequencePhases: phases };
    });
  }, [editingPhaseIndex, updateState, setState]);

  // Derive rate-locked state. All rendering/effect components receive this
  // (built from the effective/preview state so phase edits show live).
  const derivedState = applyMasterTempo(effectiveState);

  // Audio engine — boots on state.audioEnabled, tears down on disable/unmount
  useAudio(derivedState);

  const toggleSidebar = () => setSidebarOpen(v => !v);

  /* ── keyboard shortcuts ─────────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      // Don't fire shortcuts when typing in an input/textarea/select
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          // Only toggle play if the sequencer is enabled and has phases
          setState(prev => {
            if (!prev.sequencerEnabled || prev.sequencePhases.length === 0) return prev;
            return { ...prev, sequencerPlaying: !prev.sequencerPlaying };
          });
          break;
        case 'Escape':
          setSidebarOpen(false);
          break;
        case 'f':
        case 'F':
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── sequencer effect ───────────────────────────────────────── */
  useEffect(() => {
    activeRef.current = true;

    if (!state.sequencerPlaying || state.sequencePhases.length === 0) {
      setCurrentPhaseIdx(-1);
      prevSnapshotRef.current = null;
      return;
    }

    const advancePhase = (idx: number) => {
      if (!activeRef.current) return;

      if (idx >= state.sequencePhases.length) {
        if (state.sequencerLoop) {
          setCurrentPhaseIdx(0);
          updateState({ rampEpoch: performance.now() }); // reset sawtooth to position 0
          // Reset the snapshot ref so phase 0 expands its delta against initialState
          // again (matching first-play behavior). Without this, toggles enabled by
          // the last phase (inversion, fragmentation, etc.) leak into phase 0 because
          // its delta only contains explicit changes — anything left at default in
          // phase 0 would otherwise inherit from the previous phase's state.
          prevSnapshotRef.current = null;
          advancePhase(0);
        } else {
          updateState({ sequencerPlaying: false });
          setCurrentPhaseIdx(-1);
          prevSnapshotRef.current = null;
        }
        return;
      }

      const phase = state.sequencePhases[idx];
      setCurrentPhaseIdx(idx);

      const startHold = () => {
        phaseTimerRef.current = window.setTimeout(() => {
          advancePhase(idx + 1);
        }, phase.duration * 1000);
      };

      try {
        // Phases are fully-explicit settings objects (no deltas, no escaped JSON).
        const settings = (phase.settings ?? {}) as Partial<AppState>;

        // Fields that must never be overwritten by a phase: sequencer metadata,
        // the ramp epoch, and the base-only fields (maxFps, highQuality,
        // debugEnabled) which are set once at the base level, never per phase.
        const PROTECTED: Set<keyof AppState> = new Set([
          'sequencePhases', 'sequenceTitle', 'sequencerEnabled',
          'sequencerPlaying', 'sequencerLoop', 'rampEpoch',
          'maxFps', 'highQuality', 'debugEnabled',
        ]);

        // fromState — interpolation start (current visuals for phase 0, the
        // previous phase's full state afterwards).
        const fromState = prevSnapshotRef.current ?? state;
        // toState — the explicit target. Phases are fully explicit, so we layer
        // them onto initialState (fills any field a phase happens to omit), then
        // strip protected fields so playback can't clobber base/sequencer state.
        const toState = { ...initialState, ...settings } as AppState;
        for (const key of PROTECTED) delete (toState as any)[key];

        const transitionType: TransitionType = phase.transitionType || 'linear';
        const transitionMs = Math.max(0, (phase.transitionDuration || 0) * 1000);

        // No transition → snap instantly and hold
        if (transitionMs <= 0) {
          updateState(toState);
          prevSnapshotRef.current = toState;
          startHold();
          return;
        }

        // Build snap payload (structure + booleans) — applied at end of transition
        const snapPayload: Partial<AppState> = {};
        for (const key of STRUCTURE_FIELDS) {
          // @ts-ignore
          if (key in toState && !PROTECTED.has(key)) snapPayload[key] = toState[key];
        }
        for (const key of SNAP_FIELDS) {
          // @ts-ignore
          if (key in toState && !PROTECTED.has(key)) snapPayload[key] = toState[key];
        }

        // Visual / audio boolean toggles applied immediately at phase start so
        // they take effect during the transition rather than waiting until it
        // completes. Booleans can't be lerped, so deferring them produces a
        // visible lag where (e.g.) inversion stays on for the full transition
        // duration even after a phase says it should be off.
        const IMMEDIATE_FIELDS: (keyof AppState)[] = [
          // Spiral / motion
          'pulseSpeed',
          'rampSpiralSpeed', 'rampColorSpeed', 'rampTextSpeed', 'rampStrobeSpeed',
          'rampInversionSpeed', 'rampFragmentPulse', 'rampAudioBeat',
          // Text & flash
          'textEnabled', 'flashEnabled', 'randomOrder',
          // Strobe
          'intenseFlash',
          // Inversion
          'inversionEnabled',
          // Fragmentation
          'fragmentEnabled', 'fragmentAutoPulse',
          // Vignette
          'vignetteEnabled',
          // Center dot
          'centerDotEnabled',
          // Audio
          'audioEnabled', 'audioToneEnabled', 'audioDroneEnabled', 'audioNoiseEnabled',
          // Master Tempo (booleans)
          'masterTempoEnabled', 'masterTempoIndicator',
          'lockColorCycling', 'lockHueRotate', 'lockStrobe', 'lockFragmentPulse',
          'lockInversion', 'lockText', 'lockSpeedRamp', 'lockAudioTremolo', 'lockAudioBeat',
        ];
        const immediateSnap: Partial<AppState> = {};
        for (const key of IMMEDIATE_FIELDS) {
          // @ts-ignore
          if (key in toState) immediateSnap[key] = toState[key];
        }
        // Fragment transition: enable grid immediately so it appears during transition
        if (transitionType === 'fragment') {
          immediateSnap.fragmentEnabled = true;
          if ('fragmentCols' in toState) immediateSnap.fragmentCols = toState.fragmentCols;
          if ('fragmentRows' in toState) immediateSnap.fragmentRows = toState.fragmentRows;
          if ('fragmentDirectionMode' in toState) immediateSnap.fragmentDirectionMode = toState.fragmentDirectionMode;
        }

        updateState(immediateSnap);

        const startTime = performance.now();

        // 'inversionPulse' transition: accumulate a pulse phase whose half-period
        // (on-time = off-time) scales from 500ms at the start of the transition
        // down to 50ms at the end, so the inversion flashes faster and faster.
        let invPulsePhase = 0;
        let invLastFrame  = startTime;

        const animateTransition = () => {
          if (!activeRef.current) return;
          const now = performance.now();
          const elapsed = now - startTime;
          const raw = Math.min(elapsed / transitionMs, 1);

          // Ease the progress value itself
          let eased: number;
          switch (transitionType) {
            case 'linear':
              eased = easeLinear(raw);
              break;
            case 'ease':
              eased = easeInOut(raw);
              break;
            case 'pulse':
              eased = easeOvershoot(raw);
              break;
            case 'spinBurst':
              eased = easeInOut(raw); // spinBurst = ease + extra rotation surge
              break;
            case 'fragment':
              eased = easeInOut(raw); // fragment = ease + grid surge overlay
              break;
            case 'inversionPulse':
              eased = easeInOut(raw); // inversionPulse = ease + accelerating invert flash
              break;
            default:
              eased = raw;
          }

          const interpolated: Partial<AppState> = {};

          // Motion fields
          for (const key of MOTION_FIELDS) {
            const a = (fromState[key] as number) ?? 0;
            const b = (toState[key] as number) ?? 0;
            (interpolated as any)[key] = lerpNum(a, b, eased);
          }

          // Color fields — fall back to fromState if toState omits a color key,
          // so a missing field in a snapshot inherits the previous phase's value
          // rather than crashing lerpColor with undefined.
          for (const key of COLOR_FIELDS) {
            const a = (fromState[key] as string) ?? (initialState[key] as string);
            const b = (toState[key] as string) ?? a;
            (interpolated as any)[key] = lerpColor(a, b, eased);
          }

          // SpinBurst: extra rotation speed surge
          if (transitionType === 'spinBurst') {
            const surge = 1 + 3 * Math.sin(Math.PI * raw); // peaks at 4x at midpoint
            interpolated.rotationSpeed = ((interpolated.rotationSpeed ?? toState.rotationSpeed) as number) * surge;
          }

          // Fragment: force grid on and surge phase offset during transition
          if (transitionType === 'fragment') {
            const fragSurge = Math.sin(Math.PI * raw); // bell 0→1→0
            interpolated.fragmentEnabled = true;
            // Use target cols/rows during the transition
            interpolated.fragmentCols = (toState as any).fragmentCols ?? (fromState as any).fragmentCols ?? 2;
            interpolated.fragmentRows = (toState as any).fragmentRows ?? (fromState as any).fragmentRows ?? 2;
            // Phase offset surges by up to +270° extra at peak, settled at lerped target
            const baseOffset = lerpNum(
              ((fromState as any).fragmentPhaseOffset ?? 90) as number,
              ((toState as any).fragmentPhaseOffset ?? 90) as number,
              eased
            );
            interpolated.fragmentPhaseOffset = baseOffset + 270 * fragSurge;
          }

          // Inversion Pulse: override the inversion overlay with a pulse whose
          // half-period scales 500ms → 50ms across the transition, then release.
          if (transitionType === 'inversionPulse') {
            const halfPeriod = 500 + (50 - 500) * raw;          // ms, on == off
            const dt = now - invLastFrame;
            invLastFrame = now;
            invPulsePhase += dt / (2 * halfPeriod);             // 1 cycle = on + off
            const on = (invPulsePhase % 1) < 0.5;
            interpolated.transitionInversion = on ? 100 : 0;    // 0 = override-but-off
          }

          // Text lines always snap
          if ('textLines' in toState) interpolated.textLines = toState.textLines;

          updateState(interpolated);

          if (raw < 1) {
            transitionRAFRef.current = requestAnimationFrame(animateTransition);
          } else {
            // Snap all discrete fields at end, keep continuous ones exact
            // For 'fragment' transitions: ensure fragmentEnabled resolves to the target
            // value (default false) so the grid doesn't stay on if the target didn't ask for it
            if (transitionType === 'fragment') {
              snapPayload.fragmentEnabled = (toState as any).fragmentEnabled ?? false;
            }
            updateState({ ...toState, ...snapPayload });
            prevSnapshotRef.current = toState;
            startHold();
          }
        };

        transitionRAFRef.current = requestAnimationFrame(animateTransition);
      } catch (e) {
        console.error('Failed to apply phase snapshot', e);
        startHold();
      }
    };

    updateState({ rampEpoch: performance.now() }); // reset sawtooth on sequence start
    advancePhase(0);

    return () => {
      activeRef.current = false;
      if (phaseTimerRef.current !== undefined) window.clearTimeout(phaseTimerRef.current);
      if (transitionRAFRef.current !== undefined) cancelAnimationFrame(transitionRAFRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sequencerPlaying, state.sequencePhases, state.sequencerLoop]);

  if (!loaded) {
    return <div className="loading-screen">Waking up...</div>;
  }

  const showBeatIndicator =
    state.debugEnabled &&
    state.masterTempoEnabled &&
    state.masterTempoIndicator;

  return (
    <>
    <WarningModal />
    <div className={`app-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <MemoControlsPanel
        state={effectiveState}
        updateState={updateStateRouted}
        isOpen={isSidebarOpen}
        toggle={toggleSidebar}
        currentPhaseIdx={currentPhaseIdx}
        editingPhaseIndex={editingPhaseIndex}
        onEditPhase={(i) => setEditingPhaseIndex(i)}
        onExitPhaseEdit={() => setEditingPhaseIndex(null)}
      />
      <main className="main-view">
        <SpiralCanvas state={derivedState} />
        <VignetteOverlay state={derivedState} />
        <InversionOverlay state={derivedState} />
        <TextOverlay state={derivedState} />
        {showBeatIndicator && (
          <div
            className="beat-corner-indicator"
            style={{ animationDuration: `${60 / state.masterTempoBpm}s` }}
            title={`Master tempo: ${state.masterTempoBpm} BPM`}
          />
        )}
        {!isSidebarOpen && (
          <button className="fab-open" onClick={toggleSidebar} aria-label="Open Settings">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
        )}
      </main>
    </div>
    </>
  );
}

/* Memoised panel: only re-render when identity-level props change */
const MemoControlsPanel = React.memo(ControlsPanel, (prev, next) => {
  return (
    prev.isOpen === next.isOpen &&
    prev.currentPhaseIdx === next.currentPhaseIdx &&
    prev.editingPhaseIndex === next.editingPhaseIndex &&
    prev.state === next.state
  );
});

export default App;
