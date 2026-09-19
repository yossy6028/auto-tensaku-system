import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isValidGradeResponse,
  deriveTrialUsage,
  nextTutorialStep,
  parseTutorialState,
  sanitizeGradeResults,
  tutorialStorageKey,
} from './tutorial.ts';

const validItem = {
  label: '問1',
  regradeToken: 'must-not-persist',
  result: {
    grading_result: {
      score: 72,
      feedback_content: { improvement_advice: '根拠を加える' },
      deduction_details: [],
    },
  },
};

test('grade success requires a finite score, feedback, and no failure marker', () => {
  assert.equal(isValidGradeResponse({ results: [validItem] }), true);
  assert.equal(isValidGradeResponse({ results: [{ ...validItem, result: { grading_result: { score: 0, feedback_content: {} } } }] }), true);
  assert.equal(isValidGradeResponse({ results: [] }), false);
  assert.equal(isValidGradeResponse({ status: 'error', results: [validItem] }), false);
  assert.equal(isValidGradeResponse({ results: [{ ...validItem, error: 'failed' }] }), false);
  assert.equal(isValidGradeResponse({ results: [{ ...validItem, label: '' }] }), false);
  assert.equal(isValidGradeResponse({ results: [{ ...validItem, status: 'incomplete' }] }), false);
  assert.equal(isValidGradeResponse({ incompleteGrading: true, results: [validItem] }), false);
  assert.equal(isValidGradeResponse({ results: [{ ...validItem, result: { ...validItem.result, incomplete_grading: true } }] }), false);
  assert.equal(isValidGradeResponse({ results: [{ label: '問1', result: { grading_result: { score: 1 } } }] }), false);
  assert.equal(isValidGradeResponse({ results: [{ ...validItem, result: { grading_result: { score: NaN, feedback_content: {} } } }] }), false);
});

test('persisted grade omits regrade credentials and keeps report fields', () => {
  const sanitized = sanitizeGradeResults([validItem]);
  assert.equal(sanitized.length, 1);
  assert.equal(sanitized[0].result.grading_result.score, 72);
  assert.equal('regradeToken' in sanitized[0], false);
  assert.equal(JSON.stringify(sanitized).includes('must-not-persist'), false);
});

test('malformed and cross-version storage is ignored', () => {
  assert.equal(parseTutorialState('{'), null);
  assert.equal(parseTutorialState(JSON.stringify({ version: 2, step: 'intro', paused: false, completed: false })), null);
  assert.equal(parseTutorialState(JSON.stringify({ version: 1, step: 'bogus', paused: false, completed: false })), null);
  assert.equal(parseTutorialState(JSON.stringify({ version: 1, step: 'confirm', paused: false, completed: false })), null);
  assert.equal(parseTutorialState(JSON.stringify({ version: 1, step: 'score', paused: false, completed: false })), null);
});

test('storage is account scoped and step order completes', () => {
  assert.notEqual(tutorialStorageKey('user-a'), tutorialStorageKey('user-b'));
  assert.equal(nextTutorialStep('score'), 'deductions');
  assert.equal(nextTutorialStep('deductions'), 'rewrite');
  assert.equal(nextTutorialStep('rewrite'), 'complete');
  assert.equal(nextTutorialStep('complete'), 'complete');
});

test('legacy trial usage derives first-use state from the remaining count', () => {
  assert.deepEqual(
    deriveTrialUsage({ usageCount: null, usageLimit: null, remainingCount: 5, fallbackLimit: 5 }),
    { count: 0, limit: 5, remaining: 5 },
  );
  assert.deepEqual(
    deriveTrialUsage({ usageCount: null, usageLimit: null, remainingCount: 4, fallbackLimit: 5 }),
    { count: 1, limit: 5, remaining: 4 },
  );
});
