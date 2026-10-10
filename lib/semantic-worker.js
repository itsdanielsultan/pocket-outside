import { env, pipeline } from '@huggingface/transformers';
import { MODEL_INFO, rankEmbeddings } from './semantic-core.js';

// Single-thread WASM works without SharedArrayBuffer or special deployment headers.
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
env.backends.onnx.wasm.wasmPaths =
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/';

let extractorPromise = null;
let records = [];
let vectors = [];
let queue = Promise.resolve();

function progress(value) {
  self.postMessage({ type: 'progress', progress: value });
}

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', MODEL_INFO.id, {
      revision: MODEL_INFO.revision,
      dtype: MODEL_INFO.dtype,
      device: 'wasm',
      progress_callback: (value) => progress({ phase: 'download', ...value }),
    }).catch((error) => {
      extractorPromise = null;
      throw error;
    });
  }
  return extractorPromise;
}

async function embed(text) {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  if (output.data.length !== MODEL_INFO.dimensions) {
    throw new Error('The model returned an unexpected embedding shape.');
  }
  const vector = Array.from(output.data);
  if (vector.some((value) => !Number.isFinite(value))) {
    throw new Error('The model returned an invalid embedding.');
  }
  return vector;
}

async function handle(message) {
  if (message.type === 'init') {
    // Publish a new index only after every embedding has succeeded.
    const nextRecords = message.records;
    const nextVectors = [];
    records = [];
    vectors = [];
    await getExtractor();
    for (let index = 0; index < nextRecords.length; index += 1) {
      nextVectors.push(await embed(nextRecords[index].text));
      progress({ phase: 'index', completed: index + 1, total: nextRecords.length });
    }
    records = nextRecords;
    vectors = nextVectors;
    progress({ phase: 'ready', completed: records.length, total: records.length });
    return { model: MODEL_INFO, recordCount: records.length };
  }
  if (message.type === 'rank') {
    if (!records.length) throw new Error('The park index is not ready.');
    const queryVector = await embed(message.query);
    return rankEmbeddings(queryVector, records, vectors, message.options);
  }
  throw new Error('Unknown model request.');
}

self.onmessage = ({ data }) => {
  // Prevent concurrent model calls from sharing a partially initialized index.
  queue = queue.then(async () => {
    try {
      const result = await handle(data);
      self.postMessage({ id: data.id, type: 'result', result });
    } catch (error) {
      self.postMessage({
        id: data.id,
        type: 'error',
        message: error instanceof Error ? error.message : 'Model loading failed. Please retry.',
      });
    }
  });
};
