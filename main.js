import parks from './data/parks.json';
import { init, rank, dispose, validateQuery } from './lib/semantic.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const parkById = new Map(parks.map((park) => [park.id, park]));
let selected = 'erindale';
let otherIds = ['riverwood', 'jack-darling', 'kariya'];
let ready = false;
let busy = false;

function sourceNote(container, text) {
  container.replaceChildren();
  const pieces = text.split(/(https:\/\/[^\s]+)/g);
  for (const piece of pieces) {
    if (piece.startsWith('https://')) {
      const link = document.createElement('a');
      link.href = piece;
      link.textContent = 'current access notice';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      container.append(link);
    } else container.append(document.createTextNode(piece));
  }
}

function renderPlan(id, focus = false) {
  const park = parkById.get(id);
  if (!park) throw new Error('That park is not in the checked list.');
  selected = id;
  $('park-name').textContent = park.name;
  $('park-description').textContent = park.description;
  $('activity-first').textContent = park.suggestedActivity;
  $('activity-heading').textContent = `A simple ${$('time').value}-minute break`;
  $('official').href = park.sourceUrl;
  $('official').title = park.sourceTitle;
  $('park-plan').dataset.source = park.sourceUrl;
  $('checked').textContent = `Source facts checked ${new Date(`${park.checkedDate}T12:00:00`).toLocaleDateString('en-CA', { day: 'numeric', month: 'long', year: 'numeric' })}.`;
  sourceNote($('source-notes'), park.sourceNotes);
  // The bridge closure must be visible rather than hidden behind a disclosure.
  $('access-notes').open = id === 'erindale';
  if (focus) $('park-plan').focus({ preventScroll: true });
}

function renderAlternatives() {
  $('other-places').replaceChildren();
  for (const id of otherIds.filter((id) => id !== selected)) {
    const park = parkById.get(id);
    if (!park) continue;
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'place-row';
    const text = document.createElement('span');
    text.textContent = park.name;
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrow.setAttribute('viewBox', '0 0 20 20');
    arrow.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'm7 4 6 6-6 6');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    arrow.append(path);
    button.append(text, arrow);
    button.addEventListener('click', () => {
      const previous = selected;
      renderPlan(id, true);
      otherIds = [previous, ...otherIds.filter((other) => other !== id)].slice(0, 3);
      renderAlternatives();
      $('status').textContent = 'Place selected. You can print the plan or check the official page.';
    });
    li.append(button);
    $('other-places').append(li);
  }
}

function progress(update) {
  if (update.phase === 'index') {
    $('status').textContent = `Preparing the checked places (${update.completed}/${update.total})…`;
  } else if (update.phase === 'download') {
    const percent = Number.isFinite(update.progress) ? ` ${Math.floor(update.progress)}%` : '';
    $('status').textContent = `Loading the matching model${percent}… First use downloads about 50 MB.`;
  }
}

$('match-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy) return;
  let query;
  try { query = validateQuery($('preference').value); }
  catch (error) {
    $('status').textContent = error.message;
    $('preference').focus();
    return;
  }
  busy = true;
  $('find').disabled = true;
  $('find').textContent = 'Finding a place…';
  $('status').textContent = ready ? 'Matching in this browser…' : 'Loading the matching model…';
  $('park-plan').setAttribute('aria-busy', 'true');
  try {
    if (!ready) {
      await init(parks, progress);
      ready = true;
    }
    const matches = await rank(query, { limit: 4 });
    if (!matches.length) throw new Error('No place matched. Choose one from the list instead.');
    renderPlan(matches[0].id, true);
    otherIds = matches.slice(1).map((match) => match.id);
    renderAlternatives();
    $('status').textContent = 'Matched in your browser. Check the access notes, then take the plan with you.';
  } catch (error) {
    ready = false;
    dispose();
    $('status').textContent = 'Matching could not load. You can still choose a place from the list and print its checked information. Try again when connected.';
    console.error('Local matching failed:', error);
  } finally {
    busy = false;
    $('find').disabled = false;
    $('find').textContent = 'Find a place.';
    $('park-plan').removeAttribute('aria-busy');
  }
});

$('time').addEventListener('change', () => renderPlan(selected));
$('print').addEventListener('click', () => window.print());
let accessWasOpen = false;
window.addEventListener('beforeprint', () => {
  accessWasOpen = $('access-notes').open;
  $('access-notes').open = true;
});
window.addEventListener('afterprint', () => {
  $('access-notes').open = accessWasOpen;
});
$('about-link').addEventListener('click', (event) => {
  event.preventDefault();
  $('about').hidden = false;
  $('about-heading').tabIndex = -1;
  $('about-heading').focus();
  $('about').scrollIntoView({ behavior: 'instant', block: 'start' });
});
$('close-about').addEventListener('click', () => {
  $('about').hidden = true;
  $('about-link').focus();
});

renderPlan(selected);
renderAlternatives();
