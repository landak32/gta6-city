// Every sound in Vice Harbor is generated at runtime with WebAudio: no files, no network. There
// is a noise bus for guns and tyres, a few oscillators for the engine and the siren, and a small
// step sequencer the game loop ticks so the soundtrack's bass and percussion follow the wanted
// level instead of a recorded track.
//
// Nothing is created until the player presses a key (browsers refuse audio before a gesture),
// and every call is guarded, so a headless capture with no audio device still runs the game.

const SCALE = [55, 65.41, 73.42, 82.41, 98, 110, 130.81];

export function createAudio() {
  let context = null;
  let master = null;
  let musicBus = null;
  let sfxBus = null;
  let noise = null;
  let engine = null;
  let siren = null;
  let enabled = false;

  function makeNoise() {
    const seconds = 1.2;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    let value = 0;
    for (let index = 0; index < data.length; index += 1) {
      value = value * 0.72 + (Math.random() * 2 - 1) * 0.28;
      data[index] = value;
    }
    return buffer;
  }

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    context = new Ctor();
    master = context.createGain();
    master.gain.value = 0.5;
    master.connect(context.destination);
    musicBus = context.createGain();
    musicBus.gain.value = 0.5;
    musicBus.connect(master);
    sfxBus = context.createGain();
    sfxBus.gain.value = 0.85;
    sfxBus.connect(master);
    noise = makeNoise();
    return true;
  }

  function now() {
    return context.currentTime;
  }

  function burst(duration, frequency, gain, type = 'lowpass') {
    if (!enabled) return;
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(gain, now());
    envelope.gain.exponentialRampToValueAtTime(0.0001, now() + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(sfxBus);
    source.start();
    source.stop(now() + duration);
  }

  function tone(frequency, duration, gain, type = 'square', slideTo) {
    if (!enabled) return;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now());
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, now() + duration);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, now());
    envelope.gain.exponentialRampToValueAtTime(gain, now() + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now() + duration);
    oscillator.connect(envelope);
    envelope.connect(sfxBus);
    oscillator.start();
    oscillator.stop(now() + duration + 0.02);
  }

  function startEngine() {
    if (!enabled || engine) return;
    const oscillator = context.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 52;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = context.createGain();
    gain.gain.value = 0.0;
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(sfxBus);
    oscillator.start();
    engine = { oscillator, filter, gain };
  }

  function startSiren() {
    if (!enabled || siren) return;
    const oscillator = context.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.value = 680;
    const gain = context.createGain();
    gain.gain.value = 0;
    oscillator.connect(gain);
    gain.connect(sfxBus);
    oscillator.start();
    siren = { oscillator, gain };
  }

  const api = {
    /** Called on the first real key press or click. */
    resume() {
      try {
        if (!ensure()) return;
        enabled = true;
        startEngine();
        startSiren();
      } catch {
        enabled = false;
      }
    },
    get ready() {
      return enabled;
    },
    /** The car's note: pitch climbs with speed, goes quiet when nobody is driving. */
    engineNote(speed, driving) {
      if (!enabled || !engine) return;
      try {
        const rate = Math.min(1, Math.abs(speed) / 520);
        engine.oscillator.frequency.setTargetAtTime(46 + rate * 150, now(), 0.08);
        engine.filter.frequency.setTargetAtTime(320 + rate * 900, now(), 0.1);
        engine.gain.gain.setTargetAtTime(driving ? 0.05 + rate * 0.05 : 0.0, now(), 0.12);
      } catch {
        /* a closed context is not worth a crash */
      }
    },
    sirenTone(on, phase) {
      if (!enabled || !siren) return;
      try {
        siren.gain.gain.setTargetAtTime(on ? 0.045 : 0, now(), 0.08);
        siren.oscillator.frequency.setTargetAtTime(phase % 2 === 0 ? 760 : 560, now(), 0.02);
      } catch {
        /* ignore */
      }
    },
    gunshot(kind) {
      if (!enabled) return;
      try {
        if (kind === 'smg') {
          burst(0.12, 2600, 0.5);
          tone(220, 0.06, 0.16, 'square', 90);
        } else if (kind === 'pistol') {
          burst(0.22, 1700, 0.62);
          tone(160, 0.1, 0.2, 'square', 60);
        } else {
          burst(0.09, 900, 0.28);
          tone(120, 0.05, 0.1, 'sine', 70);
        }
      } catch {
        /* ignore */
      }
    },
    punch() {
      if (!enabled) return;
      try {
        burst(0.09, 700, 0.35);
        tone(90, 0.08, 0.18, 'sine', 50);
      } catch {
        /* ignore */
      }
    },
    impact(strength) {
      if (!enabled) return;
      try {
        const level = Math.min(1, strength);
        burst(0.16 + level * 0.16, 1100 - level * 500, 0.22 + level * 0.4);
        tone(70, 0.16, 0.12 + level * 0.2, 'sine', 38);
      } catch {
        /* ignore */
      }
    },
    footstep(running) {
      if (!enabled) return;
      try {
        burst(0.06, running ? 900 : 600, 0.1);
      } catch {
        /* ignore */
      }
    },
    honk() {
      if (!enabled) return;
      try {
        tone(392, 0.22, 0.12, 'square');
        tone(294, 0.22, 0.09, 'square');
      } catch {
        /* ignore */
      }
    },
    pickup() {
      if (!enabled) return;
      try {
        tone(660, 0.1, 0.16, 'triangle');
        tone(990, 0.16, 0.13, 'triangle');
      } catch {
        /* ignore */
      }
    },
    cash() {
      if (!enabled) return;
      try {
        tone(880, 0.09, 0.12, 'triangle');
        tone(1320, 0.14, 0.1, 'triangle');
        tone(1760, 0.2, 0.08, 'triangle');
      } catch {
        /* ignore */
      }
    },
    fail() {
      if (!enabled) return;
      try {
        tone(320, 0.3, 0.16, 'sawtooth', 110);
      } catch {
        /* ignore */
      }
    },
    /** One tick of the soundtrack, driven from the fixed step so it never drifts. */
    beat(index, intensity) {
      if (!enabled) return;
      try {
        const sixteenth = index % 16;
        const bar = Math.floor(index / 16) % 4;
        if (sixteenth % 4 === 0) {
          tone(58, 0.16, 0.3, 'sine', 34);
        }
        if (sixteenth % 2 === 0) {
          burst(0.045, 7800, 0.045, 'highpass');
        }
        if (intensity >= 2 && (sixteenth === 4 || sixteenth === 12)) {
          burst(0.13, 2400, 0.16, 'bandpass');
        }
        if (intensity >= 4 && sixteenth % 4 === 2) {
          burst(0.05, 5200, 0.08, 'highpass');
        }
        const root = SCALE[(bar + Math.min(6, intensity)) % SCALE.length];
        if (sixteenth % 2 === 0) {
          const octave = sixteenth % 8 === 0 ? 2 : 1.5;
          tone(root * octave, 0.2, 0.12 + Math.min(0.1, intensity * 0.02), 'triangle');
        }
      } catch {
        /* ignore */
      }
    },
  };

  return api;
}
