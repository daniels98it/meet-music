(() => {
  // TRACKS and DEFAULT_TRACK come from tracks.js, loaded first in the manifest.
  const known = (file) => TRACKS.some(t => t.file === file);

  const state = { on: false, volume: 1, track: DEFAULT_TRACK };

  const pushVolume = () =>
    window.postMessage({ type: 'MUSIC_VOLUME', volume: state.volume }, '*');

  const pushSrc = () => window.postMessage({
    type: 'MUSIC_SRC',
    url: chrome.runtime.getURL('music/' + state.track)
  }, '*');

  chrome.storage.local.get(['volume', 'track'], (stored) => {
    if (typeof stored?.volume === 'number') state.volume = stored.volume;
    if (known(stored?.track)) state.track = stored.track;
    pushVolume();
    pushSrc();
  });

  // The slider fires on every drag step: push the sound immediately,
  // but only write to storage once the dragging settles.
  let saveTimer = null;
  function saveVolume() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => chrome.storage.local.set({ volume: state.volume }), 300);
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'GET_STATE') {
      sendResponse(state);
      return;
    }

    if (msg?.type === 'TOGGLE') {
      state.on = !state.on;
      window.postMessage({ type: 'MUSIC_TOGGLE', on: state.on }, '*');
      sendResponse(state);
      return;
    }

    if (msg?.type === 'VOLUME') {
      state.volume = msg.volume;
      pushVolume();
      saveVolume();
      sendResponse(state);
      return;
    }

    if (msg?.type === 'TRACK') {
      if (known(msg.file)) {
        state.track = msg.file;
        chrome.storage.local.set({ track: state.track });
        pushSrc();
      }
      sendResponse(state);
    }
  });
})();
