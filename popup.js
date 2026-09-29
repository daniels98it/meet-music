// TRACKS comes from tracks.js, loaded first in popup.html.
const trackSelect = document.getElementById('track');
const toggle = document.getElementById('toggle');
const iconPlay = document.getElementById('iconPlay');
const iconPause = document.getElementById('iconPause');
const stateLabel = document.getElementById('stateLabel');
const volume = document.getElementById('volume');
const volumeValue = document.getElementById('volumeValue');
const statusEl = document.getElementById('status');  // not `status`: that shadows window.status

let tabId = null;

for (const t of TRACKS) {
  const opt = document.createElement('option');
  opt.value = t.file;
  opt.textContent = t.label;
  trackSelect.appendChild(opt);
}

function render(state) {
  trackSelect.value = state.track;
  iconPlay.hidden = state.on;
  iconPause.hidden = !state.on;
  toggle.setAttribute('aria-label', state.on ? 'Pause' : 'Play');
  stateLabel.textContent = state.on ? 'Playing' : 'Paused';
  volume.value = Math.round(state.volume * 100);
  volumeValue.textContent = volume.value + '%';
  trackSelect.disabled = false;
  toggle.disabled = false;
  volume.disabled = false;
  statusEl.textContent = '';
}

const MEET_URL = 'https://meet.google.com/';

function unavailable(message, hintText) {
  trackSelect.disabled = true;
  toggle.disabled = true;
  volume.disabled = true;
  statusEl.textContent = message;
  if (hintText) {
    const hint = document.createElement('span');
    hint.id = 'hint';
    hint.textContent = hintText;
    statusEl.appendChild(hint);
  }
}

const notOnMeet = () => unavailable('Open a Google Meet tab to use Meet Music.');
const notReachable = () =>
  unavailable('Meet Music could not reach this tab.', 'Reload the Meet tab and try again.');

function send(msg) {
  if (tabId === null) return;
  chrome.tabs.sendMessage(tabId, msg, (state) => {
    if (chrome.runtime.lastError || !state) return notReachable();
    render(state);
  });
}

// After the extension is reloaded, the content script in an already-open
// Meet tab is orphaned and no longer answers. Re-inject it instead of
// asking the user to reload the tab. inject.js guards against double
// patching, so injecting it again is harmless.
async function reinject() {
  await chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN', files: ['inject.js']
  });
  await chrome.scripting.executeScript({
    target: { tabId }, files: ['tracks.js', 'content.js']
  });
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (!tab || tab.id === undefined) return notOnMeet();
  if (!tab.url || !tab.url.startsWith(MEET_URL)) return notOnMeet();
  tabId = tab.id;
  chrome.tabs.sendMessage(tabId, { type: 'GET_STATE' }, (state) => {
    if (!chrome.runtime.lastError && state) return render(state);
    reinject().then(() => send({ type: 'GET_STATE' }), (err) => {
      console.warn('[meet-music]', err);
      notReachable();
    });
  });
});

toggle.addEventListener('click', () => send({ type: 'TOGGLE' }));

trackSelect.addEventListener('change', () =>
  send({ type: 'TRACK', file: trackSelect.value })
);

volume.addEventListener('input', () => {
  volumeValue.textContent = volume.value + '%';
  send({ type: 'VOLUME', volume: Number(volume.value) / 100 });
});
