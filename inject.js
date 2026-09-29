(() => {
  // The popup may re-inject this after an extension reload; never patch twice.
  if (window.__meetMusicInjected) return;
  window.__meetMusicInjected = true;

  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  const CALL_BASE = 0.15;   // what the meeting hears
  const LOCAL_BASE = 0.35;  // what you hear
  let ctx, mix, el, callGain, localGain;
  let volume = 1;
  let srcUrl = null;  // content.js sends this over MUSIC_SRC
  let playing = false;

  function build() {
    if (ctx) return;
    ctx = new AudioContext();
    mix = ctx.createMediaStreamDestination();

    el = new Audio();
    el.crossOrigin = 'anonymous';  // extension URL is cross-origin to meet.google.com
    if (srcUrl) el.src = srcUrl;   // may not have arrived yet; MUSIC_SRC fills it in
    el.loop = true;
    const src = ctx.createMediaElementSource(el);

    callGain = ctx.createGain();  callGain.gain.value  = CALL_BASE * volume;
    localGain = ctx.createGain(); localGain.gain.value = LOCAL_BASE * volume;

    src.connect(callGain).connect(mix);              // -> the call
    src.connect(localGain).connect(ctx.destination); // -> your speakers
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

  const play = () => el.play().catch(err => console.warn('[meet-music]', err));

  window.addEventListener('message', (e) => {
    if (e.source !== window) return;

    if (e.data?.type === 'MUSIC_SRC') {
      srcUrl = e.data.url;
      if (el) {
        el.src = srcUrl;
        if (playing) play();  // switching tracks mid-call keeps playing
      }
      return;
    }

    if (e.data?.type === 'MUSIC_VOLUME') {
      volume = e.data.volume;
      if (ctx) {
        callGain.gain.value = CALL_BASE * volume;
        localGain.gain.value = LOCAL_BASE * volume;
      }
      return;
    }

    if (e.data?.type !== 'MUSIC_TOGGLE') return;
    if (!srcUrl) {
      console.warn('[meet-music] no track selected yet');
      return;
    }
    build();
    if (!el.src) el.src = srcUrl;
    ctx.resume();                       // needs the user gesture
    playing = e.data.on;
    playing ? play() : el.pause();
  });
})();
