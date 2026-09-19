'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  nextTutorialStep,
  parseTutorialState,
  sanitizeGradeResults,
  tutorialStorageKey,
  type TutorialOcrSnapshot,
  type TutorialStep,
  type TutorialStoredState,
} from '@/lib/grading/tutorial';
import { SAMPLE_TRIAL } from '@/lib/sampleTrial';

type EventSender = (name: string, properties?: Record<string, string | number | boolean | null>) => void;

const initialState = (): TutorialStoredState => ({
  version: 1,
  step: 'intro',
  paused: false,
  completed: false,
});

export function useGradingTutorial(userId: string | null | undefined, sendEvent: EventSender) {
  const [state, setState] = useState<TutorialStoredState | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const emit = useCallback((name: string, properties?: Record<string, string | number | boolean | null>) => {
    sendEvent(name, { tutorial_version: 1, ...properties });
  }, [sendEvent]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!userId) {
        setState(null);
        setLoadedUserId(null);
        return;
      }
      let restored: TutorialStoredState | null = null;
      try {
        restored = parseTutorialState(window.localStorage.getItem(tutorialStorageKey(userId)));
      } catch {
        // Storage can be unavailable in private/restricted browsing; in-memory state still works.
      }
      setState(restored);
      setLoadedUserId(userId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [userId]);

  const update = useCallback((updater: (current: TutorialStoredState) => TutorialStoredState) => {
    if (!userId || loadedUserId !== userId) return;
    setState((previous) => {
      const next = updater(previous ?? initialState());
      try {
        window.localStorage.setItem(tutorialStorageKey(userId), JSON.stringify(next));
      } catch {
        // Persisting the guide must never block grading.
      }
      return next;
    });
  }, [loadedUserId, userId]);

  const start = useCallback(() => {
    update(() => ({ ...initialState(), step: 'select' }));
    emit('tutorial_started');
    emit('tutorial_step', { step: 'select' });
  }, [emit, update]);

  const setStep = useCallback((step: TutorialStep) => {
    update((current) => ({
      ...current,
      step,
      paused: false,
      completed: step === 'complete',
      ...(step === 'select' ? { ocr: undefined, grade: undefined } : {}),
    }));
    emit('tutorial_step', { step });
    if (step === 'complete') emit('tutorial_completed');
  }, [emit, update]);

  const next = useCallback(() => {
    const step = nextTutorialStep(state?.step ?? 'intro');
    setStep(step);
    return step;
  }, [setStep, state?.step]);

  const skip = useCallback(() => {
    update((current) => ({ ...current, paused: true }));
    emit('tutorial_skipped', { step: state?.step ?? 'intro' });
  }, [emit, state?.step, update]);

  const resume = useCallback(() => {
    update((current) => ({ ...current, paused: false }));
    emit('tutorial_resumed', { step: state?.step ?? 'intro' });
  }, [emit, state?.step, update]);

  const saveOcr = useCallback((ocr: TutorialOcrSnapshot) => {
    if (Object.keys(ocr.results).length !== 1 || Object.keys(ocr.confirmedTexts).length !== 1 ||
        !(SAMPLE_TRIAL.label in ocr.results) || !(SAMPLE_TRIAL.label in ocr.confirmedTexts)) return false;
    update((current) => ({ ...current, step: 'confirm', paused: false, completed: false, ocr, grade: undefined }));
    emit('tutorial_step', { step: 'confirm' });
    return true;
  }, [emit, update]);

  const saveGrade = useCallback((results: unknown[]) => {
    const sampleResults = results.filter((result) =>
      typeof result === 'object' && result !== null &&
      (result as { label?: unknown }).label === SAMPLE_TRIAL.label
    );
    const safeResults = sanitizeGradeResults(sampleResults);
    if (safeResults.length !== results.length || safeResults.length === 0) return false;
    update((current) => ({
      ...current,
      step: 'score',
      paused: false,
      grade: { results: safeResults },
    }));
    emit('tutorial_step', { step: 'score' });
    return true;
  }, [emit, update]);

  const updateConfirmedTexts = useCallback((confirmedTexts: Record<string, string>) => {
    update((current) => current.ocr ? {
      ...current,
      ocr: { ...current.ocr, confirmedTexts },
    } : current);
  }, [update]);

  const reportError = useCallback((stage: string) => {
    emit('tutorial_error', { stage });
  }, [emit]);

  return {
    state,
    isLoaded: !userId || loadedUserId === userId,
    hasSavedState: state !== null,
    start,
    setStep,
    next,
    skip,
    resume,
    saveOcr,
    saveGrade,
    updateConfirmedTexts,
    reportError,
  };
}
