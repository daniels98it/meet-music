(() => {
  // The popup may re-inject this after an extension reload; never patch twice.
  if (window.__meetMusicInjected) return;
  window.__meetMusicInjected = true;

  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  const CALL_BASE = 0.15;   // what the meeting hears
  const LOCAL_BASE = 0.35;  // what you hear
  let ctx, mix, callGain, localGain;
  let volume = 1;
  const players = new Map();  // file -> its Audio element, made on first play

  function build() {
    if (ctx) return;
    ctx = new AudioContext();
    mix = ctx.createMediaStreamDestination();

    callGain = ctx.createGain();  callGain.gain.value  = CALL_BASE * volume;
    localGain = ctx.createGain(); localGain.gain.value = LOCAL_BASE * volume;

    callGain.connect(mix);              // -> the call
    localGain.connect(ctx.destination); // -> your speakers
  }

  const ended = (file) => window.postMessage({ type: 'MUSIC_ENDED', file }, '*');

  // Every sound feeds the same two gains, so several can play at once.
  function player(file, url) {
    let el = players.get(file);
    if (el) return el;
    el = new Audio();
    el.crossOrigin = 'anonymous';  // extension URL is cross-origin to meet.google.com
    el.src = url;
    el.addEventListener('ended', () => ended(file));
    const src = ctx.createMediaElementSource(el);
    src.connect(callGain);
    src.connect(localGain);
    players.set(file, el);
    return el;
  }

  async function patched(c) {
    const stream = await orig(c);
    if (!c || !c.audio) return stream;
    try {
      build();
      ctx.createMediaStreamSource(stream).connect(mix);
      stream.getVideoTracks().forEach(t => mix.stream.addTrack(t));
      console.info('[meet-music] mic intercepted, returning mixed stream');
      return mix.stream;
    } catch (e) {
      console.warn('[meet-music]', e);
      return stream; // never break joining a call
    }
  }

  // Patch both the instance and the prototype, so a call through
  // MediaDevices.prototype.getUserMedia is intercepted too.
  navigator.mediaDevices.getUserMedia = patched;
  MediaDevices.prototype.getUserMedia = patched;
  console.info('[meet-music] getUserMedia patched');

  window.addEventListener('message', (e) => {
    if (e.source !== window) return;

    if (e.data?.type === 'MUSIC_VOLUME') {
      volume = e.data.volume;
      if (ctx) {
        callGain.gain.value = CALL_BASE * volume;
        localGain.gain.value = LOCAL_BASE * volume;
      }
      return;
    }

    if (e.data?.type === 'MUSIC_PAUSE') {
      players.get(e.data.file)?.pause();
      return;
    }

    if (e.data?.type !== 'MUSIC_PLAY') return;
    const { file } = e.data;
    build();
    ctx.resume();  // needs the user gesture
    const el = player(file, e.data.url);
    el.loop = e.data.loop;
    // play() resumes a paused sound and restarts one that has ended.
    el.play().catch((err) => {
      if (err.name === 'AbortError') return;  // a pause() beat it; state already says so
      console.warn('[meet-music]', err);
      ended(file);  // so the button does not stay lit for a sound that never started
    });
  });
})();
