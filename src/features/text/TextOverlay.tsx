import React, { useState, useEffect, useRef, useMemo } from 'react';
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

// Split the textLines field into individual whitespace-separated words (used by
// RSVP and highlight modes), preserving order across lines.
function splitWords(lines: string[]): string[] {
  return lines.flatMap(l => l.split(/\s+/)).filter(w => w.length > 0);
}

// Optimal Recognition Point: the letter the eye should fixate on for a word.
// Standard speed-reading heuristic by word length.
function orpIndex(word: string): number {
  const L = word.length;
  if (L <= 1) return 0;
  if (L <= 5) return 1;
  if (L <= 9) return 2;
  if (L <= 13) return 3;
  return 4;
}

export const TextOverlay: React.FC<{ state: AppState }> = ({ state }) => {
  const [displayedIndex, setDisplayedIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [flashTrigger, setFlashTrigger] = useState(0);
  const [strobeActive, setStrobeActive] = useState(false);
  const [strobeColor, setStrobeColor] = useState(state.strobeColor1);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [wallSeed, setWallSeed] = useState(0);

  const [orderIndices, setOrderIndices] = useState<number[]>([]);
  const [orderPointer, setOrderPointer] = useState(0);
  const orderRef = useRef(orderIndices);
  const pointerRef = useRef(orderPointer);
  const posRef = useRef(0); // sequential cursor (into the active unit list)
  const fadeOutTimeoutRef = useRef<number | undefined>(undefined);
  const cycleTimeoutRef = useRef<number | undefined>(undefined);
  const strobeColorIndexRef = useRef(0);

  useEffect(() => {
    orderRef.current = orderIndices;
    pointerRef.current = orderPointer;
  }, [orderIndices, orderPointer]);

  // ── Derived unit lists ──────────────────────────────────────────────────────
  const lines = state.textLines.split('\n').filter(l => l.trim().length > 0);
  const words = splitWords(lines);
  const isRsvp = state.textMode === 'rsvp';
  // The list of "units" cycled by phrase/rsvp modes (lines vs words).
  const units = isRsvp ? words : lines;
  // Random order is only meaningful for phrase mode (shuffling words = gibberish).
  const useRandom = state.randomOrder && state.textMode === 'phrase';

  const fontFamily = state.customFontName.trim()
    ? `'${state.customFontName.trim()}', sans-serif`
    : undefined;

  // ── Custom Google Font injection ────────────────────────────────────────────
  useEffect(() => {
    const fam = state.customFontName.trim();
    if (!fam) return;
    const id = 'hypnovis-font-' + fam.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    const famParam = encodeURIComponent(fam).replace(/%20/g, '+');
    link.href = `https://fonts.googleapis.com/css2?family=${famParam}:wght@400;700&display=swap`;
    document.head.appendChild(link);
  }, [state.customFontName]);

  // Reset random order when text changes or randomOrder toggles (phrase mode only)
  useEffect(() => {
    if (!state.textEnabled || state.textMode !== 'phrase') return;
    if (state.randomOrder && lines.length > 0) {
      const shuffled = shuffleArray(Array.from({ length: lines.length }, (_, i) => i));
      setOrderIndices(shuffled);
      setOrderPointer(0);
      setDisplayedIndex(shuffled[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.textLines, state.randomOrder, state.textEnabled, state.textMode]);

  // Helper to compute ramping factor based on current time and toggles
  const getRampingFactor = (): number => {
    if (state.pulseSpeed) {
      const timeSec = (performance.now() - state.rampEpoch) / 1000;
      return computeSpeedRampFactor(
        timeSec, state.pulseMin, state.pulseMax, state.rampDuration, state.rampMode,
      );
    }
    return 1;
  };

  // On a text-content or mode change (every sequencer phase included), restart the
  // phrase cursor and hide the overlay until the cycler shows a fresh phrase. Without
  // this, the cursor left over from the previous phase indexes into the new phrase
  // list and the LAST phrase of the incoming text flashes during the transition.
  // Keyed only on content/mode so it does NOT fire on every interpolation frame.
  useEffect(() => {
    posRef.current = 0;
    setDisplayedIndex(0);
    setVisible(false);
  }, [state.textLines, state.textMode]);

  // ── Phrase / RSVP cycling ───────────────────────────────────────────────────
  useEffect(() => {
    // Only phrase & rsvp use this cycler; wall/highlight render statically.
    if (!state.textEnabled || (state.textMode !== 'phrase' && state.textMode !== 'rsvp')) {
      setVisible(false);
      return;
    }
    if (units.length === 0) return;

    const currentUnitIndex = (): number =>
      useRandom ? (orderRef.current[pointerRef.current] ?? 0) : (posRef.current % units.length);

    const advancePointer = () => {
      if (useRandom) {
        setOrderPointer(prev => {
          const next = prev + 1;
          if (next >= units.length) {
            setOrderIndices(shuffleArray(Array.from({ length: units.length }, (_, i) => i)));
            return 0;
          }
          return next;
        });
      } else {
        posRef.current = (posRef.current + 1) % units.length;
      }
    };

    const showUnit = (intervalMs: number) => {
      if (fadeOutTimeoutRef.current !== undefined) {
        window.clearTimeout(fadeOutTimeoutRef.current);
        fadeOutTimeoutRef.current = undefined;
      }

      setDisplayedIndex(currentUnitIndex());
      setVisible(true);

      if (isRsvp) {
        // RSVP keeps each word fully visible until the next one — no fade gap,
        // no per-word flash (would strobe at high WPM).
      } else {
        if (state.flashEnabled) setFlashTrigger(prev => prev + 1);
        // Solid mode: when each phrase is meant to stay up at least as long as the
        // gap between phrases (lineTime >= lineSpeed), don't fade out — keep it
        // visible and swap in place, so phrases don't flicker / re-animate on top of
        // one another. Otherwise schedule the normal fade-out.
        const solid = state.lineTime >= state.lineSpeed;
        if (!solid) {
          const effectiveLineTime = Math.max(20, state.lineTime);
          fadeOutTimeoutRef.current = window.setTimeout(() => {
            setVisible(false);
            fadeOutTimeoutRef.current = undefined;
          }, effectiveLineTime);
        }
      }

      advancePointer();
      cycleTimeoutRef.current = window.setTimeout(cycle, intervalMs);
    };

    const cycle = () => {
      if (state.masterTempoEnabled && state.lockText) {
        // Beat-aligned: advance one unit per locked beat.
        const msToNext = msUntilNextBeatOffset(
          state.masterTempoBpm, state.masterTempoBeats, state.lockTextBeat, debugStore.sessionStartMs,
        );
        showUnit(msToNext);
      } else {
        const textRamp = state.pulseSpeed && state.rampTextSpeed;
        const factor = textRamp ? getRampingFactor() : 1;
        if (isRsvp) {
          // RSVP cadence derives from words-per-minute.
          const baseMs = 60000 / Math.max(1, state.wpm);
          const effective = Math.max(50, baseMs / factor);
          showUnit(effective);
        } else {
          let effectiveLineSpeed = Math.max(20, state.lineSpeed / factor);
          const effectiveLineTime = Math.max(20, state.lineTime / factor);
          if (effectiveLineSpeed < effectiveLineTime) effectiveLineSpeed = effectiveLineTime;
          showUnit(effectiveLineSpeed);
        }
      }
    };

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
  }, [state.textEnabled, state.textMode, state.textLines, state.lineSpeed, state.lineTime,
      state.flashEnabled, state.wpm, state.randomOrder, state.rampTextSpeed, state.pulseSpeed,
      state.pulseMin, state.pulseMax, state.rampDuration, state.rampMode,
      state.masterTempoEnabled, state.lockText, state.lockTextBeat, state.masterTempoBpm, state.masterTempoBeats]);

  // ── Wall regeneration ───────────────────────────────────────────────────────
  // The text wall fills the whole frame with the given phrases, randomised and
  // repeated. Each interval it regenerates so the wall appears to shift/move.
  useEffect(() => {
    if (!state.textEnabled || state.textMode !== 'wall' || lines.length === 0) return;
    const stepMs = Math.max(150, state.lineSpeed);
    const id = window.setInterval(() => setWallSeed(s => s + 1), stepMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.textEnabled, state.textMode, state.textLines, state.lineSpeed]);

  // Build a randomised, repeated string big enough to overflow the frame, picking
  // WHOLE phrases (lines) so each phrase's words stay together rather than being
  // shattered into individual words scattered among other phrases. Rendered as a
  // SINGLE text node (not per-word spans) so regenerating the wall is just one
  // cheap text update + native word-wrap. Keyed on wallSeed so it changes per tick.
  const wallText = useMemo(() => {
    if (state.textMode !== 'wall' || lines.length === 0) return '';
    const TARGET = Math.max(40, Math.min(600, Math.round(state.wallDensity)));
    const out: string[] = [];
    for (let i = 0; i < TARGET; i++) {
      out.push(lines[Math.floor(Math.random() * lines.length)]);
    }
    return out.join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallSeed, state.textMode, state.textLines, state.wallDensity]);

  // ── Highlight sweep ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!state.textEnabled || state.textMode !== 'highlight' || words.length === 0) return;
    setHighlightIndex(0);
    const stepMs = Math.max(60, 1000 / Math.max(0.5, state.highlightSweepSpeed));
    const id = window.setInterval(() => {
      setHighlightIndex(prev => (prev + 1) % words.length);
    }, stepMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.textEnabled, state.textMode, state.textLines, state.highlightSweepSpeed]);

  // ── Strobe Logic (unchanged) ────────────────────────────────────────────────
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
        const fire = () => {
          pickColor();
          setStrobeActive(true);
          offTimeout = window.setTimeout(() => setStrobeActive(false), Math.max(16, state.strobeLength));
          const msToNext = msUntilNextBeatOffset(
            state.masterTempoBpm, state.masterTempoBeats, state.lockStrobeBeat, debugStore.sessionStartMs,
          );
          strobeTimeout = window.setTimeout(fire, msToNext);
        };
        const msToFirst = msUntilNextBeatOffset(
          state.masterTempoBpm, state.masterTempoBeats, state.lockStrobeBeat, debugStore.sessionStartMs,
        );
        strobeTimeout = window.setTimeout(fire, msToFirst);
      } else {
        const scheduleStrobe = () => {
          const strobeRamp = state.pulseSpeed && state.rampStrobeSpeed;
          const factor = strobeRamp ? getRampingFactor() : 1;
          const MIN_MS = 33;
          const baseRatio = state.intenseStrobeDelay > 0 ? state.strobeLength / state.intenseStrobeDelay : 1;
          const effectiveDelay = Math.max(MIN_MS, state.intenseStrobeDelay / factor);
          const effectiveLength = Math.max(MIN_MS, effectiveDelay * baseRatio);

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

  // ── Shared text styling ─────────────────────────────────────────────────────
  const baseTextShadow = `0 0 20px ${state.textColor}88, 0 0 40px ${state.mode === 'Darken' ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)'}`;

  // Render a single RSVP word, optionally with the ORP anchor letter highlighted.
  // When rsvpAnchor is on (default), the word is laid out in a 3-column grid
  // (before | focal | after) so the focal letter stays pinned to the exact
  // horizontal centre regardless of word length. With it off, the word flows
  // inline (focal still highlighted) and recentres around its own midpoint.
  const renderRsvpWord = (word: string) => {
    if (!state.rsvpOrp || word.length === 0) return word;
    const i = Math.min(orpIndex(word), word.length - 1);
    if (!state.rsvpAnchor) {
      return (
        <>
          {word.slice(0, i)}
          <span style={{ color: state.highlightColor, fontWeight: 700 }}>{word[i]}</span>
          {word.slice(i + 1)}
        </>
      );
    }
    return (
      <>
        <span className="rsvp-before">{word.slice(0, i)}</span>
        <span className="rsvp-focal" style={{ color: state.highlightColor, fontWeight: 700 }}>{word[i]}</span>
        <span className="rsvp-after">{word.slice(i + 1)}</span>
      </>
    );
  };

  const renderText = () => {
    if (!state.textEnabled) return null;

    // ── WALL: the given words, randomised + repeated to fill the whole frame,
    //         regenerated each interval so the wall appears to shift/move.
    //         Rendered as one text node for performance. ──
    if (state.textMode === 'wall') {
      if (!wallText) return null;
      return (
        <div
          className="text-wall-grid"
          style={{
            color: state.textColor,
            opacity: state.wallOpacity / 100,
            fontFamily,
            // Wall mode reads big by default — 2× the Text Size slider — so it
            // fills the frame out of the box; the slider still refines from there.
            '--text-size-mult': state.textSize * 2,
          } as React.CSSProperties}
        >
          {/* No text-shadow: blurring a full-screen wall of text every cycle is a
              very costly repaint (the source of the regeneration hitch). */}
          <span className="text-wall-text">{wallText}</span>
        </div>
      );
    }

    // ── HIGHLIGHT: all words dimmed, a bright sweep moving through them ──
    if (state.textMode === 'highlight') {
      if (words.length === 0) return null;
      return (
        <div className="text-wall text-highlight" style={{ '--text-size-mult': state.textSize, fontFamily } as React.CSSProperties}>
          {words.map((w, i) => {
            const lit = i === highlightIndex;
            return (
              <span
                key={i}
                className="text-highlight-word"
                style={{
                  color: lit ? state.highlightColor : state.textColor,
                  opacity: lit ? 1 : state.wallOpacity / 100,
                  fontWeight: lit ? 700 : 400,
                  textShadow: lit ? `0 0 24px ${state.highlightColor}` : baseTextShadow,
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      );
    }

    // ── RSVP: one word at a time (no fade, swaps in place) ──
    if (state.textMode === 'rsvp') {
      if (!visible || units.length === 0) return null;
      const word = units[displayedIndex] || '';
      return (
        <div
          className={`text-line text-rsvp${state.rsvpOrp && state.rsvpAnchor ? ' text-rsvp-orp' : ''}`}
          style={{
            color: state.textColor,
            '--text-size-mult': state.textSize,
            fontFamily,
            textShadow: baseTextShadow,
          } as React.CSSProperties}
        >
          {renderRsvpWord(word)}
        </div>
      );
    }

    // ── PHRASE (default): one line at a time ──
    if (!visible || units.length === 0) return null;
    const text = units[displayedIndex] || '';

    // Solid mode (lineTime >= lineSpeed): render static text with no entrance
    // animation and a stable element (no per-phrase key) so phrases swap in place
    // instead of re-triggering the fade/flash/pulse and jittering.
    if (state.lineTime >= state.lineSpeed) {
      return (
        <div
          className="text-line text-solid"
          style={{
            color: state.textColor,
            '--text-size-mult': state.textSize,
            fontFamily,
            textShadow: baseTextShadow,
          } as React.CSSProperties}
        >
          {text}
        </div>
      );
    }

    return (
      <div
        key={`${displayedIndex}-${text}`}
        className={`text-line text-anim-${state.textAnimation}`}
        style={{
          color: state.textColor,
          animationDuration: `${state.lineTime}ms`,
          '--text-size-mult': state.textSize,
          fontFamily,
          textShadow: baseTextShadow,
        } as React.CSSProperties}
      >
        {text}
      </div>
    );
  };

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
            '--flash-opacity': state.flashIntensity / 100,
          }}
        />
      )}

      {/* Strobe Flash */}
      {state.intenseFlash && strobeActive && (
        <div
          className="flash-layer"
          style={{
            backgroundColor: strobeColor,
            opacity: state.strobeIntensity / 100,
            display: 'block',
          }}
        />
      )}

      {renderText()}
    </div>
  );
};
