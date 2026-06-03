
import { useState, useEffect, useRef, useCallback } from 'react';
import { persistence } from './persistence';

export function usePersistentState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(initialValue);
  const [loaded, setLoaded] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<T | null>(null);

  useEffect(() => {
    let active = true;
    persistence.getItem(key).then(val => {
      if (active && val) {
        try {
          setState({ ...initialValue, ...JSON.parse(val) });
        } catch (e) {
          console.error("Failed to restore state", e);
        }
      }
      if (active) setLoaded(true);
    });
    return () => { active = false; };
  }, [key]);

  // Flush pending write on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (pendingRef.current !== null) {
        persistence.setItem(key, JSON.stringify(pendingRef.current));
        pendingRef.current = null;
      }
    };
  }, [key]);

  const setPersistentState = useCallback((val: T | ((prev: T) => T)) => {
    setState(prev => {
      const next = typeof val === 'function' ? (val as any)(prev) : val;
      pendingRef.current = next;

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        if (pendingRef.current !== null) {
          persistence.setItem(key, JSON.stringify(pendingRef.current));
          pendingRef.current = null;
        }
        debounceTimerRef.current = null;
      }, 500);

      return next;
    });
  }, [key]);

  return [state, setPersistentState, loaded] as const;
}

/**
 * Runs `callback(dt, time)` on every requestAnimationFrame tick.
 *
 * The callback is stored in a ref so that re-renders (which produce a new
 * closure every time) do NOT cancel and re-schedule the rAF loop.  Previously
 * the effect depended on `callback` directly, which meant:
 *   - Every state change cancelled and restarted the loop (overhead).
 *   - `lastTime` was reset to `performance.now()` on each setup, so the first
 *     frame after every render had `deltaTime ≈ 0` — visible as jitter during
 *     sequencer transitions and slider drags.
 *
 * With the ref pattern the loop runs continuously from mount to unmount and
 * always sees the latest callback closure via `callbackRef.current`.
 */
export function useAnimationFrame(callback: (deltaTime: number, time: number) => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let frameId: number;
    let lastTime = performance.now();
    const loop = (time: number) => {
      const deltaTime = time - lastTime;
      lastTime = time;
      callbackRef.current(deltaTime, time);
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, []);
}
