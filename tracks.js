// The sounds bundled in music/, one popup button each. Add an entry here after
// dropping in a new MP3. A sound plays once per press unless it has `loop: true`.
// Loaded as a plain script by both the popup and the content script.
const TRACKS = [
  { file: 'elevator.mp3', label: 'Elevator', loop: true },
  { file: 'on-hold.mp3', label: 'On Hold', loop: true },
  { file: 'lounge.mp3', label: 'Lounge', loop: true },
  { file: 'cafe-lounge.mp3', label: 'Café Lounge', loop: true }
];
