import assert from 'node:assert/strict';
import test from 'node:test';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const { prepareFilesForUpload } = await jiti.import('./uploadPreparation.ts');

const MIB = 1024 * 1024;
const clientTotalLimit = 4.2 * MIB;
const fullPipelineLimit = 1.4 * MIB;

const file = (name, type, size) => ({ name, type, size });

function dependencies({ compress = async (files) => files, extract = async (source) => ({ file: source }) } = {}) {
  return {
    compressMultipleImages: compress,
    extractPdfPages: extract,
    isImageFile: (source) => source.type.startsWith('image/'),
  };
}

test('auto role keeps every PDF page even when page input exists', async () => {
  const source = file('all-pages.pdf', 'application/pdf', 100);
  let extractionCalls = 0;
  const result = await prepareFilesForUpload(
    [source],
    {
      fileRoles: { 0: 'auto' },
      pdfPageInfo: { answerPage: '2-3' },
    },
    { current: null },
    dependencies({
      extract: async () => {
        extractionCalls += 1;
        return { file: file('unexpected.pdf', 'application/pdf', 1) };
      },
    })
  );

  assert.equal(extractionCalls, 0);
  assert.equal(result[0], source);
});

test('manual roles send their merged, normalized page selection to PDF extraction', async () => {
  const source = file('combined.pdf', 'application/pdf', 100);
  const calls = [];
  const extracted = file('combined-pages.pdf', 'application/pdf', 50);
  const result = await prepareFilesForUpload(
    [source],
    {
      fileRoles: { 0: 'all' },
      pdfPageInfo: {
        answerPage: '3, 1-2',
        problemPage: '2,4',
        modelAnswerPage: '4-5',
      },
    },
    { current: null },
    dependencies({
      extract: async (input, pages) => {
        calls.push({ input, pages });
        return { file: extracted };
      },
    })
  );

  assert.deepEqual(calls, [{ input: source, pages: [1, 2, 3, 4, 5] }]);
  assert.deepEqual(result, [extracted]);
});

test('cache is reused only for identical File references, roles, and page input', async () => {
  const firstSource = file('answer.pdf', 'application/pdf', 100);
  const secondSource = file('answer.pdf', 'application/pdf', 100);
  const cache = { current: null };
  let extractionCalls = 0;
  const deps = dependencies({
    extract: async (source, pages) => {
      extractionCalls += 1;
      return { file: file(`${source.name}-${pages.join('-')}`, 'application/pdf', 50) };
    },
  });
  const options = { fileRoles: { 0: 'answer' }, pdfPageInfo: { answerPage: '1' } };

  const first = await prepareFilesForUpload([firstSource], options, cache, deps);
  const repeated = await prepareFilesForUpload([firstSource], options, cache, deps);
  await prepareFilesForUpload(
    [firstSource],
    { fileRoles: { 0: 'answer' }, pdfPageInfo: { answerPage: '2' } },
    cache,
    deps
  );
  await prepareFilesForUpload(
    [firstSource],
    { fileRoles: { 0: 'problem' }, pdfPageInfo: { problemPage: '2' } },
    cache,
    deps
  );
  await prepareFilesForUpload([secondSource], options, cache, deps);

  assert.equal(first, repeated);
  assert.equal(extractionCalls, 4);
});

test('compression follows the 4.2MB and 1.4MB boundary conditions', async () => {
  const exactClientBudget = [
    file('answer.jpg', 'image/jpeg', 1),
    file('source.pdf', 'application/pdf', clientTotalLimit),
  ];
  const atFullPipelineThreshold = [file('answer.jpg', 'image/jpeg', fullPipelineLimit)];
  const overFullPipelineThreshold = [file('answer.jpg', 'image/jpeg', fullPipelineLimit + 1)];
  const imageOverRemainingBudget = [
    file('answer.jpg', 'image/jpeg', 3.3 * MIB),
    file('source.pdf', 'application/pdf', 1 * MIB),
  ];
  let compressionCalls = 0;
  const deps = dependencies({
    compress: async (files) => {
      compressionCalls += 1;
      return files;
    },
  });
  const options = { fileRoles: {}, pdfPageInfo: {} };

  await prepareFilesForUpload(exactClientBudget, options, { current: null }, deps);
  await prepareFilesForUpload(atFullPipelineThreshold, options, { current: null }, deps);
  await prepareFilesForUpload(overFullPipelineThreshold, options, { current: null }, deps);
  await prepareFilesForUpload(imageOverRemainingBudget, options, { current: null }, deps);

  assert.equal(compressionCalls, 2);
});

test('compression failure returns the original files', async () => {
  const source = file('answer.jpg', 'image/jpeg', fullPipelineLimit + 1);
  const originalError = console.error;
  console.error = () => {};
  try {
    const result = await prepareFilesForUpload(
      [source],
      { fileRoles: {}, pdfPageInfo: {} },
      { current: null },
      dependencies({
        compress: async () => {
          throw new Error('compression failed');
        },
      })
    );

    assert.equal(result[0], source);
  } finally {
    console.error = originalError;
  }
});
