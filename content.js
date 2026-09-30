(() => {
  // TRACKS comes from tracks.js, loaded first in the manifest.
  const find = (file) => TRACKS.find(t => t.file === file);

  // sounds maps a file to 'playing' or 'paused'. A file missing from it is idle.
  const state = { volume: 1, sounds: {} };

  const pushVolume = () =>
    window.postMessage({ type: 'MUSIC_VOLUME', volume: state.volume }, '*');

  chrome.storage.local.get(['volume'], (stored) => {
    if (typeof stored?.volume === 'number') state.volume = stored.volume;
    pushVolume();
  });

  // The slider fires on every drag step: push the sound immediately,
  // but only write to storage once the dragging settles.
  let saveTimer = null;
  function saveVolume() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => chrome.storage.local.set({ volume: state.volume }), 300);
  }

  // inject.js reports a sound that finished on its own (or failed to start).
  window.addEventListener('message', (e) => {
    if (e.source !== window || e.data?.type !== 'MUSIC_ENDED') return;
    if (!chrome.runtime?.id) return;  // orphaned by an extension reload
    delete state.sounds[e.data.file];
    // Refresh the popup if it is open. With no popup there is no receiver.
    chrome.runtime.sendMessage({ type: 'STATE', state }).catch(() => {});
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'GET_STATE') {
      sendResponse(state);
      return;
    }

    // A button press plays an idle sound, pauses a playing one
    // and resumes a paused one.
    if (msg?.type === 'PRESS') {
      const sound = find(msg.file);
      if (sound && state.sounds[sound.file] === 'playing') {
        state.sounds[sound.file] = 'paused';
        window.postMessage({ type: 'MUSIC_PAUSE', file: sound.file }, '*');
      } else if (sound) {
        state.sounds[sound.file] = 'playing';
        window.postMessage({
          type: 'MUSIC_PLAY',
          file: sound.file,
          url: chrome.runtime.getURL('music/' + sound.file),
          loop: !!sound.loop
        }, '*');
      }
      sendResponse(state);
      return;
    }

    if (msg?.type === 'VOLUME') {
      state.volume = msg.volume;
      pushVolume();
      saveVolume();
      sendResponse(state);
    }
  });
})();
