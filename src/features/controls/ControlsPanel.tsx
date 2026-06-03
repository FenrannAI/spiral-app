import React, { useState, useEffect, useRef } from 'react';
import './ControlsPanel.css';
import {
  AppState, TransitionType, SequencePhase, initialState,
  FragmentDirectionMode,
  SpiralMath, RampMode, ColorMode, TextAnimation, VignetteShape,
  AudioBeatMode, AudioWaveform, AudioDroneInterval, AudioNoiseType,
  TempoRatio,
} from '../../types';
import { freqToNote, beatToBand } from '../../utils/audio';
import { TEMPO_RATIOS, ratioLabel, tempoPeriodSec, tempoRateHz } from '../../utils/tempo';
import { debugStore } from '../../utils/debugStore';

interface Props {
  state: AppState;
  updateState: (partial: Partial<AppState>) => void;
  isOpen: boolean;
  toggle: () => void;
  currentPhaseIdx: number;
}

/* ── Slider with inline numeric input ───────────────────────── */

const Slider = ({ label, value, min, max, step, onChange, unit = "" }: {
  label: string; value: number; min: number; max: number;
  step: number; onChange: (v: number) => void; unit?: string;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const precision = (step < 1 && step !== 0) ? 2 : 0;
  const displayVal = precision > 0 ? value.toFixed(precision) : Math.round(value).toString();

  const commit = (raw: string) => {
    setEditing(false);
    const n = parseFloat(raw);
    if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
  };

  return (
    <div className="control-item">
      <div className="control-item-header">
        <span>{label}</span>
        <div className="slider-num-wrap">
          <input
            type="number"
            className="slider-num-input"
            value={editing ? draft : displayVal}
            min={min} max={max} step={step}
            onFocus={() => { setEditing(true); setDraft(displayVal); }}
            onChange={e => setDraft(e.target.value)}
            onBlur={e => commit(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
              if (e.key === 'Escape') { setEditing(false); (e.target as HTMLInputElement).blur(); }
            }}
          />
          {unit && <span className="slider-unit">{unit}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
};

/* ── Group title with optional reset button ─────────────────── */

const GroupTitle = ({
  title,
  onReset,
  color,
}: { title: string; onReset?: () => void; color?: string }) => (
  <div className="control-group-title-row">
    <span className="control-group-title" style={color ? { color } : undefined}>{title}</span>
    {onReset && (
      <button
        className="group-reset-btn"
        onClick={onReset}
        title={`Reset "${title}" to defaults`}
      >
        ↺
      </button>
    )}
  </div>
);

/* ── Render mode descriptions (kept for reference; UI removed) ──
const renderModeDescriptions: Record<SpiralRenderMode, string> = {
  'standard': 'Original segment drawing with round caps. May show bright dots at segment joints.',
  'butt': 'Flat caps eliminate overlapping endpoints. Clean and crisp — best performance and visual quality.',
  'soft': 'Slight transparency blends overlapping caps together, reducing visible dots.',
  'smooth': 'Filled polygon strips per arm. Completely gap-free rendering. Recommended for the best visual quality.',
};
── */

const transitionOptions: { value: SequencePhase['transitionType']; label: string; desc: string }[] = [
  { value: 'linear',    label: 'Linear',            desc: 'Constant speed interpolation between states.' },
  { value: 'ease',      label: 'Ease In/Out',        desc: 'Slow-fast-slow easing for organic feel.' },
  { value: 'pulse',     label: 'Pulse (Overshoot)',  desc: 'Overshoots target then settles back.' },
  { value: 'spinBurst', label: 'Spin Burst',         desc: 'Accelerated spin at midpoint of transition.' },
  { value: 'fragment',  label: 'Fragment Burst',     desc: 'Spiral splits into a grid and rejoins at the endpoint.' },
];

/* ── Keyboard shortcut help ─────────────────────────────────── */

const SHORTCUTS = [
  { key: 'Space', desc: 'Play / pause sequencer' },
  { key: 'F',     desc: 'Toggle fullscreen' },
  { key: 'Esc',   desc: 'Close sidebar' },
  { key: '?',     desc: 'Show / hide shortcuts' },
];

/* ── Helper: reset a set of keys from initialState ─────────── */

function makeReset(keys: (keyof AppState)[], updateState: (p: Partial<AppState>) => void) {
  return () => {
    const patch: Partial<AppState> = {};
    for (const k of keys) (patch as any)[k] = (initialState as any)[k];
    updateState(patch);
  };
}

/* ── Module-level constants ─────────────────────────────────── */

/**
 * Fields that are never meaningful to export (preset or sequence):
 * runtime-only, archived/no-op, or developer-only.
 */
const EXPORT_SKIP = new Set<keyof AppState>([
  'sequencerPlaying',
  'rampEpoch',
  'debugEnabled',
  'textBg',
  'spiralRenderMode',
  // Archived zoom tunnel — no runtime effect
  'zoomEnabled', 'zoomSpeed', 'zoomDirection',
  'zoomMin', 'zoomMax', 'zoomEasing', 'zoomMode', 'rampZoomSpeed',
]);

/** Sequencer metadata — excluded from visual preset exports unless phases exist. */
const SEQUENCER_FIELDS = new Set<keyof AppState>([
  'sequencerEnabled', 'sequencerPlaying', 'sequencerLoop',
  'sequenceTitle', 'sequencePhases',
]);

/* ── Main component ─────────────────────────────────────────── */

export const ControlsPanel: React.FC<Props> = ({ state, updateState, isOpen, toggle, currentPhaseIdx }) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'sequencer' | 'data' | 'debug'>('settings');
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [copyDeltaFeedback, setCopyDeltaFeedback] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  /* ── Export / import helpers ──────────────────────────────── */

  /** Build a minimal delta preset — only fields that differ from defaults. */
  const buildExportDelta = (): Record<string, unknown> => {
    const delta: Record<string, unknown> = {};
    const hasPhases = state.sequencePhases.length > 0;
    (Object.keys(state) as (keyof AppState)[]).forEach(key => {
      if (EXPORT_SKIP.has(key)) return;
      // Only include sequencer fields when there are actual phases
      if (SEQUENCER_FIELDS.has(key) && !hasPhases) return;
      if (JSON.stringify(state[key]) !== JSON.stringify(initialState[key])) {
        delta[key] = state[key];
      }
    });
    return delta;
  };

  const handleCopyDelta = () => {
    const text = JSON.stringify(buildExportDelta());
    navigator.clipboard.writeText(text).then(() => {
      setCopyDeltaFeedback(true);
      setTimeout(() => setCopyDeltaFeedback(false), 2000);
    }).catch(() => {});
  };

  const [docViewer, setDocViewer] = useState<string | null>(null);
  const [docContent, setDocContent] = useState<string>('');

  const [debugValues, setDebugValues] = useState({ ...debugStore });
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    if (activeTab !== 'debug') {
      cancelAnimationFrame(animFrameRef.current);
      return;
    }
    const poll = () => {
      setDebugValues({ ...debugStore });
      animFrameRef.current = requestAnimationFrame(poll);
    };
    animFrameRef.current = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [activeTab]);

  const exportString = JSON.stringify(buildExportDelta(), null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(exportString).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    }).catch(() => {
      // Fallback for browsers that block clipboard outside a user gesture
      const textarea = document.getElementById('preset-export') as HTMLTextAreaElement;
      if (textarea) {
        textarea.select();
        textarea.setSelectionRange(0, 99999);
        document.execCommand('copy');
      }
    });
  };

  const handleImport = () => {
    if (!importText.trim()) { setImportStatus('error'); return; }
    try {
      const json = JSON.parse(importText.trim());
      if (typeof json !== 'object' || json === null || Array.isArray(json)) {
        setImportStatus('error'); return;
      }
      if (Array.isArray(json.sequencePhases) && json.sequencePhases.length > 0) {
        const firstPhase = json.sequencePhases[0];
        if (typeof firstPhase?.snapshot !== 'string') throw new Error('Phase 1 missing snapshot.');
        JSON.parse(firstPhase.snapshot); // validate it's parseable JSON
      }
      updateState({ ...initialState, ...json });
      setImportStatus('success');
      setImportText('');
      setTimeout(() => setImportStatus('idle'), 2500);
    } catch {
      setImportStatus('error');
    }
  };

  const handleReset = () => {
    if (confirm('Reset ALL settings to defaults?')) updateState(initialState);
  };

  /* ── Sequencer helpers ────────────────────────────────────── */

  /**
   * Capture a delta snapshot of the current visual state.
   *
   * Phase 1 is diffed against initialState; each subsequent phase is diffed
   * against the fully-expanded state of all preceding phases. This keeps
   * snapshots minimal — only fields that actually changed are stored.
   */
  const captureSnapshot = (s: AppState): string => {
    // Reconstruct the cumulative full state of the last existing phase
    // by layering each phase's delta onto initialState in order.
    let baseline: AppState = initialState;
    for (const phase of s.sequencePhases) {
      try {
        const delta = JSON.parse(phase.snapshot) as Partial<AppState>;
        baseline = { ...baseline, ...delta };
      } catch { /* malformed phase — skip */ }
    }

    // Diff current visual state against baseline; skip non-visual fields
    const delta: Record<string, unknown> = {};
    (Object.keys(s) as (keyof AppState)[]).forEach(key => {
      if (EXPORT_SKIP.has(key) || SEQUENCER_FIELDS.has(key)) return;
      if (JSON.stringify(s[key]) !== JSON.stringify(baseline[key])) {
        delta[key] = s[key];
      }
    });
    return JSON.stringify(delta);
  };

  const generateId = (): string => {
    try { return crypto.randomUUID(); }
    catch { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  };

  const handleAddPhase = () => {
    const snapshot = captureSnapshot(state);
    const newPhase: SequencePhase = {
      id: generateId(),
      title: `Phase ${state.sequencePhases.length + 1}`,
      duration: 10,
      snapshot,
      transitionType: 'linear',
      transitionDuration: 2,
    };
    updateState({ sequencePhases: [...state.sequencePhases, newPhase] });
  };

  const handleMovePhase = (index: number, direction: -1 | 1) => {
    const phases = [...state.sequencePhases];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= phases.length) return;
    [phases[index], phases[newIndex]] = [phases[newIndex], phases[index]];
    updateState({ sequencePhases: phases });
  };

  const handleUpdatePhase = (index: number, partial: Partial<SequencePhase>) => {
    const phases = [...state.sequencePhases];
    phases[index] = { ...phases[index], ...partial };
    updateState({ sequencePhases: phases });
  };

  const handleDeletePhase = (index: number) => {
    const phases = [...state.sequencePhases];
    phases.splice(index, 1);
    updateState({ sequencePhases: phases });
  };

  const handlePlaySequence = () => {
    updateState({ sequencerPlaying: !state.sequencerPlaying });
  };

  const totalSequenceDuration = state.sequencePhases.reduce((sum, p) => sum + p.duration, 0);
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  // renderModeOptions removed — spiral render mode UI replaced by spiralMath dropdown

  /* ── Per-group resets ─────────────────────────────────────── */

  const resetVisuals    = makeReset(['mode','arms','turns','curve','width','spiralMath','maxFps','armTaper','cellFalloff'], updateState);
  const resetCenterDot  = makeReset(['centerDotEnabled','centerDotRadius','centerDotColor'], updateState);
  const resetMotion     = makeReset(['rotationSpeed','direction','wobble','wobblePhase','wobbleSpeed'], updateState);
  const resetZoom       = makeReset(['zoomEnabled','zoomSpeed','zoomDirection','zoomMin','zoomMax','zoomEasing','zoomMode','rampZoomSpeed'], updateState);
  const resetFragment   = makeReset([
    'fragmentEnabled','fragmentPhaseOffset','fragmentDirectionMode',
    'eyeSpread','eyeSoftness',
  ], updateState);
  const resetColors     = makeReset(['colorMode','kaleidoscopeSectors','gradientType','color1','color2','color3','colorCyclingSpeed','hueRotation','hueRotateSpeed'], updateState);
  const resetVignette   = makeReset(['vignetteEnabled','vignetteIntensity','vignetteSize','vignetteColor','vignetteShape','vignetteSoftness'], updateState);
  const resetAudio      = makeReset([
    'audioEnabled','audioVolume','audioToneEnabled','audioBeatMode','audioCarrierFreq',
    'audioBeatFreq','audioWaveform','audioDroneEnabled','audioDroneInterval','audioDroneLevel',
    'audioNoiseEnabled','audioNoiseType','audioNoiseLevel','audioTremoloRate','audioTremoloDepth',
    'rampAudioBeat',
  ], updateState);
  const resetSubliminal = makeReset([
    'textEnabled','textLines','textColor','randomOrder',
    'flashEnabled','flashColor','flashIntensity',
    'lineSpeed','lineTime','textSize','textAnimation',
  ], updateState);
  const resetStrobe     = makeReset(['intenseFlash','intenseStrobeDelay','strobeLength','strobeIntensity','strobeColorCount','strobeColor1','strobeColor2','strobeColor3'], updateState);
  const resetInversion  = makeReset(['inversionEnabled','inversionRate','inversionDuration','inversionIntensity','rampInversionSpeed'], updateState);
  const resetMasterTempo = makeReset([
    'masterTempoEnabled','masterTempoBpm','masterTempoIndicator','masterTempoBeats',
    'lockColorCycling','lockColorCyclingRatio',
    'lockHueRotate','lockHueRotateRatio',
    'lockStrobe','lockStrobeRatio','lockStrobeBeat',
    'lockFragmentPulse','lockFragmentPulseRatio','lockFragmentPulseBeat',
    'lockInversion','lockInversionRatio','lockInversionBeat',
    'lockText','lockTextRatio','lockTextBeat',
    'lockSpeedRamp','lockSpeedRampRatio',
    'lockAudioTremolo','lockAudioTremoloRatio',
    'lockAudioBeat','lockAudioBeatRatio',
  ], updateState);
  const resetSpeedRamp  = makeReset([
    'pulseSpeed','rampMode','pulseMin','pulseMax','rampDuration',
    'rampSpiralSpeed','rampColorSpeed','rampTextSpeed','rampStrobeSpeed',
    'rampInversionSpeed','rampZoomSpeed','rampFragmentPulse','rampAudioBeat',
  ], updateState);

  /* ── Tap Tempo ────────────────────────────────────────────── */
  const tapTimestampsRef  = useRef<number[]>([]);
  const tapResetTimerRef  = useRef<number | undefined>(undefined);

  const handleTapTempo = () => {
    const now = performance.now();
    window.clearTimeout(tapResetTimerRef.current);

    tapTimestampsRef.current.push(now);
    if (tapTimestampsRef.current.length > 8) tapTimestampsRef.current.shift();

    if (tapTimestampsRef.current.length >= 2) {
      const taps = tapTimestampsRef.current;
      const intervals: number[] = [];
      for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1]);
      const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const bpm = Math.round(60000 / avgMs);
      updateState({ masterTempoBpm: Math.max(30, Math.min(240, bpm)) });
    }

    // Reset tap buffer after 3 s of inactivity
    tapResetTimerRef.current = window.setTimeout(() => {
      tapTimestampsRef.current = [];
    }, 3000);
  };

  /* ── Tempo lock badge (shown on affected native sliders) ──── */

  const TempoLockBadge = ({ locked, ratio, derivedValue }: {
    locked: boolean; ratio: TempoRatio; derivedValue: string;
  }) => {
    if (!locked || !state.masterTempoEnabled) return null;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        marginTop: '4px', padding: '3px 8px', borderRadius: '5px',
        background: 'rgba(255,221,87,0.1)', border: '1px solid rgba(255,221,87,0.3)',
        fontSize: '0.72rem', color: '#ffdd57',
      }}>
        🔒 Tempo locked · {ratioLabel(ratio)} · <span style={{ color: '#fff', fontWeight: 600 }}>{derivedValue}</span>
      </div>
    );
  };

  /* ── Debug sub-components ─────────────────────────────────── */

  const DebugRow = ({ label, value, suffix = "", decimals = 3 }: {
    label: string; value: any; suffix?: string; decimals?: number;
  }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.78rem' }}>
      <span style={{ color: '#888' }}>{label}</span>
      <span style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: '#e0e0e0' }}>
        {typeof value === 'number' ? value.toFixed(decimals) : String(value)}{suffix}
      </span>
    </div>
  );

  const DebugPill = ({ label, active }: { label: string; active: boolean }) => (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '0.72rem',
      fontWeight: 600, marginRight: '4px', marginBottom: '4px',
      background: active ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)',
      color: active ? '#4ade80' : '#555',
      border: `1px solid ${active ? '#4ade8050' : '#333'}`,
    }}>{label}</span>
  );

  // Format session time as HH:MM:SS.x
  const formatClock = (secs: number) => {
    const h  = Math.floor(secs / 3600);
    const m  = Math.floor((secs % 3600) / 60);
    const s  = Math.floor(secs % 60);
    const ds = Math.floor((secs % 1) * 10);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${ds}`;
  };

  /* ── Render ───────────────────────────────────────────────── */

  return (
    <aside className={`controls-panel ${isOpen ? 'open' : 'closed'}`}>
      {/* ── Header ── */}
      <div className="controls-header">
        <span>HypnoViz</span>
        <div className="header-actions">
          <button
            className="header-icon-btn"
            onClick={() => setShowShortcuts(v => !v)}
            title="Keyboard shortcuts (?)"
            aria-label="Show keyboard shortcuts"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </button>
          <button
            className="header-icon-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen (F)' : 'Enter fullscreen (F)'}
            aria-label="Toggle fullscreen"
          >
            {isFullscreen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
            )}
          </button>
          <button className="close-btn" onClick={toggle} aria-label="Close menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Shortcuts panel ── */}
      {showShortcuts && (
        <div className="shortcuts-panel">
          <div className="shortcuts-title">Keyboard Shortcuts</div>
          {SHORTCUTS.map(s => (
            <div key={s.key} className="shortcut-row">
              <kbd>{s.key}</kbd>
              <span>{s.desc}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="tabs-header">
        <button className={`tab-btn ${activeTab === 'settings'   ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>Controls</button>
        <button className={`tab-btn ${activeTab === 'sequencer'  ? 'active' : ''}`} onClick={() => setActiveTab('sequencer')}>Sequencer</button>
        <button className={`tab-btn ${activeTab === 'data'       ? 'active' : ''}`} onClick={() => setActiveTab('data')}>Preset</button>
        {state.debugEnabled && (
          <button className={`tab-btn ${activeTab === 'debug' ? 'active' : ''}`} onClick={() => setActiveTab('debug')}>Debug</button>
        )}
      </div>

      <div className="controls-groups">

        {/* ══════════════ SEQUENCER TAB ══════════════ */}
        {activeTab === 'sequencer' ? (
          <>
            <div className="control-group">
              <GroupTitle title="Sequencer" />
              <label className="checkbox-item">
                <input type="checkbox" checked={state.sequencerEnabled} onChange={e => updateState({ sequencerEnabled: e.target.checked })} />
                Enable Sequencer
              </label>
              <p style={{ fontSize: '0.7rem', color: '#999', margin: '0.3rem 0 0 0', lineHeight: '1.4' }}>
                Build a sequence of parameter keyframes. Each phase captures the current Controls settings.
              </p>
            </div>

            {state.sequencerEnabled && (
              <>
                <div className="control-group">
                  <GroupTitle title="Sequence Info" />
                  <div className="control-item">
                    <label className="control-item-header">Title</label>
                    <input
                      type="text"
                      value={state.sequenceTitle}
                      onChange={e => updateState({ sequenceTitle: e.target.value })}
                      placeholder="My Sequence"
                      style={{ background: '#0a0a0b', border: '1px solid #333', color: '#fff', padding: '0.6rem', borderRadius: '6px', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#999', padding: '0.3rem 0' }}>
                    <span>Total: {formatDuration(totalSequenceDuration)}</span>
                    <span>Phases: {state.sequencePhases.length}</span>
                  </div>
                </div>

                <div className="control-group">
                  <GroupTitle title="Phases" />
                  {state.sequencePhases.length === 0 && (
                    <p style={{ fontSize: '0.8rem', color: '#666', textAlign: 'center', padding: '1rem' }}>
                      No phases yet. Tune the Controls tab settings and add a phase.
                    </p>
                  )}
                  <div className="sequence-phase-list">
                    {state.sequencePhases.map((phase, i) => (
                      <div key={phase.id} className={`sequence-phase-card ${currentPhaseIdx === i && state.sequencerPlaying ? 'active-phase' : ''}`}>
                        {state.sequencerPlaying && currentPhaseIdx === i && (
                          <div className="phase-playing-indicator">▶ PLAYING</div>
                        )}
                        <div className="phase-card-header">
                          <span className="phase-number">#{i + 1}</span>
                          <div className="phase-card-actions">
                            <button className="phase-btn" onClick={() => handleMovePhase(i, -1)} disabled={i === 0 || state.sequencerPlaying} title="Move Up">↑</button>
                            <button className="phase-btn" onClick={() => handleMovePhase(i, 1)} disabled={i === state.sequencePhases.length - 1 || state.sequencerPlaying} title="Move Down">↓</button>
                            <button className="phase-btn phase-delete" onClick={() => handleDeletePhase(i)} disabled={state.sequencerPlaying} title="Delete">✕</button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={phase.title}
                          onChange={e => handleUpdatePhase(i, { title: e.target.value })}
                          placeholder="Phase title"
                          disabled={state.sequencerPlaying}
                          className="phase-title-input"
                        />
                        <div className="phase-duration-row">
                          <label>Duration:</label>
                          <input
                            type="number"
                            value={phase.duration}
                            min={1} max={600}
                            onChange={e => handleUpdatePhase(i, { duration: Math.max(1, parseInt(e.target.value) || 1) })}
                            disabled={state.sequencerPlaying}
                            className="phase-duration-input"
                          />
                          <span>s</span>
                        </div>
                        <div className="phase-duration-row">
                          <label>Transition:</label>
                          <select
                            value={phase.transitionType || 'linear'}
                            onChange={e => handleUpdatePhase(i, { transitionType: e.target.value as SequencePhase['transitionType'] })}
                            disabled={state.sequencerPlaying}
                            style={{ flex: 1, background: '#0a0a0b', border: '1px solid #333', color: '#fff', padding: '0.4rem', borderRadius: '6px', outline: 'none', fontSize: '0.78rem' }}
                          >
                            {transitionOptions.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="phase-duration-row">
                          <label>Trans. Duration:</label>
                          <input
                            type="number"
                            value={phase.transitionDuration ?? 0}
                            min={0} max={30} step={0.5}
                            onChange={e => handleUpdatePhase(i, { transitionDuration: Math.max(0, parseFloat(e.target.value) || 0) })}
                            disabled={state.sequencerPlaying}
                            className="phase-duration-input"
                          />
                          <span>s</span>
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#666', padding: '0.3rem 0 0 0', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {phase.snapshot.length} bytes
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    className="action-btn secondary"
                    onClick={handleAddPhase}
                    disabled={state.sequencerPlaying}
                    style={{ width: '100%' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add Current State as Phase
                  </button>
                </div>

                <div className="control-group">
                  <GroupTitle title="Playback" />
                  {state.sequencePhases.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: '#666', textAlign: 'center', padding: '0.5rem' }}>
                      Add phases before playing.
                    </p>
                  ) : (
                    <>
                      <div className="sequencer-controls">
                        <button
                          className={`action-btn ${state.sequencerPlaying ? 'secondary' : ''}`}
                          onClick={handlePlaySequence}
                          disabled={state.sequencePhases.length === 0}
                          style={{ flex: 1 }}
                        >
                          {state.sequencerPlaying ? (
                            <><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Stop</>
                          ) : (
                            <><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5,3 19,12 5,21"/></svg> Play</>
                          )}
                        </button>
                        <label className="checkbox-item" style={{ padding: '0.5rem' }}>
                          <input type="checkbox" checked={state.sequencerLoop} onChange={e => updateState({ sequencerLoop: e.target.checked })} />
                          Loop
                        </label>
                      </div>
                      <p style={{ fontSize: '0.7rem', color: '#999', margin: '0.3rem 0 0 0', lineHeight: '1.4' }}>
                        {state.sequencerPlaying
                          ? `Playing phase ${currentPhaseIdx + 1} of ${state.sequencePhases.length}`
                          : 'Press Play to start. You can also press Space to play/pause.'}
                      </p>
                    </>
                  )}
                </div>
              </>
            )}
          </>

        /* ══════════════ SETTINGS TAB ══════════════ */
        ) : activeTab === 'settings' ? (
          <>
            {/* ── Master Tempo ── */}
            <div className="control-group">
              <GroupTitle title="Master Tempo" onReset={resetMasterTempo} />
              <div className="control-item">
                <label className="control-item-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" checked={state.masterTempoEnabled}
                    onChange={e => updateState({ masterTempoEnabled: e.target.checked })} />
                  Enable Master Tempo
                  {state.masterTempoEnabled && (
                    <span
                      className="beat-panel-indicator"
                      style={{ animationDuration: `${60 / state.masterTempoBpm}s` }}
                    />
                  )}
                </label>
                <p className="control-description">
                  Single BPM clock that all locked effects follow in sync.
                  Converts HypnoViz from independent layers into one coherent pulse.
                </p>
              </div>

              {state.masterTempoEnabled && (<>
                <div className="control-item">
                  <label className="control-item-header">
                    BPM&nbsp;
                    <span style={{ color: '#ffdd57', fontWeight: 700 }}>{state.masterTempoBpm}</span>
                    <span style={{ color: '#666', marginLeft: '0.4rem', fontSize: '0.75rem' }}>
                      ({(60 / state.masterTempoBpm).toFixed(2)} s / beat)
                    </span>
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="range" min={30} max={240} step={1}
                      value={state.masterTempoBpm}
                      onChange={e => updateState({ masterTempoBpm: Number(e.target.value) })}
                      style={{ flex: 1 }} />
                    <button className="phase-btn" onClick={handleTapTempo}
                      title="Tap to set BPM" style={{ minWidth: '48px', fontWeight: 700, fontSize: '0.8rem' }}>
                      TAP
                    </button>
                  </div>
                </div>

                <div className="control-item">
                  <label className="control-item-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" checked={state.masterTempoIndicator}
                      onChange={e => updateState({ masterTempoIndicator: e.target.checked })} />
                    Show corner beat indicator (Debug mode only)
                  </label>
                </div>

                <div className="control-item">
                  <label className="control-item-header">
                    Time Signature&nbsp;
                    <span style={{ color: '#ffdd57', fontWeight: 700 }}>{state.masterTempoBeats}/4</span>
                    <span style={{ color: '#666', fontSize: '0.72rem', marginLeft: '0.4rem' }}>
                      (beats per measure)
                    </span>
                  </label>
                  <select
                    value={state.masterTempoBeats}
                    onChange={e => {
                      const newBeats = Number(e.target.value);
                      const clamp = (v: number) => Math.min(v, newBeats);
                      updateState({
                        masterTempoBeats: newBeats,
                        lockStrobeBeat:        clamp(state.lockStrobeBeat),
                        lockFragmentPulseBeat: clamp(state.lockFragmentPulseBeat),
                        lockInversionBeat:     clamp(state.lockInversionBeat),
                        lockTextBeat:          clamp(state.lockTextBeat),
                      });
                    }}
                  >
                    {[2,3,4,5,6,7,8,12,16].map(n => (
                      <option key={n} value={n}>{n}/4</option>
                    ))}
                  </select>
                </div>

                {/* Lock table */}
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Lock effects to tempo
                  </div>
                  {/* Header row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '4px 6px', alignItems: 'center', fontSize: '0.68rem', color: '#555', marginBottom: '4px', padding: '0 2px' }}>
                    <span>Effect</span><span>Lock</span><span>Ratio</span><span>Beat</span>
                  </div>
                  {([
                    { label: 'Color Cycling',  lockKey: 'lockColorCycling',  ratioKey: 'lockColorCyclingRatio',  beatKey: null,                   active: true,                      preview: (r: TempoRatio) => `${tempoRateHz(state.masterTempoBpm, r).toFixed(2)} cyc/s` },
                    { label: 'Hue Rotate',     lockKey: 'lockHueRotate',     ratioKey: 'lockHueRotateRatio',     beatKey: null,                   active: true,                      preview: (r: TempoRatio) => `${(tempoRateHz(state.masterTempoBpm, r) * 360).toFixed(0)}°/s` },
                    { label: 'Strobe',         lockKey: 'lockStrobe',        ratioKey: 'lockStrobeRatio',        beatKey: 'lockStrobeBeat',        active: state.intenseFlash,        preview: (_r: TempoRatio) => `beat ${state.lockStrobeBeat}/${state.masterTempoBeats}` },
                    { label: 'Inversion',      lockKey: 'lockInversion',     ratioKey: 'lockInversionRatio',     beatKey: 'lockInversionBeat',     active: state.inversionEnabled,    preview: (_r: TempoRatio) => `beat ${state.lockInversionBeat}/${state.masterTempoBeats}` },
                    { label: 'Text',           lockKey: 'lockText',          ratioKey: 'lockTextRatio',          beatKey: 'lockTextBeat',          active: state.textEnabled,         preview: (_r: TempoRatio) => `beat ${state.lockTextBeat}/${state.masterTempoBeats}` },
                    { label: 'Speed Ramp→BPM', lockKey: 'lockSpeedRamp',     ratioKey: 'lockSpeedRampRatio',     beatKey: null,                   active: state.pulseSpeed,          preview: (_r: TempoRatio) => 'ramp modulates BPM' },
                    { label: 'Audio Tremolo',  lockKey: 'lockAudioTremolo',  ratioKey: 'lockAudioTremoloRatio',  beatKey: null,                   active: state.audioEnabled,        preview: (r: TempoRatio) => `${Math.min(10, tempoRateHz(state.masterTempoBpm, r)).toFixed(2)} Hz` },
                    { label: 'Audio Beat',     lockKey: 'lockAudioBeat',     ratioKey: 'lockAudioBeatRatio',     beatKey: null,                   active: state.audioEnabled,        preview: (r: TempoRatio) => `${Math.min(40, tempoRateHz(state.masterTempoBpm, r)).toFixed(2)} Hz` },
                  ] as const).map(({ label, lockKey, ratioKey, beatKey, active, preview }) => {
                    const isLocked = state[lockKey] as boolean;
                    const ratio    = state[ratioKey] as TempoRatio;
                    const beatVal  = beatKey ? state[beatKey] as number : null;
                    return (
                      <div key={lockKey} style={{
                        display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '4px 6px',
                        alignItems: 'center', padding: '4px 2px',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        opacity: active ? 1 : 0.45,
                      }}>
                        <span style={{ fontSize: '0.75rem', color: isLocked ? '#e0e0e0' : '#888' }}>
                          {label}
                          {!active && <span style={{ fontSize: '0.62rem', color: '#555', marginLeft: '4px' }}>(off)</span>}
                        </span>
                        <input type="checkbox" checked={isLocked}
                          onChange={e => updateState({ [lockKey]: e.target.checked } as any)} />
                        <select
                          disabled={!isLocked}
                          value={ratio}
                          onChange={e => updateState({ [ratioKey]: e.target.value as TempoRatio } as any)}
                          style={{ fontSize: '0.7rem', padding: '2px 2px', width: '46px',
                            opacity: isLocked ? 1 : 0.4, background: '#1a1a1b', color: '#e0e0e0', border: '1px solid #444', borderRadius: '4px' }}
                          title={isLocked ? preview(ratio) : ''}
                        >
                          {TEMPO_RATIOS.map(r => (
                            <option key={r} value={r}>{ratioLabel(r)}</option>
                          ))}
                        </select>
                        {/* Beat offset — only for edge-triggered systems */}
                        {beatKey ? (
                          <select
                            disabled={!isLocked}
                            value={beatVal ?? 1}
                            onChange={e => updateState({ [beatKey]: Number(e.target.value) } as any)}
                            style={{ fontSize: '0.7rem', padding: '2px 2px', width: '40px',
                              opacity: isLocked ? 1 : 0.4, background: '#1a1a1b', color: '#e0e0e0', border: '1px solid #444', borderRadius: '4px' }}
                            title={isLocked ? `Fire on beat ${beatVal} of ${state.masterTempoBeats}` : ''}
                          >
                            {Array.from({ length: state.masterTempoBeats }, (_, i) => i + 1).map(b => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        ) : (
                          <span /> /* empty cell to keep grid aligned */
                        )}
                      </div>
                    );
                  })}
                  <p style={{ fontSize: '0.67rem', color: '#555', margin: '0.5rem 0 0 0', lineHeight: 1.5 }}>
                    Ratio: how fast relative to the master beat.
                    Beat: which beat of the measure triggers edge effects (strobe, inversion, text, fragment).
                    Speed Ramp→BPM uses the ramp to slowly modulate the BPM itself.
                  </p>
                </div>
              </>)}
            </div>

            {/* ── Visuals ── */}
            <div className="control-group">
              <GroupTitle title="Visuals" onReset={resetVisuals} />
              <div className="control-item">
                <label className="control-item-header">Canvas Mode</label>
                <select value={state.mode} onChange={e => updateState({ mode: e.target.value as any })}>
                  <option value="Lighten">Lighten (White Base)</option>
                  <option value="Darken">Darken (Black Base)</option>
                </select>
              </div>
              <div className="control-item">
                <label className="control-item-header">Spiral Direction</label>
                <select value={state.direction} onChange={e => updateState({ direction: parseInt(e.target.value) as any })}>
                  <option value={1}>Outward</option>
                  <option value={-1}>Inward</option>
                </select>
              </div>
              <Slider label="Arms"      value={state.arms}   min={1}   max={30}  step={1}   onChange={v => updateState({ arms: v })} />
              <Slider label="Turns"     value={state.turns}  min={0.1} max={10}  step={0.1} onChange={v => updateState({ turns: v })} />
              <Slider label="Curve"     value={state.curve}  min={0.1} max={5}   step={0.1} onChange={v => updateState({ curve: v })} />
              <Slider label="Thickness" value={state.width}  min={1}   max={100} step={1}   onChange={v => updateState({ width: v })} />
              <div className="control-item">
                <label className="control-item-header">Spiral Math</label>
                <select
                  value={state.spiralMath}
                  onChange={e => updateState({ spiralMath: e.target.value as SpiralMath })}
                >
                  <option value="power">Power Law — classic, Curve slider shapes density</option>
                  <option value="log">Logarithmic — exponential growth, seamless zoom</option>
                  <option value="archimedean">Archimedean — constant arm spacing</option>
                  <option value="fermat">Fermat — denser arms toward the outside</option>
                </select>
                <p style={{ fontSize: '0.7rem', color: '#999', margin: '0.3rem 0 0 0', lineHeight: '1.4' }}>
                  {state.spiralMath === 'power'       && 'Arms cluster toward the center based on the Curve value. Most versatile.'}
                  {state.spiralMath === 'log'         && 'Arms grow exponentially — equiangular at every scale. Pairs best with Zoom Tunnel for a seamless fall-in effect. Curve sets the growth rate.'}
                  {state.spiralMath === 'archimedean' && 'Equal spacing between successive arms — the classic drafting compass spiral. Curve has no effect.'}
                  {state.spiralMath === 'fermat'      && "Arms pack tighter near the outer edge. Creates a dense, organic texture. Curve has no effect."}
                </p>
              </div>
              {/* Spiral rendering uses a single filled-ribbon path. The spiralRenderMode
                  field is retained in state for saved-preset compatibility but no longer
                  selects between modes, so there is no UI control for it. */}
              <Slider label="Max FPS"    value={state.maxFps}   min={1}  max={240} step={1}  onChange={v => updateState({ maxFps: v })} />
              <Slider label="Arm Taper"  value={state.armTaper} min={0}  max={100} step={1} unit="%" onChange={v => updateState({ armTaper: v })} />
              <p style={{ fontSize: '0.68rem', color: '#666', margin: '-0.25rem 0 0 0', lineHeight: '1.4' }}>
                Fades out the outermost portion of each arm. Useful in Blend mode to hide arms that cross through the opposite eye.
              </p>
            </div>

            {/* ── Audio ── */}
            <div className="control-group">
              <GroupTitle title="Audio" onReset={resetAudio} />
              <label className="checkbox-item">
                <input type="checkbox" checked={state.audioEnabled} onChange={e => updateState({ audioEnabled: e.target.checked })} />
                Enable Audio
              </label>
              <p style={{ fontSize: '0.7rem', color: '#888', margin: '0 0 0.5rem 0.25rem', lineHeight: '1.5' }}>
                Synthesised binaural / isochronic tones, drone, and noise. Headphones recommended for binaural mode.
              </p>
              {state.audioEnabled && (
                <>
                  {/* Mood presets */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <button className="action-btn secondary" style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem' }}
                      onClick={() => updateState({
                        audioToneEnabled: true, audioBeatMode: 'binaural',
                        audioCarrierFreq: 220, audioBeatFreq: 6, audioWaveform: 'sine',
                        audioDroneEnabled: true, audioDroneInterval: 'octave', audioDroneLevel: 35,
                        audioNoiseEnabled: true, audioNoiseType: 'brown', audioNoiseLevel: 30,
                        audioTremoloRate: 0.25, audioTremoloDepth: 20,
                        audioVolume: 35,
                      })}>
                      🌊 Relax
                    </button>
                    <button className="action-btn secondary" style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem' }}
                      onClick={() => updateState({
                        audioToneEnabled: true, audioBeatMode: 'binaural',
                        audioCarrierFreq: 432, audioBeatFreq: 12, audioWaveform: 'triangle',
                        audioDroneEnabled: true, audioDroneInterval: 'fifth', audioDroneLevel: 50,
                        audioNoiseEnabled: true, audioNoiseType: 'pink', audioNoiseLevel: 10,
                        audioTremoloRate: 0, audioTremoloDepth: 0,
                        audioVolume: 45,
                      })}>
                      🎯 Focus
                    </button>
                    <button className="action-btn secondary" style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem' }}
                      onClick={() => updateState({
                        audioToneEnabled: true, audioBeatMode: 'isochronic',
                        audioCarrierFreq: 333, audioBeatFreq: 38, audioWaveform: 'sawtooth',
                        audioDroneEnabled: true, audioDroneInterval: 'tritone', audioDroneLevel: 60,
                        audioNoiseEnabled: true, audioNoiseType: 'white', audioNoiseLevel: 45,
                        audioTremoloRate: 7, audioTremoloDepth: 65,
                        audioVolume: 50,
                      })}>
                      ⚡ Overwhelm
                    </button>
                  </div>

                  <Slider label="Master Volume" value={state.audioVolume} min={0} max={100} step={1} unit="%" onChange={v => updateState({ audioVolume: v })} />

                  {/* ── Tone subsection ── */}
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0.5rem 0' }} />
                  <label className="checkbox-item">
                    <input type="checkbox" checked={state.audioToneEnabled} onChange={e => updateState({ audioToneEnabled: e.target.checked })} />
                    Tone Layer
                  </label>
                  {state.audioToneEnabled && (
                    <>
                      <div className="control-item">
                        <label className="control-item-header">Beat Mode</label>
                        <select value={state.audioBeatMode} onChange={e => updateState({ audioBeatMode: e.target.value as AudioBeatMode })}>
                          <option value="binaural">Binaural — split L/R (needs headphones)</option>
                          <option value="isochronic">Isochronic — pulsed mono</option>
                          <option value="monaural">Monaural — acoustic beat, any speaker</option>
                        </select>
                      </div>
                      <Slider label="Carrier" value={state.audioCarrierFreq} min={50} max={800} step={1}
                        unit={`Hz · ${freqToNote(state.audioCarrierFreq)}`}
                        onChange={v => updateState({ audioCarrierFreq: v })} />
                      <Slider label="Beat Frequency" value={state.audioBeatFreq} min={0.5} max={40} step={0.5}
                        unit={`Hz · ${beatToBand(state.audioBeatFreq)}`}
                        onChange={v => updateState({ audioBeatFreq: v })} />
                      <TempoLockBadge locked={state.lockAudioBeat} ratio={state.lockAudioBeatRatio} derivedValue={`${Math.min(40, tempoRateHz(state.masterTempoBpm, state.lockAudioBeatRatio)).toFixed(2)} Hz`} />
                      <div className="control-item">
                        <label className="control-item-header">Waveform</label>
                        <select value={state.audioWaveform} onChange={e => updateState({ audioWaveform: e.target.value as AudioWaveform })}>
                          <option value="sine">Sine — pure, smooth</option>
                          <option value="triangle">Triangle — slightly warmer</option>
                          <option value="square">Square — hollow, vintage</option>
                          <option value="sawtooth">Sawtooth — buzzy, harsh</option>
                        </select>
                      </div>
                      <label className="checkbox-item">
                        <input type="checkbox" checked={state.rampAudioBeat} onChange={e => updateState({ rampAudioBeat: e.target.checked })} />
                        Link Beat to Speed Ramp
                      </label>
                      <p style={{ fontSize: '0.68rem', color: '#666', margin: '-0.1rem 0 0.25rem 0.25rem', lineHeight: '1.4' }}>
                        Lets the speed ramp drive the beat frequency for building tension. Hard-capped at 40 Hz.
                      </p>
                    </>
                  )}

                  {/* ── Drone subsection ── */}
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0.5rem 0' }} />
                  <label className="checkbox-item">
                    <input type="checkbox" checked={state.audioDroneEnabled} onChange={e => updateState({ audioDroneEnabled: e.target.checked })} />
                    Drone Layer
                  </label>
                  {state.audioDroneEnabled && (
                    <>
                      <div className="control-item">
                        <label className="control-item-header">Interval</label>
                        <select value={state.audioDroneInterval} onChange={e => updateState({ audioDroneInterval: e.target.value as AudioDroneInterval })}>
                          <option value="octave">Octave — thick, consonant</option>
                          <option value="fifth">Perfect Fifth — grounded, stable</option>
                          <option value="fourth">Perfect Fourth — open, neutral</option>
                          <option value="majorThird">Major Third — bright, warm</option>
                          <option value="tritone">Tritone — dissonant, unsettling</option>
                          <option value="minorSecond">Minor Second — anxious, dense</option>
                        </select>
                      </div>
                      <Slider label="Drone Level" value={state.audioDroneLevel} min={0} max={100} step={1} unit="%" onChange={v => updateState({ audioDroneLevel: v })} />
                    </>
                  )}

                  {/* ── Noise subsection ── */}
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0.5rem 0' }} />
                  <label className="checkbox-item">
                    <input type="checkbox" checked={state.audioNoiseEnabled} onChange={e => updateState({ audioNoiseEnabled: e.target.checked })} />
                    Noise Bed
                  </label>
                  {state.audioNoiseEnabled && (
                    <>
                      <div className="control-item">
                        <label className="control-item-header">Noise Type</label>
                        <select value={state.audioNoiseType} onChange={e => updateState({ audioNoiseType: e.target.value as AudioNoiseType })}>
                          <option value="brown">Brown — deep, womb-like</option>
                          <option value="pink">Pink — balanced, natural</option>
                          <option value="white">White — bright, masking</option>
                        </select>
                      </div>
                      <Slider label="Noise Level" value={state.audioNoiseLevel} min={0} max={100} step={1} unit="%" onChange={v => updateState({ audioNoiseLevel: v })} />
                    </>
                  )}

                  {/* ── Modulation subsection ── */}
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0.5rem 0' }} />
                  <p style={{ fontSize: '0.75rem', color: '#888', margin: '0 0 0.25rem 0', fontWeight: 600 }}>Tremolo</p>
                  <Slider label="Rate"  value={state.audioTremoloRate}  min={0} max={10}  step={0.05} unit="Hz" onChange={v => updateState({ audioTremoloRate: v })} />
                  <TempoLockBadge locked={state.lockAudioTremolo} ratio={state.lockAudioTremoloRatio} derivedValue={`${Math.min(10, tempoRateHz(state.masterTempoBpm, state.lockAudioTremoloRatio)).toFixed(2)} Hz`} />
                  <Slider label="Depth" value={state.audioTremoloDepth} min={0} max={100} step={1}    unit="%"  onChange={v => updateState({ audioTremoloDepth: v })} />
                  <p style={{ fontSize: '0.68rem', color: '#666', margin: '-0.25rem 0 0.25rem 0', lineHeight: '1.4' }}>
                    Amplitude modulation across all audio layers. Slow rates (0.2–0.5 Hz) feel like breathing; fast rates (5–8 Hz) feel agitated.
                  </p>
                </>
              )}
            </div>

            {/* ── Center Focus ── */}
            <div className="control-group">
              <GroupTitle title="Center Focus" onReset={resetCenterDot} />
              <label className="checkbox-item">
                <input type="checkbox" checked={state.centerDotEnabled} onChange={e => updateState({ centerDotEnabled: e.target.checked })} />
                Enable Center Dot
              </label>
              {state.centerDotEnabled && (
                <>
                  <Slider label="Dot Radius" value={state.centerDotRadius} min={1} max={200} step={1} onChange={v => updateState({ centerDotRadius: v })} />
                  <div className="control-item color-row">
                    <input type="color" value={state.centerDotColor} onChange={e => updateState({ centerDotColor: e.target.value })} title="Dot Color" />
                    <div style={{ fontSize: '0.7rem', color: '#888', alignSelf: 'center' }}>Dot Color</div>
                  </div>
                </>
              )}
            </div>

            {/* ── Motion ── */}
            <div className="control-group">
              <GroupTitle title="Motion" onReset={resetMotion} />
              <Slider label="Spin Speed" value={state.rotationSpeed} min={0} max={20} step={0.1} onChange={v => updateState({ rotationSpeed: v })} />
              <div className="control-item">
                <label className="control-item-header">Direction</label>
                <select value={state.direction} onChange={e => updateState({ direction: parseInt(e.target.value) as any })}>
                  <option value={1}>Outward</option>
                  <option value={-1}>Inward</option>
                </select>
              </div>
              <Slider label="Wobble"    value={state.wobble}      min={0} max={1}  step={0.01} onChange={v => updateState({ wobble: v })} />
              <Slider label="LFO Speed" value={state.wobbleSpeed} min={0} max={20} step={0.1}  onChange={v => updateState({ wobbleSpeed: v })} />
            </div>

            {/* ── Zoom Tunnel (ARCHIVED) ──────────────────────────────────────────
                Feature removed from UI. Fields retained in AppState for saved-preset
                compatibility. Rendering code commented out in SpiralCanvas.tsx.
                To restore: uncomment this block and the SpiralCanvas zoom section.
            <div className="control-group">
              <GroupTitle title="Zoom Tunnel" onReset={resetZoom} />
              ...zoom UI...
            </div>
            ─────────────────────────────────────────────────────────────────── */}

            {/* ── Eyes ── */}
            <div className="control-group">
              <GroupTitle title="Eyes" onReset={resetFragment} />
              <label className="checkbox-item">
                <input type="checkbox" checked={state.fragmentEnabled} onChange={e => updateState({ fragmentEnabled: e.target.checked })} />
                Enable Eyes
              </label>
              <p style={{ fontSize: '0.7rem', color: '#999', margin: '0.3rem 0 0.5rem 0.25rem', lineHeight: '1.4' }}>
                Renders two side-by-side spirals — a hypnotic "two eyes" effect. Each eye is confined to its own soft region so they stay distinct while still blending in the middle.
              </p>
              {state.fragmentEnabled && (
                <>
                  <div className="control-item">
                    <label className="control-item-header">Direction</label>
                    <select value={state.fragmentDirectionMode} onChange={e => updateState({ fragmentDirectionMode: e.target.value as FragmentDirectionMode })}>
                      <option value="uniform">Uniform — both eyes spin the same way</option>
                      <option value="alternating">Alternating — eyes spin in opposite directions</option>
                      <option value="mirror">Mirror — opposite spin, but both pull in/out together</option>
                    </select>
                  </div>

                  <Slider label="Phase Offset" value={state.fragmentPhaseOffset} min={0} max={360} step={1} unit="°" onChange={v => updateState({ fragmentPhaseOffset: v })} />
                  <p style={{ fontSize: '0.68rem', color: '#666', margin: '-0.25rem 0 0.5rem 0', lineHeight: '1.4' }}>
                    Rotation offset between the two eyes. 0° = synchronized. 180° = maximum conflict.
                  </p>

                  <Slider label="Eye Spread" value={state.eyeSpread} min={0} max={100} step={1} unit="%" onChange={v => updateState({ eyeSpread: v })} />
                  <p style={{ fontSize: '0.68rem', color: '#666', margin: '-0.25rem 0 0.5rem 0', lineHeight: '1.4' }}>
                    How far each eye reaches toward the other. Low = compact, well-separated eyes; high = the eyes overlap more in the middle.
                  </p>

                  <Slider label="Eye Softness" value={state.eyeSoftness} min={0} max={100} step={1} unit="%" onChange={v => updateState({ eyeSoftness: v })} />
                  <p style={{ fontSize: '0.68rem', color: '#666', margin: '-0.25rem 0 0.5rem 0', lineHeight: '1.4' }}>
                    Softness of each eye's edge falloff. Low = crisp circular eyes; high = a gentle gradual fade between them.
                  </p>
                </>
              )}
            </div>

            {/* ── Colors ── */}
            <div className="control-group">
              <GroupTitle title="Colors" onReset={resetColors} />
              <div className="control-item">
                <label className="control-item-header">Color Animation Mode</label>
                <select value={state.colorMode} onChange={e => updateState({ colorMode: e.target.value as ColorMode })}>
                  <option value="default">Default (cycling gradient)</option>
                  <option value="static">Static on arm</option>
                  <option value="kaleidoscopic">Kaleidoscopic</option>
                </select>
                <p style={{ fontSize: '0.7rem', color: '#999', margin: '0.3rem 0 0 0', lineHeight: '1.4' }}>
                  {state.colorMode === 'default' && 'Colors move along the spiral over time.'}
                  {state.colorMode === 'static' && 'Each arm segment keeps its color as the spiral rotates, making motion more visible.'}
                  {state.colorMode === 'kaleidoscopic' && 'Angles are reflected to create a kaleidoscope pattern.'}
                </p>
              </div>
              {state.colorMode === 'kaleidoscopic' && (
                <Slider label="Sectors" value={state.kaleidoscopeSectors} min={1} max={16} step={1} onChange={v => updateState({ kaleidoscopeSectors: v })} />
              )}
              <div className="control-item">
                <label className="control-item-header">Palette</label>
                <select value={state.gradientType} onChange={e => updateState({ gradientType: e.target.value as any })}>
                  <option value="Single">Solid</option>
                  <option value="Two">Duo</option>
                  <option value="Three">Triad</option>
                </select>
              </div>
              <div className="control-item color-row">
                <input type="color" value={state.color1} onChange={e => updateState({ color1: e.target.value })} />
                {state.gradientType !== 'Single' && <input type="color" value={state.color2} onChange={e => updateState({ color2: e.target.value })} />}
                {state.gradientType === 'Three'  && <input type="color" value={state.color3} onChange={e => updateState({ color3: e.target.value })} />}
              </div>
              <Slider label="Shift Speed"   value={state.colorCyclingSpeed} min={0}   max={20}  step={0.1} onChange={v => updateState({ colorCyclingSpeed: v })} />
              <TempoLockBadge locked={state.lockColorCycling} ratio={state.lockColorCyclingRatio} derivedValue={`${tempoRateHz(state.masterTempoBpm, state.lockColorCyclingRatio).toFixed(2)} cyc/s`} />
              <Slider label="Hue Offset"    value={state.hueRotation}     min={0}    max={360} step={1}    unit="°"    onChange={v => updateState({ hueRotation: v })} />
              <Slider label="Hue Roll Speed" value={state.hueRotateSpeed} min={-360} max={360} step={1}    unit="°/s"  onChange={v => updateState({ hueRotateSpeed: v })} />
              <TempoLockBadge locked={state.lockHueRotate} ratio={state.lockHueRotateRatio} derivedValue={`${(tempoRateHz(state.masterTempoBpm, state.lockHueRotateRatio) * 360).toFixed(0)}°/s`} />
              <p style={{ fontSize: '0.68rem', color: '#666', margin: '-0.25rem 0 0.25rem 0', lineHeight: '1.4' }}>
                Offset shifts all colors without touching the pickers. Roll Speed continuously rotates the hue at a set rate (negative = reverse). Both interpolate during sequencer transitions.
              </p>

              {/* ── Palette Presets ── */}
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0.25rem 0' }} />
              <p style={{ fontSize: '0.75rem', color: '#888', margin: '0 0 0.4rem 0', fontWeight: 600 }}>Palette Presets</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                {([
                  { label: '🔴 Fire',    c1: '#ff4400', c2: '#ff9900', c3: '#ffff00', g: 'Three' },
                  { label: '🌊 Ocean',   c1: '#0055ff', c2: '#00ffcc', c3: '#0033aa', g: 'Three' },
                  { label: '💜 Violet',  c1: '#9933ff', c2: '#ff33cc', c3: '#3300ff', g: 'Three' },
                  { label: '⚡ Neon',    c1: '#ff0099', c2: '#00ff99', c3: '#9900ff', g: 'Three' },
                  { label: '🌅 Sunset',  c1: '#ff6600', c2: '#ff0066', c3: '#9900cc', g: 'Three' },
                  { label: '🌿 Forest',  c1: '#00cc44', c2: '#aaff00', c3: '#0066ff', g: 'Three' },
                  { label: '❄️ Ice',     c1: '#aaeeff', c2: '#ffffff', c3: '#0088ff', g: 'Three' },
                  { label: '⚪ Mono',    c1: '#ffffff', c2: '#888888', c3: '#ffffff', g: 'Two'   },
                ] as const).map(p => (
                  <button
                    key={p.label}
                    className="action-btn secondary"
                    style={{ fontSize: '0.74rem', padding: '0.4rem 0.5rem' }}
                    onClick={() => updateState({
                      color1: p.c1, color2: p.c2, color3: p.c3,
                      gradientType: p.g as any,
                      hueRotation: 0,
                    })}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Vignette ── */}
            <div className="control-group">
              <GroupTitle title="Vignette" onReset={resetVignette} />
              <label className="checkbox-item">
                <input type="checkbox" checked={state.vignetteEnabled} onChange={e => updateState({ vignetteEnabled: e.target.checked })} />
                Enable Vignette
              </label>
              <p style={{ fontSize: '0.7rem', color: '#888', margin: '0 0 0.5rem 0.25rem', lineHeight: '1.5' }}>
                Darkens the edges of the screen to draw focus toward the spiral center.
              </p>
              {state.vignetteEnabled && (
                <>
                  <Slider label="Intensity"   value={state.vignetteIntensity} min={0} max={100} step={1}  unit="%" onChange={v => updateState({ vignetteIntensity: v })} />
                  <Slider label="Inner Radius" value={state.vignetteSize}      min={0} max={95}  step={1}  unit="%" onChange={v => updateState({ vignetteSize: v })} />
                  <p style={{ fontSize: '0.68rem', color: '#666', margin: '-0.25rem 0 0.25rem 0', lineHeight: '1.4' }}>
                    Inner radius: how far the transparent center extends before fading to the edge color.
                  </p>
                  <Slider label="Softness" value={state.vignetteSoftness} min={0} max={100} step={1} unit="%" onChange={v => updateState({ vignetteSoftness: v })} />
                  <p style={{ fontSize: '0.68rem', color: '#666', margin: '-0.25rem 0 0.25rem 0', lineHeight: '1.4' }}>
                    Softness: low = a hard ring near the inner radius; high = a smooth, gradual fade across the screen.
                  </p>
                  <div className="control-item">
                    <label className="control-item-header">Shape</label>
                    <select value={state.vignetteShape} onChange={e => updateState({ vignetteShape: e.target.value as VignetteShape })}>
                      <option value="ellipse">Ellipse — fits screen aspect ratio</option>
                      <option value="circle">Circle — uniform radius</option>
                    </select>
                  </div>
                  <div className="control-item color-row">
                    <input type="color" value={state.vignetteColor} onChange={e => updateState({ vignetteColor: e.target.value })} title="Vignette Color" />
                    <div style={{ fontSize: '0.7rem', color: '#888', alignSelf: 'center' }}>Edge Tint Color</div>
                  </div>
                </>
              )}
            </div>

            {/* ── Subliminal ── */}
            <div className="control-group">
              <GroupTitle title="Subliminal" onReset={resetSubliminal} />
              <label className="checkbox-item">
                <input type="checkbox" checked={state.textEnabled} onChange={e => updateState({ textEnabled: e.target.checked })} />
                Enable Phrases
              </label>
              <div className="control-item">
                <textarea value={state.textLines} onChange={e => updateState({ textLines: e.target.value })} placeholder="One phrase per line" />
              </div>
              <label className="checkbox-item">
                <input type="checkbox" checked={state.randomOrder} onChange={e => updateState({ randomOrder: e.target.checked })} />
                Random order (no repeats)
              </label>

              <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0.5rem 0' }} />

              <label className="checkbox-item">
                <input type="checkbox" checked={state.flashEnabled} onChange={e => updateState({ flashEnabled: e.target.checked })} />
                Flash with Text
              </label>
              <Slider label="Flash Intensity" value={state.flashIntensity} min={0} max={100} step={1} unit="%" onChange={v => updateState({ flashIntensity: v })} />
              <div className="control-item color-row">
                <input type="color" value={state.flashColor} onChange={e => updateState({ flashColor: e.target.value })} title="Flash Color" />
                <div style={{ fontSize: '0.7rem', color: '#888', alignSelf: 'center' }}>Text Flash Color</div>
              </div>

              <Slider label="Phrase Interval" value={state.lineSpeed} min={100} max={1000} step={50} unit="ms" onChange={v => updateState({ lineSpeed: v })} />
              <TempoLockBadge locked={state.lockText} ratio={state.lockTextRatio} derivedValue={`beat ${state.lockTextBeat}/${state.masterTempoBeats}`} />
              <Slider label="Phrase Duration" value={state.lineTime}  min={100} max={1000} step={50} unit="ms" onChange={v => updateState({ lineTime: v })} />
              <Slider label="Text Size"       value={state.textSize}  min={0.5} max={3}    step={0.1}         onChange={v => updateState({ textSize: v })} />

              <div className="control-item color-row">
                <input type="color" value={state.textColor} onChange={e => updateState({ textColor: e.target.value })} title="Text Color" />
                <div style={{ fontSize: '0.7rem', color: '#888', alignSelf: 'center' }}>Text Color</div>
              </div>

              <div className="control-item">
                <label className="control-item-header">Phrase Animation</label>
                <select value={state.textAnimation} onChange={e => updateState({ textAnimation: e.target.value as TextAnimation })}>
                  <option value="fade">Fade</option>
                  <option value="flash">Flash</option>
                  <option value="pulse">Pulse</option>
                </select>
              </div>
            </div>

            {/* ── Strobe ── */}
            <div className="control-group">
              <GroupTitle title="Strobe" onReset={resetStrobe} />
              <label className="checkbox-item">
                <input type="checkbox" checked={state.intenseFlash} onChange={e => updateState({ intenseFlash: e.target.checked })} />
                Enable Independent Strobe
              </label>
              <p style={{ fontSize: '0.7rem', color: '#888', margin: '0 0 0.5rem 0.25rem', lineHeight: '1.5' }}>
                A free-running strobe independent of the text cycle.
              </p>
              {state.intenseFlash && (
                <>
                  <Slider label="Delay Between" value={state.intenseStrobeDelay} min={5}  max={1000} step={5} unit="ms" onChange={v => updateState({ intenseStrobeDelay: v })} />
                  <TempoLockBadge locked={state.lockStrobe} ratio={state.lockStrobeRatio} derivedValue={`beat ${state.lockStrobeBeat}/${state.masterTempoBeats}`} />
                  <Slider label="Duration"       value={state.strobeLength}       min={5}  max={1000} step={5} unit="ms" onChange={v => updateState({ strobeLength: v })} />
                  <Slider label="Intensity"      value={state.strobeIntensity}    min={0}  max={100}  step={1} unit="%" onChange={v => updateState({ strobeIntensity: v })} />
                  <div className="control-item">
                    <label className="control-item-header">Palette Size</label>
                    <select value={state.strobeColorCount} onChange={e => updateState({ strobeColorCount: parseInt(e.target.value) })}>
                      <option value={1}>1 Color</option>
                      <option value={2}>2 Colors</option>
                      <option value={3}>3 Colors</option>
                    </select>
                  </div>
                  <div className="control-item color-row">
                    <input type="color" value={state.strobeColor1} onChange={e => updateState({ strobeColor1: e.target.value })} title="Color 1" />
                    {state.strobeColorCount >= 2 && <input type="color" value={state.strobeColor2} onChange={e => updateState({ strobeColor2: e.target.value })} title="Color 2" />}
                    {state.strobeColorCount >= 3 && <input type="color" value={state.strobeColor3} onChange={e => updateState({ strobeColor3: e.target.value })} title="Color 3" />}
                  </div>
                </>
              )}
            </div>

            {/* ── Inversion Pulse ── */}
            <div className="control-group">
              <GroupTitle title="Inversion Pulse" onReset={resetInversion} />
              <label className="checkbox-item">
                <input type="checkbox" checked={state.inversionEnabled} onChange={e => updateState({ inversionEnabled: e.target.checked })} />
                Enable Inversion Pulse
              </label>
              <p style={{ fontSize: '0.7rem', color: '#888', margin: '0 0 0.5rem 0.25rem', lineHeight: '1.5' }}>
                Briefly inverts all colors beneath the text layer using blend mode. Creates a persistent afterimage in complementary colors.
              </p>
              {state.inversionEnabled && (
                <>
                  <Slider label="Rate"      value={state.inversionRate}      min={0.1} max={10} step={0.05} unit="s"  onChange={v => updateState({ inversionRate: v })} />
                  <TempoLockBadge locked={state.lockInversion} ratio={state.lockInversionRatio} derivedValue={`beat ${state.lockInversionBeat}/${state.masterTempoBeats}`} />
                  <Slider label="Duration"  value={state.inversionDuration}  min={0.05} max={2} step={0.05} unit="s"  onChange={v => updateState({ inversionDuration: v })} />
                  <Slider label="Intensity" value={state.inversionIntensity} min={0}   max={100} step={1}   unit="%"  onChange={v => updateState({ inversionIntensity: v })} />
                  <label className="checkbox-item">
                    <input type="checkbox" checked={state.rampInversionSpeed} onChange={e => updateState({ rampInversionSpeed: e.target.checked })} />
                    Link to Speed Ramp
                  </label>
                </>
              )}
            </div>

            {/* ── Speed Ramp ── */}
            <div className="control-group">
              <GroupTitle title="Speed Ramp" onReset={resetSpeedRamp} />
              <label className="checkbox-item">
                <input type="checkbox" checked={state.pulseSpeed} onChange={e => updateState({ pulseSpeed: e.target.checked })} />
                Enable Speed Ramping
              </label>
              <p style={{ fontSize: '0.7rem', color: '#888', margin: '0 0 0.5rem 0.25rem', lineHeight: '1.5' }}>
                Periodically accelerates and resets selected parameters for building tension.
              </p>
              {state.pulseSpeed && (
                <>
                  <div className="control-item">
                    <label className="control-item-header">Ramp Mode</label>
                    <select value={state.rampMode} onChange={e => updateState({ rampMode: e.target.value as RampMode })}>
                      <option value="sawtooth">Sawtooth — linear build then snap</option>
                      <option value="legacy">Legacy — smooth sine oscillation</option>
                    </select>
                    <p style={{ fontSize: '0.7rem', color: '#999', margin: '0.3rem 0 0 0', lineHeight: '1.4' }}>
                      {state.rampMode === 'sawtooth'
                        ? 'Starts at 100% and increases linearly to the max multiplier, then instantly resets.'
                        : 'Oscillates smoothly between min and max multipliers using a sine wave.'}
                    </p>
                  </div>

                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0.25rem 0' }} />
                  <p style={{ fontSize: '0.7rem', color: '#777', margin: '0 0 0.25rem 0' }}>Affect:</p>
                  <label className="checkbox-item">
                    <input type="checkbox" checked={state.rampSpiralSpeed}   onChange={e => updateState({ rampSpiralSpeed: e.target.checked })} />
                    Spiral Spin
                  </label>
                  <label className="checkbox-item">
                    <input type="checkbox" checked={state.rampColorSpeed}    onChange={e => updateState({ rampColorSpeed: e.target.checked })} />
                    Color Cycling
                  </label>
                  <label className="checkbox-item">
                    <input type="checkbox" checked={state.rampTextSpeed}     onChange={e => updateState({ rampTextSpeed: e.target.checked })} />
                    Text & Flash
                  </label>
                  <label className="checkbox-item">
                    <input type="checkbox" checked={state.rampStrobeSpeed}   onChange={e => updateState({ rampStrobeSpeed: e.target.checked })} />
                    Strobe Rate
                  </label>
                  <label className="checkbox-item">
                    <input type="checkbox" checked={state.rampInversionSpeed} onChange={e => updateState({ rampInversionSpeed: e.target.checked })} />
                    Inversion Rate
                  </label>
                  {/* Zoom Speed ramp removed (zoom feature archived) */}
                  {/* Fragment Duty Cycle ramp removed (auto-pulse feature removed) */}
                  <label className="checkbox-item">
                    <input type="checkbox" checked={state.rampAudioBeat} onChange={e => updateState({ rampAudioBeat: e.target.checked })} />
                    Audio Beat Frequency
                  </label>

                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0.25rem 0' }} />
                  {state.rampMode === 'legacy' && (
                    <Slider label="Min Multiplier" value={state.pulseMin}     min={0} max={1}  step={0.05} onChange={v => updateState({ pulseMin: v })} />
                  )}
                  <Slider label="Max Multiplier"   value={state.pulseMax}     min={1} max={8}  step={0.05} onChange={v => updateState({ pulseMax: v })} />
                  <Slider label="Ramp Duration"     value={state.rampDuration} min={1} max={60} step={1}   unit="s" onChange={v => updateState({ rampDuration: v })} />
                  <TempoLockBadge locked={state.lockSpeedRamp} ratio={state.lockSpeedRampRatio} derivedValue="ramp modulates BPM" />
                </>
              )}
            </div>

            {/* ── Developer ── */}
            <div className="control-group">
              <GroupTitle title="Developer" />
              <label className="checkbox-item">
                <input type="checkbox" checked={state.debugEnabled} onChange={e => updateState({ debugEnabled: e.target.checked })} />
                Enable Debug Panel
              </label>
              <p style={{ fontSize: '0.7rem', color: '#999', margin: '0.3rem 0 0 0', lineHeight: '1.4' }}>
                Shows a real-time debug tab with internal animation values.
              </p>
            </div>
          </>

        /* ══════════════ DEBUG TAB ══════════════ */
        ) : activeTab === 'debug' ? (
          <>
            {/* ── Global Clock ── */}
            <div className="control-group">
              <div className="control-group-title" style={{ color: '#ffaa00' }}>⏱ Global Clock</div>
              <p style={{ fontSize: '0.7rem', color: '#666', margin: '0 0 0.6rem 0', lineHeight: '1.4' }}>
                Monotonic session timer. Starts on first animation frame, never resets.
                Foundation for future cross-system sync.
              </p>
              <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '10px', padding: '0.75rem', textAlign: 'center', marginBottom: '0.5rem' }}>
                <div style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: '1.6rem', color: '#ffdd57', letterSpacing: '0.06em', lineHeight: 1 }}>
                  {formatClock(debugValues.sessionTime)}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#666', marginTop: '0.3rem' }}>HH : MM : SS . tenths</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
                <DebugRow label="Session time"  value={debugValues.sessionTime}  suffix=" s"   decimals={2} />
                <DebugRow label="Frame count"   value={debugValues.frameCount}   suffix=" frames" decimals={0} />
                <DebugRow label="FPS"           value={debugValues.fps}          suffix=" fps" decimals={0} />
                <DebugRow label="Frame time"    value={debugValues.frameTimeMs}  suffix=" ms"  decimals={2} />
                <DebugRow label="Canvas"        value={`${debugValues.canvasWidth} × ${debugValues.canvasHeight}`} decimals={0} />
              </div>
            </div>

            {/* ── Motion ── */}
            <div className="control-group">
              <div className="control-group-title" style={{ color: '#ffaa00' }}>🌀 Motion</div>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
                <DebugRow label="Rotation angle"   value={debugValues.rotationAngle}  suffix=" rad" decimals={4} />
                <DebugRow label="Effective speed"  value={debugValues.effectiveSpeed} suffix=" rad/s" decimals={4} />
                <DebugRow label="Ramp factor"      value={debugValues.rampFactor}     decimals={4} />
              </div>
            </div>

            {/* ── Color ── */}
            <div className="control-group">
              <div className="control-group-title" style={{ color: '#ffaa00' }}>🎨 Color</div>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
                <DebugRow label="Color phase"   value={debugValues.colorPhase}   decimals={4} />
                <DebugRow label="Hue offset"    value={debugValues.hueOffsetDeg} suffix="°" decimals={2} />
                <DebugRow label="Color mode"    value={state.colorMode} />
                <DebugRow label="Gradient"      value={state.gradientType} />
              </div>
            </div>

            {/* ── Audio ── */}
            <div className="control-group">
              <div className="control-group-title" style={{ color: '#ffaa00' }}>🎵 Audio</div>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
                <DebugRow label="Context state"    value={debugValues.audioContextState} />
                <DebugRow label="Beat freq"        value={debugValues.effectiveBeatFreq} suffix=" Hz" decimals={2} />
                <DebugRow label="Carrier freq"     value={state.audioCarrierFreq}        suffix=" Hz" decimals={0} />
                <DebugRow label="Beat mode"        value={state.audioBeatMode} />
              </div>
            </div>

            {/* ── Master Tempo (debug) ── */}
            <div className="control-group">
              <div className="control-group-title" style={{ color: '#ffaa00' }}>🎼 Master Tempo</div>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
                {state.masterTempoEnabled ? (<>
                  <DebugRow label="BPM"        value={debugValues.masterTempoBpm}  decimals={0} />
                  <DebugRow label="Beat phase"  value={debugValues.masterBeatPhase} decimals={4} />
                  <DebugRow label="Total beats" value={debugValues.beatCount}       decimals={0} />
                  <DebugRow label="Beat period" value={state.masterTempoEnabled ? (60 / state.masterTempoBpm) : 0} suffix=" s" decimals={3} />
                  <div style={{ marginTop: '0.5rem' }}>
                    {/* Beat phase progress bar */}
                    <div style={{ height: '4px', borderRadius: '2px', background: '#222', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: '2px', background: '#ffdd57',
                        width: `${(debugValues.masterBeatPhase * 100).toFixed(1)}%`,
                        transition: 'width 0.05s linear',
                      }} />
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '2px', textAlign: 'right' }}>
                      beat progress
                    </div>
                  </div>
                </>) : (
                  <span style={{ fontSize: '0.78rem', color: '#555' }}>Master tempo is off.</span>
                )}
              </div>
            </div>

            {/* ── Sequencer ── */}
            <div className="control-group">
              <div className="control-group-title" style={{ color: '#ffaa00' }}>🎞 Sequencer</div>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
                <DebugRow label="Playing"     value={state.sequencerPlaying ? 'YES' : 'NO'} />
                <DebugRow label="Phase index" value={currentPhaseIdx >= 0 ? `${currentPhaseIdx + 1} / ${state.sequencePhases.length}` : '—'} />
                <DebugRow label="Phase title" value={currentPhaseIdx >= 0 && state.sequencePhases[currentPhaseIdx] ? state.sequencePhases[currentPhaseIdx].title : '—'} />
                <DebugRow label="Loop"        value={state.sequencerLoop ? 'ON' : 'OFF'} />
              </div>
            </div>

            {/* ── Active Effects ── */}
            <div className="control-group">
              <div className="control-group-title" style={{ color: '#ffaa00' }}>⚡ Active Effects</div>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '0.6rem 0.75rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  <DebugPill label="Audio"       active={state.audioEnabled} />
                  <DebugPill label="Fragment"    active={state.fragmentEnabled} />
                  <DebugPill label="Vignette"    active={state.vignetteEnabled} />
                  <DebugPill label="Inversion"   active={state.inversionEnabled} />
                  <DebugPill label="Text"        active={state.textEnabled} />
                  <DebugPill label="Flash"       active={state.flashEnabled} />
                  <DebugPill label="Strobe"      active={state.intenseFlash} />
                  <DebugPill label="Speed Ramp"  active={state.pulseSpeed} />
                  <DebugPill label="Hue Rotate"  active={state.hueRotateSpeed !== 0} />
                  <DebugPill label="Center Dot"  active={state.centerDotEnabled} />
                </div>
              </div>
            </div>
          </>

        /* ══════════════ PRESET / DATA TAB ══════════════ */
        ) : (
          <>
            <div className="control-group">
              <div className="control-group-title">Export Preset</div>
              <p style={{ fontSize: '0.8rem', color: '#999', margin: '0 0 0.75rem 0', lineHeight: '1.5' }}>
                Only fields that differ from defaults are included, keeping the output compact and AI-friendly. Paste into any HypnoViz instance to restore.
              </p>
              <div className="preset-export-row">
                <textarea
                  id="preset-export"
                  readOnly
                  value={exportString}
                  style={{ width: '100%', background: '#0a0a0b', border: '1px solid #333', color: '#aaf', padding: '0.75rem', borderRadius: '8px', fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '0.72rem', resize: 'vertical', outline: 'none', height: '160px', lineHeight: '1.6', wordBreak: 'break-all' }}
                  onClick={e => (e.target as HTMLTextAreaElement).select()}
                />
                <button className={`action-btn copy-btn ${copyFeedback ? 'copied' : ''}`} onClick={handleCopy}>
                  {copyFeedback ? (
                    <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!</>
                  ) : (
                    <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy String</>
                  )}
                </button>
              </div>
            </div>

            <div className="control-group">
              <div className="control-group-title">Import Preset</div>
              <p style={{ fontSize: '0.8rem', color: '#999', margin: '0 0 0.75rem 0', lineHeight: '1.5' }}>
                Paste a preset string below and click Apply to load it.
              </p>
              <div className="preset-import-row">
                <textarea
                  value={importText}
                  onChange={e => { setImportText(e.target.value); setImportStatus('idle'); }}
                  placeholder='{"mode":"Darken","arms":8,...}'
                  style={{ width: '100%', background: '#0a0a0b', border: importStatus === 'error' ? '1px solid #ff4444' : '1px solid #333', color: '#aaf', padding: '0.75rem', borderRadius: '8px', fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '0.72rem', resize: 'none', outline: 'none', height: '80px', lineHeight: '1.6' }}
                />
                <div className="import-footer">
                  <button className="action-btn" onClick={handleImport} disabled={!importText.trim()}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Apply Preset
                  </button>
                  {importStatus === 'success' && <span className="status-msg success">✓ Preset loaded!</span>}
                  {importStatus === 'error'   && <span className="status-msg error">✗ Invalid string</span>}
                </div>
              </div>
            </div>

            <div className="control-group">
              <div className="control-group-title" style={{ color: '#4ade80' }}>📋 Reference Documents</div>
              <p style={{ fontSize: '0.78rem', color: '#999', margin: '0 0 0.75rem 0', lineHeight: '1.5' }}>
                Open these guides to copy their contents and paste into an AI prompt for custom preset generation.
              </p>
              <button
                className="action-btn secondary"
                style={{ width: '100%', marginBottom: '0.75rem' }}
                onClick={async () => {
                  const files = ['PRESET_KEYS.txt', 'PRESET_SCHEMA.txt', 'PRESET_TEMPLATE.json', 'SEQUENCE_SCHEMA.txt'];
                  for (const filename of files) {
                    try {
                      const res = await fetch(`/${filename}`);
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = filename;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    } catch { /* skip failed files */ }
                  }
                }}
              >
                ⬇ Download All Reference Docs
              </button>
              {(['PRESET_KEYS.txt', 'PRESET_SCHEMA.txt', 'PRESET_TEMPLATE.json', 'SEQUENCE_SCHEMA.txt'] as const).map(filename => (
                <div key={filename} style={{ marginBottom: '0.6rem' }}>
                  <button
                    className="action-btn secondary"
                    style={{ width: '100%', fontSize: '0.8rem' }}
                    onClick={async () => {
                      if (docViewer === filename) { setDocViewer(null); return; }
                      try {
                        const res = await fetch(`/${filename}`);
                        setDocContent(await res.text());
                        setDocViewer(filename);
                      } catch {
                        setDocContent(`Failed to load ${filename}.`);
                        setDocViewer(filename);
                      }
                    }}
                  >
                    {docViewer === filename ? `▲ Hide ${filename}` : `▼ View ${filename}`}
                    <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#888' }}>
                      {filename.endsWith('.json') ? 'JSON' : 'TEXT'}
                    </span>
                  </button>
                  {docViewer === filename && (
                    <div style={{ marginTop: '0.5rem', position: 'relative' }}>
                      <button
                        className="phase-btn"
                        style={{ position: 'absolute', top: '0.4rem', right: '0.4rem', zIndex: 2, background: '#1a1a1b', border: '1px solid #444' }}
                        onClick={() => navigator.clipboard.writeText(docContent).catch(() => {})}
                        title="Copy to clipboard"
                      >📋 Copy</button>
                      <pre className="doc-viewer-pre" style={{ background: '#0a0a0b', border: '1px solid #333', borderRadius: '8px', padding: '0.75rem', maxHeight: '320px', overflow: 'auto', fontSize: '0.72rem', fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: '#aaf', lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        <code>{docContent}</code>
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="control-group">
              <div className="control-group-title">Danger Zone</div>
              <button className="action-btn secondary danger" onClick={handleReset}>Factory Reset Settings</button>
            </div>
          </>
        )}

      </div>
    </aside>
  );
};
