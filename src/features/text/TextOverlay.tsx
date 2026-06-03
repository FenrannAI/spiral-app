import React, { useState, useEffect, useRef } from 'react';
import './TextOverlay.css';
import { AppState } from '../../types';
import { computeSpeedRampFactor } from '../../utils/color';
import { msUntilNextBeatOffset } from '../../utils/tempo';
import { debugStore } from '../../utils/debugStore';

// Fisher-Yates shuffle
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const TextOverlay: React.FC<{ state: AppState }> = ({ state }) => {
  const [displayedIndex, setDisplayedIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [flashTrigger, setFlashTrigger] = useState(0);
  const [strobeActive, setStrobeActive] = useState(false);
  const [strobeColor, setStrobeColor] = useState(state.strobeColor1);

  const [orderIndices, setOrderIndices] = useState<number[]>([]);
  const [orderPointer, setOrderPointer] = useState(0);
  const orderRef = useRef(orderIndices);
  const pointerRef = useRef(orderPointer);
  const sequentialIndexRef = useRef(0);
  const fadeOutTimeoutRef = useRef<number | undefined>(undefined);
  const cycleTimeoutRef = useRef<number | undefined>(undefined);
  const strobeColorIndexRef = useRef(0);

  useEffect(() => {
    orderRef.current = orderIndices;
    pointerRef.current = orderPointer;
  }, [orderIndices, orderPointer]);

  // Reset random order when text changes or randomOrder toggles
  useEffect(() => {
    if (!state.textEnabled) return;
    const lines = state.textLines.split('\n').filter(l => l.trim().length > 0);
    if (state.randomOrder && lines.length > 0) {
      const shuffled = shuffleArray(Array.from({ length: lines.length }, (_, i) => i));
      setOrderIndices(shuffled);
      setOrderPointer(0);
      setDisplayedIndex(shuffled[0]);
    }
  }, [state.textLines, state.randomOrder, state.textEnabled]);

  // Get current text line index
  const getCurrentLineIndex = (): number => {
    const lines = state.textLines.split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) return -1;
    if (state.randomOrder) {
      return orderRef.current[pointerRef.current] ?? 0;
    } else {
      return sequentialIndexRef.current % lines.length;
    }
  };

  // Helper to compute ramping factor based on current time and toggles
  const getRampingFactor = (): number => {
    if (state.pulseSpeed) {
      // Use epoch-relative time so the sawtooth resets cleanly on
      // sequencer start/loop instead of continuing from wall-clock time.
      const timeSec = (performance.now() - state.rampEpoch) / 1000;
      return computeSpeedRampFactor(
        timeSec,
        state.pulseMin,
        state.pulseMax,
        state.rampDuration,
        state.rampMode
      );
    }
    return 1;
  };

  // Phrase Cycling Logic
  useEffect(() => {
    if (!state.textEnabled) {
      setVisible(false);
      return;
    }

    const lines = state.textLines.split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) return;

    const advancePointer = () => {
      if (state.randomOrder) {
        setOrderPointer(prev => {
          let next = prev + 1;
          if (next >= lines.length) {
            const shuffled = shuffleArray(Array.from({ length: lines.length }, (_, i) => i));
            setOrderIndices(shuffled);
            return 0;
          }
          return next;
        });
      } else {
        sequentialIndexRef.current = (sequentialIndexRef.current + 1) % lines.length;
      }
    };

    const showPhrase = (intervalMs: number) => {
      if (fadeOutTimeoutRef.current !== undefined) {
        window.clearTimeout(fadeOutTimeoutRef.current);
        fadeOutTimeoutRef.current = undefined;
      }

      let idx: number;
      if (state.randomOrder) {
        idx = orderRef.current[pointerRef.current] ?? 0;
      } else {
        idx = sequentialIndexRef.current % lines.length;
      }

      setDisplayedIndex(idx);
      setVisible(true);
      if (state.flashEnabled) setFlashTrigger(prev => prev + 1);

      const effectiveLineTime = Math.max(100, state.lineTime);
      fadeOutTimeoutRef.current = window.setTimeout(() => {
        setVisible(false);
        fadeOutTimeoutRef.current = undefined;
      }, effectiveLineTime);

      advancePointer();
      cycleTimeoutRef.current = window.setTimeout(cycle, intervalMs);
    };

    const cycle = () => {
      if (state.masterTempoEnabled && state.lockText) {
        // ── Beat-aligned path: fire on lockTextBeat of each measure ──────────
        const msToNext = msUntilNextBeatOffset(
          state.masterTempoBpm,
          state.masterTempoBeats,
          state.lockTextBeat,
          debugStore.sessionStartMs
        );
        showPhrase(msToNext);
      } else {
        // ── Original rate-based path ──────────────────────────────────────────
        const textRamp = state.pulseSpeed && state.rampTextSpeed;
        const factor = textRamp ? getRampingFactor() : 1;
        let effectiveLineSpeed = Math.max(100, state.lineSpeed / factor);
        const effectiveLineTime = Math.max(100, state.lineTime / factor);
        if (effectiveLineSpeed < effectiveLineTime) effectiveLineSpeed = effectiveLineTime;
        showPhrase(effectiveLineSpeed);
      }
    };

    // Initial start — beat-aligned waits for first beat, otherwise 100ms
    const initialDelay = (state.masterTempoEnabled && state.lockText)
      ? msUntilNextBeatOffset(state.masterTempoBpm, state.masterTempoBeats, state.lockTextBeat, debugStore.sessionStartMs)
      : 100;
    const initialTimeout = window.setTimeout(cycle, initialDelay);

    return () => {
      window.clearTimeout(initialTimeout);
      window.clearTimeout(cycleTimeoutRef.current);
      if (fadeOutTimeoutRef.current !== undefined) {
        window.clearTimeout(fadeOutTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.textEnabled, state.textLines, state.lineSpeed, state.lineTime, state.flashEnabled,
      state.randomOrder, state.rampTextSpeed, state.pulseSpeed, state.pulseMin, state.pulseMax,
      state.rampDuration, state.rampMode,
      state.masterTempoEnabled, state.lockText, state.lockTextBeat, state.masterTempoBpm, state.masterTempoBeats]);

  // Strobe Logic – supports both rate-based and beat-aligned scheduling
  useEffect(() => {
    let strobeTimeout: number;
    let offTimeout: number;

    if (state.intenseFlash) {
      const pickColor = () => {
        const colorCount = state.strobeColorCount;
        const colorIndex = strobeColorIndexRef.current % colorCount;
        let color: string;
        if (colorCount === 1) color = state.strobeColor1;
        else if (colorCount === 2) color = colorIndex === 0 ? state.strobeColor1 : state.strobeColor2;
        else color = colorIndex === 0 ? state.strobeColor1 : colorIndex === 1 ? state.strobeColor2 : state.strobeColor3;
        setStrobeColor(color);
        strobeColorIndexRef.current = (strobeColorIndexRef.current + 1) % colorCount;
      };

      if (state.masterTempoEnabled && state.lockStrobe) {
        // ── Beat-aligned path ────────────────────────────────────────────────
        const fire = () => {
          pickColor();
          setStrobeActive(true);
          offTimeout = window.setTimeout(() => setStrobeActive(false), Math.max(16, state.strobeLength));

          const msToNext = msUntilNextBeatOffset(
            state.masterTempoBpm,
            state.masterTempoBeats,
            state.lockStrobeBeat,
            debugStore.sessionStartMs
          );
          strobeTimeout = window.setTimeout(fire, msToNext);
        };

        const msToFirst = msUntilNextBeatOffset(
          state.masterTempoBpm,
          state.masterTempoBeats,
          state.lockStrobeBeat,
          debugStore.sessionStartMs
        );
        strobeTimeout = window.setTimeout(fire, msToFirst);

      } else {
        // ── Original rate-based path ─────────────────────────────────────────
        const scheduleStrobe = () => {
          const strobeRamp = state.pulseSpeed && state.rampStrobeSpeed;
          const factor = strobeRamp ? getRampingFactor() : 1;
          const MIN_MS = 33;
          const baseRatio = state.intenseStrobeDelay > 0 ? state.strobeLength / state.intenseStrobeDelay : 1;
          let effectiveDelay = Math.max(MIN_MS, state.intenseStrobeDelay / factor);
          let effectiveLength = Math.max(MIN_MS, effectiveDelay * baseRatio);

          pickColor();
          setStrobeActive(true);
          offTimeout = window.setTimeout(() => setStrobeActive(false), effectiveLength);
          strobeTimeout = window.setTimeout(scheduleStrobe, effectiveDelay + effectiveLength);
        };
        scheduleStrobe();
      }

      return () => {
        clearTimeout(strobeTimeout);
        clearTimeout(offTimeout);
        setStrobeActive(false);
      };
    } else {
      setStrobeActive(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.intenseFlash,
    state.intenseStrobeDelay, state.strobeLength,
    state.strobeColor1, state.strobeColor2, state.strobeColor3, state.strobeColorCount,
    state.pulseSpeed, state.rampStrobeSpeed, state.pulseMin, state.pulseMax,
    state.rampDuration, state.rampMode,
    state.masterTempoEnabled, state.lockStrobe, state.lockStrobeBeat,
    state.masterTempoBpm, state.masterTempoBeats,
  ]);

  const lines = state.textLines.split('\n').filter(l => l.trim().length > 0);
  const currentIdx = getCurrentLineIndex();
  const text = lines[currentIdx] || '';

  return (
    <div className="text-overlay-container">
      {/* Standard Flash */}
      {state.flashEnabled && (
        <div
          key={`flash-${flashTrigger}`}
          className="flash-layer trigger-flash"
          style={{
            backgroundColor: state.flashColor,
            // @ts-ignore
            '--flash-opacity': state.flashIntensity / 100
          }}
        />
      )}

      {/* Strobe Flash – uses its own intensity slider, now cycles colors */}
      {state.intenseFlash && strobeActive && (
        <div
          className="flash-layer"
          style={{
            backgroundColor: strobeColor,
            opacity: state.strobeIntensity / 100,
            display: 'block'
          }}
        />
      )}

      {state.textEnabled && visible && (
        <div
          key={`${currentIdx}-${text}`}
          className={`text-line text-anim-${state.textAnimation}`}
          style={{
            color: state.textColor,
            animationDuration: `${state.lineTime}ms`,
            '--text-size-mult': state.textSize,
            textShadow: `0 0 20px ${state.textColor}88, 0 0 40px ${state.mode === 'Darken' ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)'}`
          } as React.CSSProperties}
        >
          {text}
        </div>
      )}
    </div>
  );
};