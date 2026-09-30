# Meet Music

A Manifest V3 Chrome extension that mixes music and short sound effects into your
microphone on Google Meet, so everyone in the call hears them too. Four looping
elevator-music tracks are bundled. Each sound gets a red button in a popup on the
Chrome toolbar, above a volume slider.

## Load it

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick this folder.
4. Open or reload a `https://meet.google.com/...` tab.

Chrome 111 or newer is required: the extension relies on content scripts that
declare a `world`, which older versions do not support.

## Use it

Click the Meet Music icon in the Chrome toolbar.

- **A red button** plays its sound. Press it again to pause, and again to resume
  from the same spot. The cap sinks into its housing when pressed, lights up and
  glows while the sound plays, and shows a play symbol while it is paused. A sound
  plays to its end and the button goes back to idle, so the next press starts it
  over. Sounds marked to loop, such as
  the four music tracks, repeat until you pause them.
- **Buttons are independent.** Several sounds can play at once, so you can fire
  an effect over the music. Everything keeps playing while the popup is closed.
- **Volume** scales every sound, both what the meeting hears and what you hear.
  The ratio between them is fixed: at 100% the call gets `0.15` of a sound and you
  get `0.35`, so it sits under your voice for everyone else while staying audible
  to you. Volume is remembered between sessions.

If the popup says "Open a Google Meet tab to use Meet Music", the active tab is
not a Meet tab, or it was already open when you installed or updated the
extension. Reload it.

## Add your own sounds

1. Drop the MP3 into `music/`.
2. Add an entry to `tracks.js`:
   - `{ file: 'airhorn.mp3', label: 'Airhorn' }` plays once per press. Use this
     for short action sounds.
   - `{ file: 'your-track.mp3', label: 'Your Track', loop: true }` repeats until
     paused. Use this for background music.
3. Reload the extension on `chrome://extensions`, then reload the Meet tab.

`tracks.js` is the single source of truth. The popup builds one button per entry,
in list order, three to a row, and the content script rejects any sound that is
not listed. Keep labels short so they fit under a button. A looping track sounds
best if it loops cleanly.

## How it works

`inject.js` runs in the page's own JavaScript realm (`"world": "MAIN"`) at
`document_start` and replaces `navigator.mediaDevices.getUserMedia` on both the
instance and `MediaDevices.prototype`. When Meet asks for your microphone, the
real mic stream and the sounds are all routed into one `MediaStreamDestination`,
and that mixed stream is handed back to Meet. Each sound gets its own audio
element on its first press. All of them feed the same two gain nodes: one into the
call, and one to your own speakers at a different level.

`content.js` runs in the isolated content-script world. It holds each sound's
state (playing, paused or idle) and the volume, persists the volume, and relays
the popup's messages into the page over `window.postMessage`. The popup reaches
it with `chrome.tabs.sendMessage`. When a sound finishes on its own, `inject.js`
posts back to `content.js`, which updates the popup if it is open.

## Gotchas

- **Load order is load-bearing.** The patch must happen before Meet captures its
  own reference to `getUserMedia`, hence `"world": "MAIN"` and
  `"run_at": "document_start"` in the manifest. Do not change them.
- **Reload the tab after the first install.** A Meet tab opened before the
  extension existed kept the unpatched `getUserMedia`. After a later extension
  *reload*, the popup re-injects its scripts into an open Meet tab by itself
  (`scripting` permission), so no tab reload is needed then. The exception is a
  change to `inject.js` itself: the page keeps the copy it already has, so
  reload the tab.
- **Nothing plays until you press a button.** Browsers require a user gesture
  before an `AudioContext` may produce sound.
- **Wear headphones.** Otherwise your speakers feed the music back into your mic
  on top of the mixed copy, and the call hears it twice.
- **Muting yourself in Meet mutes the sounds too.** Meet mutes the whole track it
  was handed, music included.
- **The two base levels live in `inject.js`** as `CALL_BASE` and `LOCAL_BASE`.
  The slider multiplies both, so change them only to shift the balance between
  the call and your own speakers. They apply to every sound, so an effect meant
  to cut through the conversation has to be louder in the MP3 itself.
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
