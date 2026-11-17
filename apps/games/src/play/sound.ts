/**
 * The one sound in the game: a bell when someone buzzes in. Synthesised, so there is no
 * audio file to load, and silent in browsers that won't play sound yet.
 */

const SOUND_KEY = "tubas:sound";

export const isSoundOn = () => {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
};

export const setSoundOn = (on: boolean) => {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // Without storage the choice can't be remembered; the bell just stays on.
  }
};

let context: AudioContext | undefined;

/** Two quick rising notes, like a hotel desk bell. */
export const playBuzz = () => {
  if (!isSoundOn() || !("AudioContext" in window)) return;
  context ??= new AudioContext();
  const audio = context;
  // Browsers keep audio suspended until the page has been clicked; the host always has.
  void audio.resume().catch(() => undefined);
  const start = audio.currentTime;
  for (const [index, frequency] of [880, 1318.5].entries()) {
    const at = start + index * 0.09;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.35, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.6);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.65);
  }
};
