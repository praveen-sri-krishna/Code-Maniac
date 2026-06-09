/* =============================================================================
   SILVER JUBILEE — Experience Engine
   Stage machine · chapter player · time-travel transitions
   ========================================================================== */
(() => {
  const { SCENES, COPY } = window.SJ_DATA;
  const A = window.SJ_Audio;

  /* ---- DOM refs ----------------------------------------------------------- */
  const $ = sel => document.querySelector(sel);
  const stage      = $('#stage');
  const sceneLayer = $('#scene-layer');
  const fx         = $('#transition-layer');
  const curtains   = $('#curtains');
  const hud        = $('#hud');
  const progress   = $('#progress');
  const wandPrev   = $('#wand-prev');
  const wandNext   = $('#wand-next');

  /* ---- state -------------------------------------------------------------- */
  let phase = 'curtain';        // curtain | story | gift | wishes | finale
  let sceneIdx = 0;             // pointer into SCENES
  let busy = false;             // mid-transition lock
  let timers = [];              // scene timers (cleared on every scene change)
  let fxTimers = [];            // transition timers (NOT cleared by scene changes)
  let renderToken = 0;          // invalidates async work when scene changes

  /* ---- MOTION as data (single source of truth for timing — see DESIGN.md) -- */
  const MOTION = {
    travel:    1500,   // chapter-to-chapter time-travel (slowed, was ~700)
    travelBig: 2600,   // the big opening sweep back to 1974
    titleHold: 1700,   // how long a chapter title card lingers
    trick:     3200,   // how long a magic set-piece plays
    photo:     3100,   // how long each photo holds
  };
  const PHOTO_MS = MOTION.photo;
  const after = (ms, fn) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  // transition timers live in their own bucket so renderScene()'s clearTimers()
  // can never kill the timer that removes the film-reel overlay.
  const fxAfter = (ms, fn) => { const t = setTimeout(fn, ms); fxTimers.push(t); return t; };
  const clearFx = () => { fxTimers.forEach(clearTimeout); fxTimers = []; };

  /* ---- palette ------------------------------------------------------------ */
  function applyPalette(p) {
    const r = stage.style;
    r.setProperty('--bg1', p.bg1);
    r.setProperty('--bg2', p.bg2);
    r.setProperty('--accent', p.accent);
    const f = `grayscale(${p.grayscale || 0}) sepia(${p.sepia}) saturate(${p.sat}) contrast(1.04)`;
    r.setProperty('--photo-filter', f);
  }

  /* =========================================================================
     THE INVITATION + PRE-SHOW — in front of the CLOSED curtain.
     The very first thing a guest sees is a sealed invitation with their
     names on it. Breaking the wax seal opens the envelope; only then does
     the host speak, and only the wand finally raises the curtain.
     ====================================================================== */
  function buildOpening() {
    applyPalette({ bg1: '#1a0606', bg2: '#3a0d0d', accent: '#d9a441', sepia: 0, sat: 1, grayscale: 0 });
    phase = 'curtain';
    curtains.classList.remove('open');           // curtains stay CLOSED for the pre-show
    hud.classList.remove('visible');
    setChrome('hidden');

    const lines = COPY.preshow.map((l, i) =>
      `<p class="ps-line" data-i="${i}">${l.text}${l.sub ? `<span class="ps-kn">${l.sub}</span>` : ''}</p>`
    ).join('');

    sceneLayer.innerHTML = `
      <div class="preshow">
        <div class="spotlight"></div>
        <div class="invite" id="invite">
          <div class="invite-card">
            <div class="invite-paper">
              <span class="invite-eyebrow">${COPY.inviteEyebrow}</span>
              <span class="invite-names">${COPY.inviteNames}</span>
            </div>
            <div class="invite-flap"></div>
            <button class="invite-seal" id="invite-seal" aria-label="Break the wax seal">P·S</button>
          </div>
          <p class="invite-hint">${COPY.inviteHint}</p>
        </div>
        <div class="preshow-inner">
          <div class="show-mark">✦  A MAGIC SHOW  ✦</div>
          <div class="preshow-lines">${lines}</div>
          <div class="wand opening-wand hidden" id="opening-wand" role="button" aria-label="Tap the magic wand">
            ${wandSVG()}
            <span class="wand-hint">${COPY.wandCue}</span>
          </div>
        </div>
      </div>`;

    $('#invite-seal').addEventListener('click', openInvite, { once: true });
  }

  /* the seal cracks, the flap lifts, the envelope sinks away — then the host */
  function openInvite() {
    A.unlock(); A.sparkle();
    const invite = $('#invite');
    const seal = $('#invite-seal');
    const r = seal.getBoundingClientRect();
    burstSparkles(r.left + r.width / 2, r.top + r.height / 2, 14);
    seal.classList.add('crack');
    invite.querySelector('.invite-flap').classList.add('lift');
    after(620, () => invite.classList.add('opened'));
    after(1250, startPreshowLines);
  }

  function startPreshowLines() {
    const inner = sceneLayer.querySelector('.preshow-inner');
    if (!inner) return;
    inner.classList.add('begin');
    // reveal the host's lines one at a time (cross-fade), then the wand
    const els = Array.from(sceneLayer.querySelectorAll('.ps-line'));
    const HOLD = 2600;
    els.forEach((el, i) => after(500 + i * HOLD, () => {
      els.forEach(l => l.classList.remove('show'));
      el.classList.add('show');
    }));
    after(500 + els.length * HOLD - 400, () => {
      const w = $('#opening-wand');
      if (w) w.classList.remove('hidden');
    });
    $('#opening-wand').addEventListener('click', startJourney, { once: true });
  }

  function startJourney() {
    if (busy) return;
    A.unlock(); A.sparkle();
    const w = $('#opening-wand');
    if (w) w.classList.add('cast');
    burstSparkles(window.innerWidth / 2, window.innerHeight * 0.62);
    after(560, () => {
      phase = 'story';
      sceneIdx = 0;
      // the long sweep: from this very year all the way back to 1974
      timeTravel({ big: true, from: new Date().getFullYear(), to: SCENES[0].year },
                 () => renderScene(sceneIdx));
    });
  }

  /* =========================================================================
     SCENE RENDER (prologue + chapters share the same player)
     ====================================================================== */
  function renderScene(i) {
    const scene = SCENES[i];
    applyPalette(scene.palette);
    const token = ++renderToken;
    clearTimers();
    A.ambient(true);

    const isPro = scene.kind === 'prologue';
    sceneLayer.innerHTML = `
      <div class="chapter ${isPro ? 'is-prologue' : ''} ${scene.milestone ? 'is-milestone' : ''}">
        <div class="grain"></div>
        <div class="vignette"></div>

        <div class="title-card" id="title-card">
          <div class="tc-rule"></div>
          <div class="tc-year">${scene.label.split('·').pop().trim() || scene.year}</div>
          <div class="tc-title">${scene.title}</div>
          ${scene.tag ? `<div class="tc-tag">✦ ${scene.tag} ✦</div>` : ''}
          <div class="tc-rule"></div>
        </div>

        <div class="reel-window" id="reel-window"></div>

        <div class="photo-dots" id="photo-dots"></div>
        <div class="ready-cue" id="ready-cue">✦&ensp;${COPY.readyCue}&ensp;✦</div>

        <div class="narration${scene.trick ? ' hold' : ''}" id="narration">
          <span class="nar-dot"></span>
          <span class="nar-text">${scene.narration}</span>
        </div>
      </div>`;

    updateHUD(scene);
    setWandSparkle(scene.palette.accent);
    armChapterReady(false);

    // title card holds, then — for special years — the magic trick plays,
    // and only after the trick do the photos begin. The stage is cleared of
    // chrome from this point on: the show has the room to itself.
    after(MOTION.titleHold, () => {
      if (token !== renderToken) return;
      const tc = $('#title-card');
      if (tc) tc.classList.add('lift');
      setChrome('hidden');
      if (scene.trick) playTrick(scene, token, () => playPhotos(scene, token));
      else playPhotos(scene, token);
    });
  }

  /* ---- the magic act: a visual trick + the showman's headline ------------- */
  function playTrick(scene, token, cb) {
    const win = $('#reel-window');
    if (!win) { cb && cb(); return; }
    win.innerHTML =
      `<div class="trick trick-${scene.trick}">
         ${trickMarkup(scene.trick)}
         <div class="trick-words">
           <h2 class="trick-head">${scene.headline}</h2>
           ${scene.subhead ? `<p class="trick-sub">${scene.subhead}</p>` : ''}
         </div>
       </div>`;
    A.sparkle();
    burstSparkles(window.innerWidth / 2, window.innerHeight * 0.42, 16);
    after(MOTION.trick, () => {
      if (token !== renderToken) return;
      const t = win.querySelector('.trick');
      if (t) t.classList.add('out');
      after(560, () => { if (token === renderToken) cb && cb(); });
    });
  }

  function trickMarkup(kind) {
    if (kind === 'hat') {
      return `<div class="magic-hat">
          <div class="smoke"></div>
          <div class="bunny">${bunnySVG()}</div>
          <div class="hat-back"></div>
          <div class="hat-top"></div>
          <div class="hat-brim"></div>
        </div>`;
    }
    if (kind === 'union') {
      return `<div class="stars-union"><span class="ustar a">${starSVG()}</span><span class="ustar b">${starSVG()}</span><div class="union-flash"></div></div>`;
    }
    if (kind === 'twinstars') {
      return `<div class="twin-stars"><span class="tstar a">${starSVG()}</span><span class="tstar b">${starSVG()}</span></div>`;
    }
    if (kind === 'starbirth') {
      return `<div class="star-birth"><span class="bigstar">${starSVG()}</span><div class="rays"></div></div>`;
    }
    return `<div class="sparkle-burst"></div>`; // sparkleburst
  }

  function playPhotos(scene, token) {
    const win = $('#reel-window');
    if (!win) return;
    // a trick was holding the narration back — now let it fade in with the photos
    const nar = $('#narration');
    if (nar && nar.classList.contains('hold')) {
      nar.classList.remove('hold');
      nar.style.animation = 'fadeUp 1.1s ease both';
    }

    // small film-frame dots so a first-time guest knows where they are in a year
    const dotsEl = $('#photo-dots');
    const useDots = scene.photos.length > 1 && scene.photos[0].anim !== 'collage';
    if (useDots && dotsEl) {
      dotsEl.innerHTML = scene.photos.map(() => '<span class="pd"></span>').join('');
      dotsEl.classList.add('live');
    }
    const markDot = i => {
      if (!useDots || !dotsEl) return;
      Array.from(dotsEl.children).forEach((d, k) => d.classList.toggle('on', k === i));
    };

    let p = 0;
    const showNext = () => {
      if (token !== renderToken || !win) return;
      if (p >= scene.photos.length) { armChapterReady(true); return; }
      const ph = scene.photos[p];

      if (ph.anim === 'collage') {
        win.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'collage';
        scene.photos.forEach((cp, k) => {
          const el = makePhotoFrame(cp, scene);
          el.style.setProperty('--d', (k * 0.18) + 's');
          grid.appendChild(el);
        });
        win.appendChild(grid);
        p = scene.photos.length;        // collage shows the whole set at once
        after(PHOTO_MS + 700, showNext);
        return;
      }

      if (p === 0) win.innerHTML = '';                  // sweep any trick remnants
      // cross-fade: the new photo enters while the old one is still leaving,
      // so the stage is never empty between memories
      const prev = win.querySelector('.photo-frame:not(.leave)');
      const frame = makePhotoFrame(ph, scene);
      win.appendChild(frame);
      // force reflow then animate in
      void frame.offsetWidth;
      frame.classList.add('enter');
      if (prev) {
        prev.classList.add('leave');
        after(720, () => prev.remove());
      }
      markDot(p);
      p++;
      after(PHOTO_MS, showNext);
    };
    showNext();
  }

  function makePhotoFrame(ph, scene) {
    const frame = document.createElement('figure');
    frame.className = `photo-frame anim-${ph.anim} ${scene.kind === 'prologue' ? 'film' : 'polaroid-edge'}`;
    const img = document.createElement('img');
    img.alt = ph.caption;
    img.src = ph.src;
    img.addEventListener('error', () => {
      frame.classList.add('missing');
      img.remove();
      const ph2 = document.createElement('div');
      ph2.className = 'photo-placeholder';
      ph2.innerHTML = `<span class="pp-cam">◎</span><span class="pp-year">${scene.year}</span>`;
      frame.prepend(ph2);
    });
    const cap = document.createElement('figcaption');
    cap.textContent = ph.caption;
    frame.appendChild(img);
    frame.appendChild(cap);
    return frame;
  }

  /* mark the chapter as finished → the wands return with a sparkle + bell */
  function armChapterReady(ready) {
    wandNext.classList.toggle('ready', ready);
    const cue = $('#ready-cue');
    const dots = $('#photo-dots');
    if (ready) {
      clearTimeout(peekTimer);
      setChrome('ready');
      if (cue) cue.classList.add('show');
      if (dots) dots.classList.add('gone');
      const nar = $('#narration');
      if (nar) nar.classList.add('done');
      const r = wandNext.getBoundingClientRect();
      burstSparkles(r.left + r.width / 2, r.top + r.height * 0.3, 10);
      A.glimmer();
    } else if (cue) {
      cue.classList.remove('show');
    }
  }

  /* =========================================================================
     HUD — progress indicator + wands
     The wands stay off-stage while the show plays. They come back when a
     chapter is done ("ready"), or briefly when the guest taps the stage
     ("peek") — the same auto-hiding chrome a film player uses.
     ====================================================================== */
  let peekTimer = null;
  function setChrome(mode) {           // 'hidden' | 'title' | 'peek' | 'ready'
    hud.dataset.chrome = mode;
  }

  function peekChrome() {
    setChrome('peek');
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => {
      if (hud.dataset.chrome === 'peek') setChrome('hidden');
    }, 2800);
  }

  stage.addEventListener('pointerdown', e => {
    if (phase !== 'story' || busy) return;
    if (e.target.closest('button, input, textarea, a')) return;
    const mode = hud.dataset.chrome;
    if (mode === 'ready' || mode === 'title') return;   // already on stage
    peekChrome();
  });

  function updateHUD(scene) {
    hud.classList.add('visible');
    const milestone = scene.milestone ? ' milestone' : '';
    progress.className = 'progress' + milestone;
    progress.innerHTML = scene.kind === 'prologue'
      ? `<span class="p-dot"></span> Prologue · ${scene.year}`
      : `<span class="p-dot"></span> ${scene.label}`;
    wandPrev.classList.remove('hidden');
    wandNext.classList.remove('hidden');
    setChrome('title');                 // only the year pill greets the chapter
  }

  function setWandSparkle(color) {
    [wandPrev, wandNext].forEach(w => w.style.setProperty('--accent', color));
  }

  /* =========================================================================
     NAVIGATION (the wands are the only way forward/back)
     ====================================================================== */
  function go(dir) {
    if (busy) return;
    if (phase === 'story') {
      const target = sceneIdx + dir;
      if (target < 0) return;
      if (target >= SCENES.length) { enterGift(); return; }
      const from = SCENES[sceneIdx].year, to = SCENES[target].year;
      sceneIdx = target;
      A.sparkle();
      timeTravel({ from, to }, () => renderScene(sceneIdx));
    } else if (phase === 'gift' && dir < 0) {
      const from = SCENES[SCENES.length - 1].year;
      phase = 'story'; sceneIdx = SCENES.length - 1;
      timeTravel({ from, to: from }, () => renderScene(sceneIdx));
    }
  }

  /* tap feedback: the wand flares and throws a few sparkles at its corner */
  function tapWand(el) {
    const r = el.getBoundingClientRect();
    burstSparkles(r.left + r.width / 2, r.top + r.height * 0.34, 12);
    el.classList.remove('tapped'); void el.offsetWidth; el.classList.add('tapped');
  }
  wandNext.addEventListener('click', () => { if (!busy) tapWand(wandNext); go(+1); });
  wandPrev.addEventListener('click', () => { if (!busy) tapWand(wandPrev); go(-1); });
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') go(+1);
    if (e.key === 'ArrowLeft') go(-1);
  });

  /* =========================================================================
     THE TIME-TRAVEL TRANSITION  (the heartbeat of the show)
     A film reel rolls and the YEAR ticks across time — so it truly feels like
     the reel is carrying you from one year to another. Deliberately unhurried.
     Durations are centralised in MOTION (see top) — "motion as data".
     ====================================================================== */
  function timeTravel(opts, done) {
    busy = true;
    clearFx();                                          // cancel any prior transition
    armChapterReady(false);
    const big = !!opts.big;
    const dur = big ? MOTION.travelBig : MOTION.travel;
    A.reel((big ? MOTION.travelBig : MOTION.travel) / 1000);
    if (big) curtains.classList.remove('open');         // snap shut for the big jump

    fx.innerHTML = `
      <div class="tunnel ${big ? 'big' : ''}"></div>
      <div class="film-reel">${reelSVG()}</div>
      <div class="leader"><div class="leader-sweep"></div></div>
      <div class="time-year" id="time-year"></div>
      <div class="flash"></div>`;
    fx.classList.add('active');

    // the year spins across time
    if (opts.from != null && opts.to != null) {
      animateYear($('#time-year'), opts.from, opts.to, Math.round(dur * 0.82));
    }

    const mid = Math.round(dur * 0.72);
    fxAfter(mid, () => {
      done && done();                                   // render the next scene underneath
      fx.querySelector('.flash')?.classList.add('go');
      if (big) fxAfter(180, () => curtains.classList.add('open'));   // curtains finally rise
    });
    fxAfter(dur, () => {                                 // ALWAYS clears the overlay
      fx.classList.remove('active');
      fx.innerHTML = '';
      busy = false;
    });
  }

  /* count a year value from → to over a duration (eased) */
  function animateYear(el, from, to, dur) {
    if (!el) return;
    const start = performance.now();
    const tick = (now) => {
      if (!el.isConnected) return;
      const t = Math.min(1, (now - start) / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (to - from) * ease);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* =========================================================================
     STAGE 3 — THE GIFT BOX REVEAL
     ====================================================================== */
  function enterGift() {
    phase = 'gift';
    A.ambient(false);
    applyPalette({ bg1: '#241405', bg2: '#5e3410', accent: '#ffd24a', sepia: 0, sat: 1.2, grayscale: 0 });
    timeTravel({}, () => {
      sceneLayer.innerHTML = `
        <div class="gift-scene">
          <div class="grain"></div>
          <p class="gift-prompt">Something is waiting for you…</p>
          <div class="giftbox" id="giftbox" role="button" aria-label="Open the gift">
            <div class="gift-glow"></div>
            <div class="gift-lid"></div>
            <div class="gift-body"><span class="gift-names">Preethi &amp; Sathi</span></div>
            <div class="gift-ribbon-v"></div>
            <div class="gift-ribbon-h"></div>
            <div class="gift-bow"></div>
          </div>
          <p class="gift-tap">tap to open</p>
        </div>`;
      updateGiftHUD();
      $('#giftbox').addEventListener('click', openGift, { once: true });
    });
  }

  function updateGiftHUD() {
    hud.classList.add('visible');
    setChrome('ready');
    progress.className = 'progress milestone';
    progress.innerHTML = `<span class="p-dot"></span> The Reveal`;
    wandNext.classList.add('hidden');
    wandPrev.classList.remove('hidden');
  }

  function openGift() {
    A.chime();
    const box = $('#giftbox');
    box.classList.add('open');
    burstSparkles(window.innerWidth / 2, window.innerHeight / 2, 28);
    after(900, () => {
      sceneLayer.innerHTML = `
        <div class="video-scene">
          <div class="video-frame">
            <video id="family-video" playsinline controls></video>
            <div class="video-fallback" id="video-fallback">
              <span class="vf-reel">🎞️</span>
              <p>The family video plays here</p>
              <small>drop your file at <code>media/finale/family.mp4</code></small>
            </div>
          </div>
          <button class="ghost-btn" id="to-wishes">Continue to the Wishes Wall →</button>
        </div>`;
      const v = $('#family-video');
      v.src = 'media/finale/family.mp4';
      v.addEventListener('error', () => {
        v.style.display = 'none';
        $('#video-fallback').style.display = 'flex';
      });
      v.play?.().catch(() => {});
      $('#to-wishes').addEventListener('click', enterWishes, { once: true });
    });
  }

  /* =========================================================================
     STAGE 4 — THE WISHES WALL  (real-time in production via Supabase)
     ====================================================================== */
  function enterWishes() {
    phase = 'wishes';
    timeTravel({}, () => {
      sceneLayer.innerHTML = `
        <div class="wishes-scene">
          <div class="grain"></div>
          <h2 class="wishes-title">Leave a wish for Preethi &amp; Sathi</h2>
          <form class="wish-form" id="wish-form" autocomplete="off">
            <input id="wish-name" maxlength="40" placeholder="Your name" required />
            <textarea id="wish-msg" maxlength="180" placeholder="Your wish…" required></textarea>
            <button type="submit">Pin my wish ✦</button>
          </form>
          <div class="wishes-wall" id="wishes-wall"></div>
          <button class="ghost-btn finale-jump" id="to-finale">See the Finale →</button>
        </div>`;
      setChrome('ready');
      progress.innerHTML = `<span class="p-dot"></span> The Wishes Wall`;
      wandPrev.classList.add('hidden'); wandNext.classList.add('hidden');
      seedWishes();
      $('#wish-form').addEventListener('submit', onWish);
      $('#to-finale').addEventListener('click', enterFinale, { once: true });
    });
  }

  function seedWishes() {
    const seed = JSON.parse(localStorage.getItem('sj_wishes') || 'null') || [
      { name: 'Amma & Appa’s friends', msg: 'Here’s to 25 more!' },
      { name: 'The Cousins', msg: 'You two are couple goals 💛' },
    ];
    seed.forEach((w, i) => pinWish(w, i * 120, false));
  }

  function pinWish(w, delay, sound) {
    const wall = $('#wishes-wall');
    if (!wall) return;
    const note = document.createElement('div');
    note.className = 'wish-note';
    note.style.setProperty('--rot', (Math.random() * 8 - 4) + 'deg');
    note.innerHTML = `<div class="pin"></div><p class="wn-msg">${escapeHtml(w.msg)}</p><p class="wn-name">${escapeHtml(w.name)}</p>`;
    after(delay, () => {
      wall.prepend(note);
      void note.offsetWidth;
      note.classList.add('in');
      if (sound) A.whoosh();
    });
  }

  function onWish(e) {
    e.preventDefault();
    const name = $('#wish-name').value.trim();
    const msg = $('#wish-msg').value.trim();
    if (!name || !msg) return;
    const w = { name, msg };
    pinWish(w, 0, true);
    const store = JSON.parse(localStorage.getItem('sj_wishes') || '[]');
    store.unshift(w);
    localStorage.setItem('sj_wishes', JSON.stringify(store.slice(0, 60)));
    e.target.reset();
    /* PROD: also insert into Supabase + rely on realtime subscription. See README. */
  }

  /* =========================================================================
     STAGE 5 — THE FINALE
     ====================================================================== */
  function enterFinale() {
    phase = 'finale';
    A.ambient(false);
    timeTravel({ big: true }, () => {
      A.chime();
      sceneLayer.innerHTML = `
        <div class="finale-scene">
          <canvas id="confetti"></canvas>
          <div class="finale-inner">
            <div class="show-mark">✦  THE GRAND FINALE  ✦</div>
            <h1 class="finale-title">${COPY.finaleTitle}</h1>
            <p class="finale-sub">${COPY.finaleSub}</p>
            <p class="finale-wish">${COPY.finaleWish.replace(/\n/g, '<br>')}</p>
            <button class="ghost-btn" id="replay">↺ Watch the magic again</button>
          </div>
        </div>`;
      setChrome('ready');
      progress.innerHTML = `<span class="p-dot"></span> Happy Silver Jubilee`;
      wandPrev.classList.add('hidden'); wandNext.classList.add('hidden');
      runConfetti();
      $('#replay').addEventListener('click', () => location.reload(), { once: true });
    });
  }

  /* =========================================================================
     SPARKLES + CONFETTI + small SVGs
     ====================================================================== */
  function burstSparkles(x, y, n = 18) {
    for (let i = 0; i < n; i++) {
      const s = document.createElement('div');
      s.className = 'sparkle';
      const ang = Math.random() * Math.PI * 2, dist = 40 + Math.random() * 120;
      s.style.left = x + 'px'; s.style.top = y + 'px';
      s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      s.style.setProperty('--accent', getComputedStyle(stage).getPropertyValue('--accent'));
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 900);
    }
  }

  function runConfetti() {
    const c = $('#confetti'); if (!c) return;
    const ctx = c.getContext('2d');
    c.width = innerWidth; c.height = innerHeight;
    const cols = ['#ffd24a', '#d8534a', '#e3a9b6', '#c9963f', '#fff4d6'];
    const bits = Array.from({ length: 160 }, () => ({
      x: Math.random() * c.width, y: -20 - Math.random() * c.height,
      r: 4 + Math.random() * 6, c: cols[(Math.random() * cols.length) | 0],
      vy: 2 + Math.random() * 3, vx: -1 + Math.random() * 2, sp: Math.random() * 6,
    }));
    let frames = 0;
    (function loop() {
      ctx.clearRect(0, 0, c.width, c.height);
      bits.forEach(b => {
        b.y += b.vy; b.x += b.vx + Math.sin((frames + b.sp) / 18);
        if (b.y > c.height + 20) b.y = -20;
        ctx.fillStyle = b.c;
        ctx.fillRect(b.x, b.y, b.r, b.r * 1.6);
      });
      frames++;
      if (phase === 'finale') requestAnimationFrame(loop);
    })();
  }

  /* one premium wand, used everywhere (opening + both nav corners) */
  function wandSVG() {
    return `<svg viewBox="0 0 100 100" class="wand-svg" aria-hidden="true">
      <g class="wand-body">
        <line x1="27" y1="77" x2="61" y2="37" stroke="#160d07" stroke-width="8" stroke-linecap="round"/>
        <line x1="27" y1="77" x2="61" y2="37" stroke="#3c2616" stroke-width="3.6" stroke-linecap="round"/>
        <circle cx="29" cy="75" r="3.8" fill="#c9a44a"/>
        <circle cx="58.5" cy="39.5" r="3.1" fill="#e3c270"/>
      </g>
      <g class="wand-tip">
        <path class="wand-star" d="M64 17 l4.6 10.1 11 1 -8.2 7.4 2.2 10.9 -9.6-5.8 -9.6 5.8 2.2-10.9 -8.2-7.4 11-1z"
              fill="#ecc664" stroke="#fff4d2" stroke-width="1.2"/>
        <circle cx="60.5" cy="29.5" r="1.9" fill="#fffaf0" opacity="0.95"/>
        <path class="wand-mini m1" d="M84 23 l1.3 2.9 2.9 1.3 -2.9 1.3 -1.3 2.9 -1.3-2.9 -2.9-1.3 2.9-1.3z" fill="#fff1c8"/>
        <path class="wand-mini m2" d="M49 15 l1 2.2 2.2 1 -2.2 1 -1 2.2 -1-2.2 -2.2-1 2.2-1z" fill="#f1d385"/>
        <path class="wand-mini m3" d="M81 45 l1 2.2 2.2 1 -2.2 1 -1 2.2 -1-2.2 -2.2-1 2.2-1z" fill="#f1d385"/>
      </g></svg>`;
  }
  function reelSVG() {
    return `<svg viewBox="0 0 200 200" class="reel-svg">
      <circle cx="100" cy="100" r="92" fill="#161616" stroke="#000" stroke-width="4"/>
      <circle cx="100" cy="100" r="22" fill="#0a0a0a" stroke="#333" stroke-width="3"/>
      ${[0, 60, 120, 180, 240, 300].map(a => {
        const rad = a * Math.PI / 180, x = 100 + Math.cos(rad) * 56, y = 100 + Math.sin(rad) * 56;
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="18" fill="#0a0a0a" stroke="#333" stroke-width="2"/>`;
      }).join('')}
    </svg>`;
  }
  function starSVG() {
    return `<svg viewBox="0 0 100 100" class="star-svg"><path d="M50 4 l12 28 30 2 -23 20 8 30 -27 -17 -27 17 8 -30 -23 -20 30 -2z"
      fill="var(--accent)" stroke="#fff6dd" stroke-width="1.5"/></svg>`;
  }
  function bunnySVG() {
    return `<svg viewBox="0 0 120 140" class="bunny-svg">
      <ellipse cx="42" cy="44" rx="13" ry="40" fill="#fbf3e2"/>
      <ellipse cx="78" cy="44" rx="13" ry="40" fill="#fbf3e2"/>
      <ellipse cx="42" cy="48" rx="6" ry="28" fill="#f2b8c6"/>
      <ellipse cx="78" cy="48" rx="6" ry="28" fill="#f2b8c6"/>
      <circle cx="60" cy="96" r="34" fill="#fbf3e2"/>
      <circle cx="48" cy="90" r="4.5" fill="#3a2a22"/>
      <circle cx="72" cy="90" r="4.5" fill="#3a2a22"/>
      <path d="M55 102 q5 5 10 0" stroke="#3a2a22" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <circle cx="60" cy="100" r="3" fill="#f2a0b4"/>
    </svg>`;
  }

  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  /* =========================================================================
     DIRECTOR'S PANEL — dev-only jump menu (NOT part of the real experience)
     ====================================================================== */
  function buildDirector() {
    const panel = document.createElement('div');
    panel.id = 'director';
    panel.innerHTML = `<div class="dir-head">Director’s Panel <small>(prototype only)</small></div>
      <div class="dir-grid" id="dir-grid"></div>`;
    document.body.appendChild(panel);
    const grid = panel.querySelector('#dir-grid');
    const add = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { panel.classList.remove('open'); fn(); }; grid.appendChild(b); };
    // jumping past the opening means the curtain must already be raised
    const raise = () => curtains.classList.add('open');
    add('Opening', () => { phase = 'curtain'; buildOpening(); });
    SCENES.forEach((s, i) => add(s.kind === 'prologue' ? s.year : `Ch${s.chapterNo}·${s.year}`, () => { raise(); phase = 'story'; sceneIdx = i; busy = false; A.unlock(); renderScene(i); }));
    add('Gift Box', () => { raise(); busy = false; A.unlock(); enterGift(); });
    add('Wishes', () => { raise(); busy = false; A.unlock(); enterWishes(); });
    add('Finale', () => { raise(); busy = false; A.unlock(); enterFinale(); });

    $('#dir-toggle').addEventListener('click', () => panel.classList.toggle('open'));
  }

  /* ---- mute toggle -------------------------------------------------------- */
  $('#mute').addEventListener('click', e => {
    const m = !A.isMuted(); A.setMuted(m);
    e.currentTarget.textContent = m ? '🔇' : '🔊';
    e.currentTarget.classList.toggle('off', m);
  });

  /* golden dust drifting through the spotlight — the stage breathes even
     when nothing is happening. Tinted live by each year's accent colour. */
  function buildAtmosphere() {
    const layer = $('#atmosphere');
    if (!layer) return;
    for (let i = 0; i < 16; i++) {
      const m = document.createElement('span');
      m.className = 'mote';
      m.style.setProperty('--x', (Math.random() * 100) + '%');
      m.style.setProperty('--size', (2 + Math.random() * 3.5) + 'px');
      m.style.setProperty('--dur', (16 + Math.random() * 16) + 's');
      m.style.setProperty('--delay', -(Math.random() * 24) + 's');
      m.style.setProperty('--drift', (Math.random() * 60 - 30) + 'px');
      layer.appendChild(m);
    }
  }

  /* ---- boot --------------------------------------------------------------- */
  wandPrev.insertAdjacentHTML('afterbegin', wandSVG());   // same wand in both corners
  wandNext.insertAdjacentHTML('afterbegin', wandSVG());
  buildAtmosphere();
  buildDirector();
  // load real photos if a manifest exists (served over http); otherwise the
  // vintage placeholders stand in. file:// has no fetch, so it falls back too.
  fetch('media/manifest.json', { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : null))
    .then(m => { try { SJ_DATA.applyManifest(m); } catch (e) {} })
    .catch(() => {})
    .finally(buildOpening);
})();
