# Pocket Outside model

Pocket Outside embeds a user's outing description and eight manually sourced park descriptions, then sorts their cosine similarities. Its AI component is an actual sentence embedding model. It does not generate facts, infer access conditions, calculate routes or estimate travel time. A score measures textual similarity, not confidence that a park will meet someone's needs.

## Pinned implementation

- Package: `@huggingface/transformers` **3.8.1**, Apache-2.0. This version's published documentation and demonstrated MiniLM recipe match the tested implementation.
- Model: [`Xenova/all-MiniLM-L6-v2`](https://huggingface.co/Xenova/all-MiniLM-L6-v2), Apache-2.0. ONNX conversion of [`sentence-transformers/all-MiniLM-L6-v2`](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2), also Apache-2.0.
- Revision: `751bff37182d3f1213fa05d7196b954e230abad9`.
- Pipeline: `feature-extraction`, `device: 'wasm'`, `dtype: 'q8'`; `pooling: 'mean'`, `normalize: true`; 384 values per embedding.
- Model file: `onnx/model_quantized.onnx`, **22,972,370 bytes** (about 23 MB), SHA-256 `afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1`.
- Model configuration and tokenizer add roughly 0.713 MB. The WASM runtime from the pinned package adds **21,596,019 bytes**, plus its 44,484-byte loader and the application bundles. The first download is therefore roughly **45–50 MB**, rather than only the 23 MB weights.

The alternative [`onnx-community/all-MiniLM-L6-v2-ONNX`](https://huggingface.co/onnx-community/all-MiniLM-L6-v2-ONNX) is Apache-2.0 as well. Its current conversion lacks a q8 file and offers split fp16/q4 weights. The official [3.8.1 pipeline documentation](https://huggingface.co/docs/transformers.js/v3.8.1/en/pipelines) explicitly demonstrates Xenova MiniLM. This version uses its smaller established q8 conversion for CPU compatibility.

Install using `npm install --save-exact @huggingface/transformers@3.8.1`. A Vite build resolves the module Worker in `lib/semantic.js`; no application server, inference API, key, account or paid service is involved.

## Integration

```js
import { init, rank, dispose } from './lib/semantic.js';

await init(parks, (progress) => {
  // phase: download / index / ready
  // downloads may also include file, status, progress, loaded and total
});
const matches = await rank('A quiet walk among trees', {
  filters: { tags: ['forest'] }, // all required tags must match verified records
  limit: 3,
});
// [{ id: 'park-id', score: 0.42 }, ...]
// Optional: dispose() cancels pending work and frees the Worker.
```

Each record needs a unique `id`, `embeddingText` (or `semanticText`) and a string array `tags`. Without supplied embedding text, name, description and tags form the model input. Optional `filters.ids` restricts candidates to known IDs. Empty filtered results stay empty. Unsupported filters, malformed vectors, an unloaded model or a failed download throw explicit errors; there is no fake or keyword-ranking fallback.

## Privacy, network and offline limits

Inference runs in a module Worker on the visitor's CPU, using one WASM thread. This avoids a cross-origin isolation requirement. The query and resulting embeddings remain in browser memory; this module does not log, save or send them. The initial public weight/configuration/tokenizer requests go to Hugging Face and its file hosting infrastructure; runtime requests go to jsDelivr. Those hosts receive ordinary network metadata such as the requester's IP address.

Transformers.js uses the browser Cache API for downloaded model assets where available. Browser storage can be cleared, blocked or evicted. The WASM loader/runtime and application files also need to be available. This build does not yet promise a fully offline reload or provide a service worker; users should load the app and model while online, then use its printed outing card outside. See the official [custom usage documentation](https://huggingface.co/docs/transformers.js/v3.8.1/en/custom_usage) and [environment reference](https://huggingface.co/docs/transformers.js/v3.8.1/en/api/env).

Retain package/model attribution and their Apache-2.0 notices in a distributed repository. The app's own licence does not replace dependency or model licences. Model weights are downloaded from their publisher; they are not copied into this repository.

## Verification status

The six Node tests exercise cosine mathematics, hard filters, stable ordering and error contracts with synthetic vectors. A separate October9 browser run used the actual downloaded model and selected Riverwood, Kariya Park and Rattray Marsh for the three corresponding test requests recorded in README.md. This confirms live inference for those cases; it does not establish an accuracy percentage or outdoor field results. Source licences, the pinned revision, file sizes and package version were read from publishers' records on October9,2026.
