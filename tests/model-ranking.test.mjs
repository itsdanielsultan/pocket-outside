import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cosineSimilarity,
  prepareRecords,
  rankEmbeddings,
  validateOptions,
  validateQuery,
  rank,
} from '../lib/semantic.js';

test('cosine compares direction, including scaled, orthogonal and opposite vectors', () => {
  assert.equal(cosineSimilarity([1, 0], [8, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([1, 0], [-1, 0]), -1);
  assert.ok(Math.abs(cosineSimilarity([1, 1], [1, 0]) - 1 / Math.sqrt(2)) < 1e-12);
});

test('bad embeddings cannot silently produce fabricated rankings', () => {
  for (const [a, b] of [[[], []], [[0, 0], [1, 0]], [[1], [1, 2]], [[NaN], [1]], [[Infinity], [1]]]) {
    assert.throws(() => cosineSimilarity(a, b), TypeError);
  }
});

test('rankings use model-vector cosine; tag and ID filters are hard constraints', () => {
  const records = [
    { id: 'lake', tags: ['waterfront', 'walk'] },
    { id: 'forest', tags: ['woods', 'walk'] },
    { id: 'garden', tags: ['garden'] },
  ];
  const embeddings = [[1, 0], [0.8, 0.6], [0, 1]];
  assert.deepEqual(rankEmbeddings([1, 0], records, embeddings), [
    { id: 'lake', score: 1 }, { id: 'forest', score: 0.8 }, { id: 'garden', score: 0 },
  ]);
  assert.deepEqual(rankEmbeddings([1, 0], records, embeddings, { filters: { tags: ['woods'] } }),
    [{ id: 'forest', score: 0.8 }]);
  assert.deepEqual(rankEmbeddings([1, 0], records, embeddings, { filters: { ids: ['garden'] } }),
    [{ id: 'garden', score: 0 }]);
  assert.deepEqual(rankEmbeddings([1, 0], records, embeddings, { filters: { tags: ['unverified-facility'] } }), []);
});

test('equal scores preserve source order; limits and empty candidate pools are deterministic', () => {
  const records = [{ id: 'b', tags: [] }, { id: 'a', tags: [] }];
  assert.deepEqual(rankEmbeddings([1, 0], records, [[1, 0], [1, 0]], { limit: 1 }), [{ id: 'b', score: 1 }]);
  assert.deepEqual(rankEmbeddings([1, 0], [], []), []);
  assert.throws(() => rankEmbeddings([1], records, [[1]]), TypeError);
});

test('records must have unique IDs and usable supplied descriptions', () => {
  assert.deepEqual(prepareRecords([{ id: ' park ', name: 'Park', description: 'Lakeside path.', tags: ['walk', 'walk'] }]),
    [{ id: 'park', text: 'Park. Lakeside path.. walk', tags: ['walk'] }]);
  assert.equal(prepareRecords([{ id: 'park', embeddingText: 'Verified description', tags: [] }])[0].text,
    'Verified description');
  assert.throws(() => prepareRecords([]), TypeError);
  assert.throws(() => prepareRecords([{ id: 'a' }]), TypeError);
  assert.throws(() => prepareRecords([{ id: 'a', name: 'Park' }, { id: 'a', name: 'Other park' }]), /Duplicate/);
});

test('input and filter mistakes are explicit; unloaded model cannot pretend to search', async () => {
  assert.equal(validateQuery('  lake walk  '), 'lake walk');
  for (const query of ['', '  ', null, 'x'.repeat(401)]) assert.throws(() => validateQuery(query), TypeError);
  assert.throws(() => validateOptions({ filters: { accessible: true } }), /Unsupported filter/);
  assert.throws(() => validateOptions({ filters: { tags: 'waterfront' } }), TypeError);
  assert.throws(() => validateOptions({ limit: 0 }), TypeError);
  await assert.rejects(rank('lake walk'), /Load the matching model/);
});
