// The tracks bundled in music/. Add an entry here after dropping in a new MP3.
// Loaded as a plain script by both the popup and the content script.
const TRACKS = [
  { file: 'elevator.mp3', label: 'Elevator' },
  { file: 'on-hold.mp3', label: 'On Hold' },
  { file: 'lounge.mp3', label: 'Lounge' },
  { file: 'cafe-lounge.mp3', label: 'Café Lounge' }
];

const DEFAULT_TRACK = 'elevator.mp3';
