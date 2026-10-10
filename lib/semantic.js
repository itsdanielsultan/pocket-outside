// Browser-only semantic matching. No query is sent to a model service.
import { prepareRecords, validateOptions, validateQuery } from './semantic-core.js';
export * from './semantic-core.js';

let worker = null;
let nextMessageId = 1;
let ready = false;
let progressCallback = null;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  if (typeof Worker === 'undefined') throw new Error('This browser does not support background model processing.');
  worker = new Worker(new URL('./semantic-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (data.type === 'progress') {
      progressCallback?.(data.progress);
      return;
    }
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    if (data.type === 'error') request.reject(new Error(data.message));
    else request.resolve(data.result);
  };
  worker.onerror = () => dispose('The model worker stopped. Please retry the download.');
  worker.onmessageerror = () => dispose('The model response could not be read. Please retry.');
  return worker;
}

function request(type, payload) {
  const currentWorker = getWorker();
  const id = nextMessageId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    try {
      currentWorker.postMessage({ id, type, ...payload });
    } catch (error) {
      pending.delete(id);
      reject(error);
    }
  });
}

export async function init(records, onProgress = () => {}) {
  const prepared = prepareRecords(records);
  if (typeof onProgress !== 'function') throw new TypeError('The progress callback must be a function.');
  ready = false;
  progressCallback = onProgress;
  const result = await request('init', { records: prepared });
  ready = true;
  return result;
}

export async function rank(query, options = {}) {
  const text = validateQuery(query);
  const checkedOptions = validateOptions(options);
  if (!ready) throw new Error('Load the matching model before searching.');
  return request('rank', { query: text, options: checkedOptions });
}

export function dispose(reason = 'Model loading was cancelled.') {
  worker?.terminate();
  worker = null;
  ready = false;
  progressCallback = null;
  for (const { reject } of pending.values()) reject(new Error(reason));
  pending.clear();
}
