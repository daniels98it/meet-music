// TRACKS comes from tracks.js, loaded first in popup.html.
const pads = document.getElementById('pads');
const padTemplate = document.getElementById('padTemplate');
const volume = document.getElementById('volume');
const volumeValue = document.getElementById('volumeValue');
const statusEl = document.getElementById('status');  // not `status`: that shadows window.status

let tabId = null;

const buttons = new Map();  // file -> its button
for (const t of TRACKS) {
  const btn = padTemplate.content.firstElementChild.cloneNode(true);
  btn.querySelector('.name').textContent = t.label;
  let hitTimer = null;
  btn.addEventListener('click', () => {
    btn.classList.add('hit');
    clearTimeout(hitTimer);
    hitTimer = setTimeout(() => btn.classList.remove('hit'), 150);
    send({ type: 'PRESS', file: t.file });
  });
  buttons.set(t.file, btn);
  pads.appendChild(btn);
}

function render(state) {
  for (const [file, btn] of buttons) {
    const playState = state.sounds[file] || 'idle';  // or 'playing', 'paused'
    btn.dataset.state = playState;
    btn.setAttribute('aria-pressed', String(playState === 'playing'));
    btn.disabled = false;
  }
  volume.value = Math.round(state.volume * 100);
  volumeValue.textContent = volume.value + '%';
  volume.disabled = false;
  statusEl.textContent = '';
}

const MEET_URL = 'https://meet.google.com/';

function unavailable(message, hintText) {
  for (const btn of buttons.values()) btn.disabled = true;
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

// content.js pushes the state when a sound finishes while the popup is open.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === 'STATE' && sender.tab?.id === tabId) render(msg.state);
});

volume.addEventListener('input', () => {
  volumeValue.textContent = volume.value + '%';
  send({ type: 'VOLUME', volume: Number(volume.value) / 100 });
});
