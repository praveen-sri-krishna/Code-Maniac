/* =============================================================================
   SILVER JUBILEE — Sound Effects (Web Audio, zero external files)
   -----------------------------------------------------------------------------
   These are synthesised placeholder SFX so the magic is audible during the
   prototype. In production, real narration + era music load via Howler.js
   (see README). A mute toggle controls everything.
   ========================================================================== */
const SJ_Audio = (() => {
  let ctx = null;
  let muted = false;
  let ambientGain = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, t0, dur, type, peak) {
    if (muted || !ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak || 0.18, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  /* wand swirl — quick ascending sparkle arpeggio */
  function sparkle() {
    ensure(); if (muted) return;
    const base = ctx.currentTime;
    [880, 1175, 1568, 2093, 2637].forEach((f, i) => tone(f, base + i * 0.05, 0.25, 'triangle', 0.12));
  }

  /* film reel spin — rapid mechanical clicks that slow to a stop */
  function reel(dur = 1.0) {
    ensure(); if (muted) return;
    const base = ctx.currentTime;
    let t = 0, gap = 0.03;
    while (t < dur) {
      tone(140 + Math.random() * 40, base + t, 0.02, 'square', 0.06);
      gap *= 1.06;            // gradually slow → "reel winding down"
      t += gap;
    }
    tone(90, base + dur, 0.18, 'sine', 0.1); // soft thunk as it stops
  }

  /* gift box open — warm ascending chime */
  function chime() {
    ensure(); if (muted) return;
    const base = ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, base + i * 0.09, 0.6, 'sine', 0.16));
  }

  /* paper note whoosh for wishes wall */
  function whoosh() {
    ensure(); if (muted || !ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    const t0 = ctx.currentTime;
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(600, t0);
    o.frequency.exponentialRampToValueAtTime(180, t0 + 0.3);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
    o.connect(g).connect(ctx.destination);
    o.start(t0); o.stop(t0 + 0.34);
  }

  /* soft cinematic pad under the chapters (stands in for era music) */
  function ambient(on) {
    ensure();
    if (on) {
      if (ambientGain) return;
      ambientGain = ctx.createGain();
      ambientGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      ambientGain.gain.exponentialRampToValueAtTime(muted ? 0.0001 : 0.04, ctx.currentTime + 1.2);
      [110, 165, 220].forEach(f => {
        const o = ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = f;
        const og = ctx.createGain(); og.gain.value = 0.33;
        o.connect(og).connect(ambientGain);
        o.start();
      });
      ambientGain.connect(ctx.destination);
    } else if (ambientGain) {
      ambientGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
      const g = ambientGain; ambientGain = null;
      setTimeout(() => g.disconnect(), 1000);
    }
  }

  function setMuted(m) {
    muted = m;
    if (ambientGain && ctx) {
      ambientGain.gain.exponentialRampToValueAtTime(m ? 0.0001 : 0.04, ctx.currentTime + 0.3);
    }
  }

  return { unlock: ensure, sparkle, reel, chime, whoosh, ambient, setMuted, isMuted: () => muted };
})();
window.SJ_Audio = SJ_Audio;
