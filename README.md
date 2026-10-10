# Pocket Outside

Describe a small outdoor break, choose a Mississauga park, and print a short plan with its official source. The screen is a starting point for going outside.

This is a new project built during the October 5–11, 2026 Touch Grass challenge window. Development began October 9. It uses eight manually checked park descriptions and a small open model running in a browser Worker. The model matches the meaning of a request to those descriptions; all displayed park facts and activities come from the checked records, not generated text.

## Run

Use Node 22.12 or newer, then:

```sh
npm ci
npm run dev
```

For a production build:

```sh
npm test
npm run build
npm run preview
```

The production output is `dist/`, suitable for static hosting. No API key, paid inference service or application server is needed. First model use downloads approximately 45–50 MB. Load the tool while online and take the printed plan outside; a fully offline reload is not promised.

## Checked in the browser

Real MiniLM inference selected Riverwood for a trees-and-river request, Kariya Park for a Japanese-garden request and Rattray Marsh for a wetland-boardwalk request. These are individual test cases, not accuracy percentages or evidence of outdoor use. Manual park selection, duration changes, empty-input handling, source links, the mobile layout and one-page printing were also checked.

The Erindale island-bridge closure is visible on its plan. Park access, conditions and seasonal features can change. The time choice shapes an activity; it is not a route or travel-time estimate. No route is rated for accessibility.

## Model and privacy

The app uses `@huggingface/transformers@3.8.1` and the pinned q8 `Xenova/all-MiniLM-L6-v2` model. See [MODEL.md](MODEL.md) for the revision, licences and first-download limits.

Descriptions and their embeddings stay in browser memory. The app has no analytics, account, bank connection or query endpoint. Initial public downloads go to Hugging Face and jsDelivr, which receive ordinary network metadata. The app does not upload its visitor's query to those services.

## Sources and licences

City of Mississauga and Credit Valley Conservation pages are linked in [data/parks.json](data/parks.json). Records contain short original factual summaries and original suggested activities; no source photographs, drawings or map layers are included. Third-party source materials retain their rights.

App code is MIT licensed. Model and Transformers.js use Apache-2.0. Bricolage Grotesque is bundled under its [SIL Open Font License](public/fonts/OFL.txt). These separate licences are preserved.

Built with Codex assistance. No private chat history, personal photos, credentials or agent sessions are included.
