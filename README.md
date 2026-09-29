# Meet Music

A Manifest V3 Chrome extension that mixes a looping MP3 into your microphone on
Google Meet, so everyone in the call hears it too. Four elevator-music tracks are
bundled. Playback, track choice and volume live in a popup on the Chrome toolbar.

## Load it

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick this folder.
4. Open or reload a `https://meet.google.com/...` tab.

Chrome 111 or newer is required: the extension relies on content scripts that
declare a `world`, which older versions do not support.

## Use it

Click the Meet Music icon in the Chrome toolbar.

- **Track** picks one of the bundled MP3s. Switching while the music is playing
  swaps the track without stopping.
- **Play / Pause** starts and stops the music. It keeps playing while the popup
  is closed, and the track loops forever.
- **Music volume** scales both what the meeting hears and what you hear. The
  ratio between them is fixed: at 100% the call gets `0.15` of the track and you
  get `0.35`, so the music sits under your voice for everyone else while staying
  audible to you. Track and volume are remembered between sessions.

If the popup says "Open a Google Meet tab to use Meet Music", the active tab is
not a Meet tab, or it was already open when you installed or updated the
extension. Reload it.

## Add your own tracks

1. Drop the MP3 into `music/`.
2. Add an entry to `tracks.js`: `{ file: 'your-track.mp3', label: 'Your Track' }`.
3. Reload the extension on `chrome://extensions`, then reload the Meet tab.

`tracks.js` is the single source of truth. The popup builds its dropdown from it
and the content script rejects any track that is not listed. A track that loops
cleanly sounds best, since playback repeats indefinitely.

## How it works

`inject.js` runs in the page's own JavaScript realm (`"world": "MAIN"`) at
`document_start` and replaces `navigator.mediaDevices.getUserMedia` on both the
instance and `MediaDevices.prototype`. When Meet asks for your microphone, the
real mic stream and the MP3 are both routed into one `MediaStreamDestination`,
and that mixed stream is handed back to Meet. The music also goes to your own
speakers through a separate gain node, so you hear it at a different level than
the call does.

`content.js` runs in the isolated content-script world. It holds the play state,
volume and selected track, persists the last two, and relays the popup's messages
into the page over `window.postMessage`. The popup reaches it with
`chrome.tabs.sendMessage`.

## Gotchas

- **Load order is load-bearing.** The patch must happen before Meet captures its
  own reference to `getUserMedia`, hence `"world": "MAIN"` and
  `"run_at": "document_start"` in the manifest. Do not change them.
- **Reload the tab after the first install.** A Meet tab opened before the
  extension existed kept the unpatched `getUserMedia`. After a later extension
  *reload*, the popup re-injects its scripts into an open Meet tab by itself
  (`scripting` permission), so no tab reload is needed then.
- **The music starts only after you click Play.** Browsers require a user gesture
  before an `AudioContext` may produce sound.
- **Wear headphones.** Otherwise your speakers feed the music back into your mic
  on top of the mixed copy, and the call hears it twice.
- **Muting yourself in Meet mutes the music too.** Meet mutes the whole track it
  was handed, music included.
- **The two base levels live in `inject.js`** as `CALL_BASE` and `LOCAL_BASE`.
  The slider multiplies both, so change them only to shift the balance between
  the call and your own speakers.
- **Your mic never reaches your own speakers**, only the mixed stream, which
  avoids a feedback loop. You will not hear yourself.
- **Noise suppression may fight you.** Meet's own audio processing is applied to
  the microphone track before we see it, and it can dull or duck music. If it
  sounds thin, turn off noise cancellation in Meet's audio settings.
- **Test with a second account** in another browser profile before relying on it.
  What you hear locally is not what the call receives.
- **Everyone in the call hears it.** Use it where that is welcome.

## Credits

The four bundled tracks are royalty-free downloads from
[Pixabay](https://pixabay.com/music/), by andriih (Elevator), alex-morgan
(On Hold), ikoliks (Lounge) and tunetank (Café Lounge). Check Pixabay's content
licence before redistributing them.
