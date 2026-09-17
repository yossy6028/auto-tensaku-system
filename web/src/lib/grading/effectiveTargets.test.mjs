import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveEffectiveTargets } from './effectiveTargets.ts';

test('single grading uses the current draft when no target was explicitly added', () => {
  const selection = deriveEffectiveTargets({
    mode: 'single',
    selectedLabels: [],
    pointsByLabel: {},
    draftLabel: '大問1 問1',
    draftPoints: 10,
  });

  assert.deepEqual(selection, {
    targets: [{ label: '大問1 問1', points: 10 }],
    source: 'draft',
    draftIsPending: false,
  });
});

test('explicit targets win and later draft edits remain pending', () => {
  const selection = deriveEffectiveTargets({
    mode: 'single',
    selectedLabels: ['大問2 問3'],
    pointsByLabel: { '大問2 問3': 8 },
    draftLabel: '大問4 問1',
    draftPoints: 20,
  });

  assert.deepEqual(selection, {
    targets: [{ label: '大問2 問3', points: 8 }],
    source: 'selected',
    draftIsPending: true,
  });
});

test('batch grading never treats an unadded draft as a target', () => {
  const selection = deriveEffectiveTargets({
    mode: 'batch',
    selectedLabels: [],
    pointsByLabel: {},
    draftLabel: '大問1 問1',
    draftPoints: 10,
  });

  assert.deepEqual(selection, { targets: [], source: 'none', draftIsPending: false });
});

test('blank free input produces no single-grading target', () => {
  const selection = deriveEffectiveTargets({
    mode: 'single',
    selectedLabels: [],
    pointsByLabel: {},
    draftLabel: '   ',
    draftPoints: null,
  });

  assert.deepEqual(selection, { targets: [], source: 'none', draftIsPending: false });
});
