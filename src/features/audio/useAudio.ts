import { useEffect, useRef } from 'react';
import { AppState } from '../../types';
import { AudioEngine } from './AudioEngine';
import { debugStore } from '../../utils/debugStore';

/**
 * Mounts an AudioEngine and ties its lifecycle to state.audioEnabled.
 *
 * The engine reads from a continuously-updated stateRef so all parameter
 * changes propagate via its internal animation-frame loop — React only sees
 * the boolean enable/disable flip.
 */
export function useAudio(state: AppState): void {
  const engineRef = useRef<AudioEngine | null>(null);
  const stateRef  = useRef(state);
  stateRef.current = state;

  // Start / stop engine when the master toggle changes.
  // Also keep debugStore.audioContextState in sync.
  useEffect(() => {
    if (state.audioEnabled) {
      if (!engineRef.current) {
        engineRef.current = new AudioEngine(stateRef);
        engineRef.current.start();
      }
      // Poll AudioContext state into debugStore at ~4 Hz while audio is on.
      const interval = setInterval(() => {
        const ctx = (engineRef.current as any)?.ctx as AudioContext | undefined;
        debugStore.audioContextState      = ctx?.state ?? 'starting';
        debugStore.effectiveBeatFreq      = stateRef.current.audioBeatFreq;
      }, 250);
      return () => clearInterval(interval);
    } else {
      engineRef.current?.stop();
      engineRef.current = null;
      debugStore.audioContextState = 'off';
      debugStore.effectiveBeatFreq = 0;
    }
  }, [state.audioEnabled]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      engineRef.current?.stop();
      engineRef.current = null;
    };
  }, []);
}
