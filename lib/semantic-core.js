export const MODEL_INFO = Object.freeze({
  id: 'Xenova/all-MiniLM-L6-v2',
  revision: '751bff37182d3f1213fa05d7196b954e230abad9',
  dtype: 'q8',
  libraryVersion: '3.8.1',
  license: 'Apache-2.0',
  dimensions: 384,
  modelBytes: 22972370,
});

export function cosineSimilarity(left, right) {
  if (!left || !right || !left.length || left.length !== right.length) {
    throw new TypeError('Embedding vectors must have the same non-zero length.');
  }
  let dot = 0;
  let leftSquared = 0;
  let rightSquared = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      throw new TypeError('Embedding vectors must contain finite numbers.');
    }
    dot += a * b;
    leftSquared += a * a;
    rightSquared += b * b;
  }
  if (!leftSquared || !rightSquared) {
    throw new TypeError('Embedding vectors cannot be zero vectors.');
  }
  return Math.max(-1, Math.min(1, dot / Math.sqrt(leftSquared * rightSquared)));
}

export function validateQuery(query) {
  if (typeof query !== 'string' || !query.trim()) {
    throw new TypeError('Describe what you would like to do outside.');
  }
  if (query.length > 400) {
    throw new TypeError('Keep your description to 400 characters or fewer.');
  }
  return query.trim();
}

function stringList(value, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new TypeError(`${label} must be an array of non-empty strings.`);
  }
  return [...new Set(value.map((item) => item.trim()))];
}

export function prepareRecords(records) {
  if (!Array.isArray(records) || !records.length) {
    throw new TypeError('At least one park record is required.');
  }
  const seen = new Set();
  return records.map((record) => {
    if (!record || typeof record.id !== 'string' || !record.id.trim()) {
      throw new TypeError('Every park needs a non-empty string ID.');
    }
    const id = record.id.trim();
    if (seen.has(id)) throw new TypeError(`Duplicate park ID: ${id}`);
    seen.add(id);
    const tags = stringList(record.tags ?? record.features, 'Park tags');
    const suppliedText = record.embeddingText ?? record.semanticText;
    const text = suppliedText ?? [record.name, record.description, ...tags]
      .filter((item) => typeof item === 'string' && item.trim()).join('. ');
    if (typeof text !== 'string' || !text.trim()) {
      throw new TypeError(`Park ${id} needs a description for the model.`);
    }
    if (text.length > 1600) throw new TypeError(`Park ${id}'s model description is too long.`);
    return { id, text: text.trim(), tags };
  });
}

export function validateOptions(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Ranking options must be an object.');
  }
  const filters = options.filters ?? {};
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    throw new TypeError('Filters must be an object.');
  }
  const unsupported = Object.keys(filters).filter((key) => !['ids', 'tags'].includes(key));
  if (unsupported.length) throw new TypeError(`Unsupported filter: ${unsupported.join(', ')}`);
  const ids = stringList(filters.ids, 'Park IDs');
  const tags = stringList(filters.tags, 'Required tags');
  const limit = options.limit ?? 3;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new TypeError('Result limit must be an integer from 1 to 50.');
  }
  return { filters: { ids, tags }, limit };
}

// Deterministic ranking is independently testable; its vectors come from the real model.
export function rankEmbeddings(queryVector, records, embeddings, options = {}) {
  const { filters, limit } = validateOptions(options);
  if (!Array.isArray(records) || !Array.isArray(embeddings) || records.length !== embeddings.length) {
    throw new TypeError('Park records and embeddings must have matching lengths.');
  }
  return records.map((record, index) => ({ record, vector: embeddings[index], index }))
    .filter(({ record }) => (!filters.ids.length || filters.ids.includes(record.id))
      && filters.tags.every((tag) => record.tags.includes(tag)))
    .map(({ record, vector, index }) => ({ id: record.id, score: cosineSimilarity(queryVector, vector), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ id, score }) => ({ id, score }));
}
