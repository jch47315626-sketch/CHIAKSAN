/**
 * Web Audio로 합성하는 소리 풍경. 파일 없이 바람·비늘·저음·심장·숨·효과음을 만든다.
 * unlock()(사용자 동작 뒤) 전에는 모든 호출이 아무것도 하지 않는다.
 */
export const clampBpm = (bpm) => Math.max(50, Math.min(160, bpm));

export function createSoundscape(AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext) {
  let ctx = null;
  let out, noiseBuf;
  let windGain, windFilter, droneGain, hissGain, hissPanner, hissLfoGain;
  let bpm = 60, beatPhase = 0, beatOn = false;

  const ready = () => !!ctx;
  const now = () => ctx.currentTime;

  function noise() {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    return src;
  }

  function panner(pos) {
    const p = ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 0.5;
    p.rolloffFactor = 1.2;
    setPos(p, pos);
    return p;
  }

  function setPos(p, pos) {
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; }
    else p.setPosition(pos.x, pos.y, pos.z);
  }

  function build() {
    const sr = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, sr * 2, sr);
    const d = noiseBuf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < d.length; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 6 * 0.5 + (Math.random() * 2 - 1) * 0.5; }

    const comp = ctx.createDynamicsCompressor();
    out = ctx.createGain();
    out.gain.value = 0.9;
    out.connect(comp).connect(ctx.destination);

    // 바람: 걸러낸 잡음 + 느린 출렁임
    const w = noise();
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass'; windFilter.frequency.value = 420; windFilter.Q.value = 0.6;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 180;
    lfo.connect(lfoAmt).connect(windFilter.frequency);
    w.connect(windFilter).connect(windGain).connect(out);
    w.start(); lfo.start();

    // 저음: 종소리 같은 웅웅거림 (맥놀이)
    droneGain = ctx.createGain(); droneGain.gain.value = 0;
    for (const [f, g] of [[48, 0.5], [50.6, 0.5], [97.1, 0.18], [130.8, 0.05]]) {
      const o = ctx.createOscillator(); o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = g;
      o.connect(og).connect(droneGain); o.start();
    }
    droneGain.connect(out);

    // 구렁이 비늘 소리: 고역 잡음을 빠르게 긁듯 출렁이게 하고, 머리 위치에서 들리게
    const h = noise();
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2600;
    const scrape = ctx.createGain(); scrape.gain.value = 0.5;
    const sl = ctx.createOscillator(); sl.frequency.value = 5.5;
    hissLfoGain = ctx.createGain(); hissLfoGain.gain.value = 0.5;
    sl.connect(hissLfoGain).connect(scrape.gain);
    hissGain = ctx.createGain(); hissGain.gain.value = 0;
    hissPanner = panner({ x: 0, y: 0, z: -2 });
    h.connect(hp).connect(scrape).connect(hissGain).connect(hissPanner).connect(out);
    h.start(); sl.start();
  }

  function envNoise({ type, f0, f1 = f0, q = 0.8, attack, hold, release, level, pos = null }) {
    const t = now();
    const src = noise();
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + attack + hold + release);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + attack);
    g.gain.setValueAtTime(level, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    let node = src.connect(f).connect(g);
    if (pos) node = node.connect(panner(pos));
    node.connect(out);
    src.start(t);
    src.stop(t + attack + hold + release + 0.05);
  }

  function thump(t, freq, level) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + 0.25);
  }

  const ramp = (param, v, s = 0.5) => param.setTargetAtTime(v, now(), s / 3);

  return {
    async unlock() {
      if (ctx || !AudioContextCtor) return;
      try {
        ctx = new AudioContextCtor();
        build();
        // resume()은 사용자 동작 없이 부르면 영영 끝나지 않을 수 있어 기다리지 않는다
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      } catch (e) {
        console.warn('소리를 켤 수 없습니다', e);
        ctx = null;
      }
    },
    setListener(pos, q) {
      if (!ready()) return;
      const L = ctx.listener;
      // 쿼터니언으로 앞(-z)·위(+y) 방향 계산
      const fx = -2 * (q.x * q.z + q.w * q.y), fy = -2 * (q.y * q.z - q.w * q.x), fz = -(1 - 2 * (q.x * q.x + q.y * q.y));
      const ux = 2 * (q.x * q.y - q.w * q.z), uy = 1 - 2 * (q.x * q.x + q.z * q.z), uz = 2 * (q.y * q.z + q.w * q.x);
      if (L.positionX) {
        L.positionX.value = pos.x; L.positionY.value = pos.y; L.positionZ.value = pos.z;
        L.forwardX.value = fx; L.forwardY.value = fy; L.forwardZ.value = fz;
        L.upX.value = ux; L.upY.value = uy; L.upZ.value = uz;
      } else {
        L.setPosition(pos.x, pos.y, pos.z);
        L.setOrientation(fx, fy, fz, ux, uy, uz);
      }
    },
    wind(level) { if (ready()) ramp(windGain.gain, level * 0.35, 1.5); },
    drone(level) { if (ready()) ramp(droneGain.gain, level * 0.25, 2); },
    hiss(pos, level) {
      if (!ready()) return;
      setPos(hissPanner, pos);
      ramp(hissGain.gain, level * 0.6, 0.3);
    },
    /** 아무것도 없는 곳에서 한 번 스르륵 (분위기 장치) */
    slitherAt(pos) {
      if (!ready()) return;
      envNoise({ type: 'highpass', f0: 3200, f1: 2200, attack: 0.4, hold: 0.6, release: 0.8, level: 0.5, pos });
    },
    heartbeat(v) { bpm = clampBpm(v); beatOn = true; },
    stopHeartbeat() { beatOn = false; },
    breath(kind) {
      if (!ready()) return;
      if (kind === 'gasp') envNoise({ type: 'bandpass', f0: 500, f1: 1400, q: 1.2, attack: 0.08, hold: 0.25, release: 0.3, level: 0.5 });
      else envNoise({ type: 'lowpass', f0: 700, f1: 300, attack: 0.3, hold: 0.2, release: 1.2, level: 0.2 });
    },
    sting(kind) {
      if (!ready()) return;
      const t = now();
      if (kind === 'spotted') {
        thump(t, 70, 0.9);
        envNoise({ type: 'lowpass', f0: 900, f1: 120, attack: 0.01, hold: 0.1, release: 1.6, level: 0.8 });
        for (const f of [233, 247, 349]) {
          const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
          const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.06, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
          o.connect(g).connect(out); o.start(t); o.stop(t + 1.5);
        }
      } else if (kind === 'arrow') {
        envNoise({ type: 'highpass', f0: 6000, f1: 1500, attack: 0.02, hold: 0.05, release: 0.25, level: 0.7 });
        setTimeout(() => ready() && thump(now(), 160, 1.0), 300);
      }
    },
    update(dt) {
      if (!ready() || !beatOn) return;
      beatPhase += dt * (bpm / 60);
      if (beatPhase >= 1) {
        beatPhase -= 1;
        const t = now() + 0.02;
        thump(t, 58, 0.55);
        thump(t + 0.16, 50, 0.35);
      }
    },
  };
}
