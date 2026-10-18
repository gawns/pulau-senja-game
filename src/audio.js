// Audio sintetis: ombak, angin, jangkrik, musik pentatonik, dan SFX.
// Tidak ada file aset. Baru mulai setelah input pertama (aturan autoplay browser).
let ctx = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let ambientGain = null;
let started = false;
let muted = false;
let volume = 0.7;
let night = 0;
let nearWater = 0;
let timer = null;
let step = 0;

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

function noiseBuffer(seconds = 2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    d[i] = last * 3.2;
  }
  return buf;
}

function init() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.0;
  musicGain.connect(master);
  sfxGain = ctx.createGain();
  sfxGain.gain.value = 0.9;
  sfxGain.connect(master);
  ambientGain = ctx.createGain();
  ambientGain.gain.value = 0.0;
  ambientGain.connect(master);

  // waves: looped brown noise through a lowpass, slowly swelling
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(4);
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 520;
  const swell = ctx.createGain();
  swell.gain.value = 0.35;
  src.connect(lp).connect(swell).connect(ambientGain);
  src.start();
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.11;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.22;
  lfo.connect(lfoGain).connect(swell.gain);
  lfo.start();

  // wind: brighter, quieter noise
  const wind = ctx.createBufferSource();
  wind.buffer = noiseBuffer(3);
  wind.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 900;
  bp.Q.value = 0.6;
  const wg = ctx.createGain();
  wg.gain.value = 0.055;
  wind.connect(bp).connect(wg).connect(ambientGain);
  wind.start();
  const wlfo = ctx.createOscillator();
  wlfo.frequency.value = 0.06;
  const wlg = ctx.createGain();
  wlg.gain.value = 0.03;
  wlfo.connect(wlg).connect(wg.gain);
  wlfo.start();

  started = true;
  schedule();
}

function midi(n) {
  return 440 * Math.pow(2, (n - 69) / 12);
}

function pluck(freq, when, dur = 1.2, gain = 0.16, type = "triangle") {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(gain, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0008, when + dur);
  o.connect(g).connect(musicGain);
  o.start(when);
  o.stop(when + dur + 0.05);
}

function pad(freq, when, dur, gain = 0.05) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(gain, when + dur * 0.35);
  g.gain.linearRampToValueAtTime(0.0001, when + dur);
  o.connect(g).connect(musicGain);
  o.start(when);
  o.stop(when + dur + 0.05);
}

function schedule() {
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    if (!ctx || muted) return;
    const t = ctx.currentTime + 0.05;
    const tempo = night > 0.5 ? 0.62 : 1;
    const root = 50 + (step % 4 === 0 ? 0 : step % 4 === 2 ? 5 : 7);
    // warm pad every bar
    if (step % 8 === 0) {
      pad(midi(root - 12), t, 6.4 * tempo, 0.05);
      pad(midi(root - 5), t, 6.4 * tempo, 0.035);
    }
    // gentle pentatonic melody
    const note = PENTA[(step * 3 + Math.floor(step / 4)) % PENTA.length];
    if (step % 2 === 0) pluck(midi(root + note), t, 1.6 * tempo, 0.09);
    if (step % 8 === 5) pluck(midi(root + PENTA[(step * 5) % PENTA.length] + 12), t, 1.1, 0.045, "sine");
    step++;
  }, 420);
}

export const audio = {
  get started() {
    return started;
  },
  get muted() {
    return muted;
  },
  get volume() {
    return volume;
  },
  get ctx() {
    return ctx;
  },
  start() {
    init();
    if (ctx && ctx.state === "suspended") ctx.resume();
  },
  setMood({ nightK = 0, water = 0, tension = 0 } = {}) {
    night = nightK;
    nearWater = water;
    if (!ctx) return;
    const target = muted ? 0 : volume;
    master.gain.setTargetAtTime(target, ctx.currentTime, 0.25);
    ambientGain.gain.setTargetAtTime(muted ? 0 : 0.16 + nearWater * 0.35, ctx.currentTime, 0.6);
    musicGain.gain.setTargetAtTime(muted ? 0 : (night > 0.5 ? 0.55 : 1) * (1 - tension * 0.7), ctx.currentTime, 0.9);
  },
  toggleMute() {
    muted = !muted;
    if (ctx) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.08);
    return muted;
  },
  setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (ctx) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.08);
  },
  sfx(name) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const tone = (freq, dur, gain, type = "triangle", slide = 0) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      o.connect(g).connect(sfxGain);
      o.start(t);
      o.stop(t + dur + 0.02);
    };
    const noise = (dur, gain, freq, q = 1) => {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(0.5);
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      src.connect(f).connect(g).connect(sfxGain);
      src.start(t);
      src.stop(t + dur + 0.02);
    };
    switch (name) {
      case "chop":
        noise(0.12, 0.5, 420, 0.8);
        tone(140, 0.12, 0.22, "square", 0.5);
        break;
      case "fall":
        noise(0.6, 0.35, 180, 0.6);
        tone(90, 0.5, 0.18, "sine", 0.4);
        break;
      case "pickup":
        tone(660, 0.1, 0.15, "sine");
        setTimeout(() => ctx && tone(880, 0.12, 0.12, "sine"), 70);
        break;
      case "meow":
        tone(520, 0.22, 0.16, "sawtooth", 1.5);
        break;
      case "click":
        tone(880, 0.05, 0.1, "square");
        break;
      case "open":
        tone(440, 0.12, 0.1, "sine", 1.6);
        break;
      case "build":
        noise(0.1, 0.4, 300, 0.9);
        tone(220, 0.14, 0.2, "triangle", 0.7);
        break;
      case "sleep":
        tone(300, 0.6, 0.1, "sine", 0.6);
        break;
      case "shark":
        tone(70, 0.9, 0.28, "sawtooth", 0.5);
        noise(0.8, 0.25, 220, 0.5);
        break;
      case "splash":
        noise(0.4, 0.35, 700, 0.4);
        break;
      case "win":
        [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => ctx && tone(f, 0.5, 0.12, "triangle"), i * 130));
        break;
      default:
        tone(520, 0.08, 0.1, "sine");
    }
  },
};
