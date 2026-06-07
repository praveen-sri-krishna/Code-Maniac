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
  let timers = [];
  let renderToken = 0;          // invalidates async work when scene changes

  const PHOTO_MS = 2900;        // time each photo holds
  const after = (ms, fn) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

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
     OPENING — curtains, the question, the wand
     ====================================================================== */
  function buildOpening() {
    applyPalette({ bg1: '#1a0606', bg2: '#3a0d0d', accent: '#d9a441', sepia: 0, sat: 1, grayscale: 0 });
    sceneLayer.innerHTML = `
      <div class="opening">
        <div class="spotlight"></div>
        <div class="opening-inner">
          <div class="show-mark">✦  A MAGIC SHOW  ✦</div>
          <h1 class="question">${COPY.openingQuestion}</h1>
          <p class="question-sub">${COPY.openingSub}</p>
          <div class="wand opening-wand" id="opening-wand" role="button" aria-label="Tap the magic wand">
            ${wandSVG()}
            <span class="wand-hint">tap the wand</span>
          </div>
        </div>
      </div>`;
    curtains.classList.remove('open');           // closed to start
    after(120, () => curtains.classList.add('open'));   // curtains rise
    $('#opening-wand').addEventListener('click', startJourney, { once: true });
  }

  function startJourney() {
    if (busy) return;
    A.unlock(); A.sparkle();
    const w = $('#opening-wand');
    if (w) w.classList.add('cast');
    burstSparkles(window.innerWidth / 2, window.innerHeight * 0.62);
    after(520, () => {
      phase = 'story';
      sceneIdx = 0;
      timeTravel({ big: true }, () => renderScene(sceneIdx));
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

        <div class="narration" id="narration">
          <span class="nar-dot"></span>
          <span class="nar-text">${scene.narration}</span>
        </div>
      </div>`;

    updateHUD(scene);
    setWandSparkle(scene.palette.accent);
    armChapterReady(false);

    // title card holds, then the photo reel plays
    after(1500, () => {
      if (token !== renderToken) return;
      const tc = $('#title-card');
      if (tc) tc.classList.add('lift');
      playPhotos(scene, token);
    });
  }

  function playPhotos(scene, token) {
    const win = $('#reel-window');
    if (!win) return;
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

      win.innerHTML = '';
      const frame = makePhotoFrame(ph, scene);
      win.appendChild(frame);
      // force reflow then animate in
      void frame.offsetWidth;
      frame.classList.add('enter');
      p++;
      after(PHOTO_MS, () => {
        if (token !== renderToken) return;
        frame.classList.add('leave');
        after(420, showNext);
      });
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

  /* mark the chapter as finished → glow the Next wand + show hint */
  function armChapterReady(ready) {
    wandNext.classList.toggle('ready', ready);
    if (ready) {
      const nar = $('#narration');
      if (nar) nar.classList.add('done');
    }
  }

  /* =========================================================================
     HUD — progress indicator + wands
     ====================================================================== */
  function updateHUD(scene) {
    hud.classList.add('visible');
    const milestone = scene.milestone ? ' milestone' : '';
    progress.className = 'progress' + milestone;
    progress.innerHTML = scene.kind === 'prologue'
      ? `<span class="p-dot"></span> Prologue · ${scene.year}`
      : `<span class="p-dot"></span> ${scene.label}`;
    wandPrev.classList.toggle('hidden', false);
    wandNext.classList.remove('hidden');
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
      sceneIdx = target;
      A.sparkle();
      timeTravel({}, () => renderScene(sceneIdx));
    } else if (phase === 'gift' && dir < 0) {
      phase = 'story'; sceneIdx = SCENES.length - 1;
      timeTravel({}, () => renderScene(sceneIdx));
    }
  }

  wandNext.addEventListener('click', () => go(+1));
  wandPrev.addEventListener('click', () => go(-1));
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') go(+1);
    if (e.key === 'ArrowLeft') go(-1);
  });

  /* =========================================================================
     THE TIME-TRAVEL TRANSITION  (the heartbeat of the show)
     film-reel spin + vintage countdown leader + tunnel flash
     ====================================================================== */
  function timeTravel(opts, done) {
    busy = true;
    armChapterReady(false);
    A.reel(opts.big ? 1.3 : 0.95);
    if (opts.big) curtains.classList.remove('open');   // snap shut for the big jump

    fx.innerHTML = `
      <div class="tunnel ${opts.big ? 'big' : ''}"></div>
      <div class="film-reel">${reelSVG()}</div>
      <div class="leader"><div class="leader-sweep"></div><span class="leader-num">3</span></div>
      <div class="flash"></div>`;
    fx.classList.add('active');

    const leaderNum = fx.querySelector('.leader-num');
    const seq = opts.big ? ['3', '2', '1'] : ['2', '1'];
    seq.forEach((n, k) => after(180 + k * 230, () => { if (leaderNum) leaderNum.textContent = n; }));

    const mid = opts.big ? 950 : 700;
    after(mid, () => {
      done && done();
      fx.querySelector('.flash')?.classList.add('go');
      if (opts.big) after(120, () => curtains.classList.add('open'));
    });
    after(mid + 520, () => {
      fx.classList.remove('active');
      fx.innerHTML = '';
      busy = false;
    });
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
    progress.className = 'progress milestone';
    progress.innerHTML = `<span class="p-dot"></span> The Reveal`;
    wandNext.classList.add('hidden');
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
      progress.innerHTML = `<span class="p-dot"></span> The Wishes Wall`;
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
    note.innerHTML = `<div class="pin"></div><p class="wn-msg">${escapeHtml(w.msg)}</p><p class="wn-name">— ${escapeHtml(w.name)}</p>`;
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
      progress.innerHTML = `<span class="p-dot"></span> Happy Silver Jubilee`;
      wandPrev.classList.add('hidden');
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

  function wandSVG() {
    return `<svg viewBox="0 0 120 120" class="wand-svg">
      <defs><radialGradient id="tip" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#fff"/><stop offset="60%" stop-color="var(--accent)"/>
        <stop offset="100%" stop-color="transparent"/></radialGradient></defs>
      <g class="wand-rot">
        <rect x="56" y="34" width="8" height="58" rx="4" fill="#2a1a10" stroke="#000" stroke-width="1"/>
        <rect x="54" y="86" width="12" height="10" rx="3" fill="#e8d9b0"/>
        <rect x="54" y="30" width="12" height="10" rx="3" fill="#e8d9b0"/>
        <circle cx="60" cy="30" r="20" fill="url(#tip)"/>
        <path class="wand-star" d="M60 16 l4 9 10 1 -7 7 2 10 -9 -5 -9 5 2 -10 -7 -7 10 -1z" fill="var(--accent)"/>
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
    add('Opening', () => { phase = 'curtain'; buildOpening(); });
    SCENES.forEach((s, i) => add(s.kind === 'prologue' ? s.year : `Ch${s.chapterNo}·${s.year}`, () => { phase = 'story'; sceneIdx = i; busy = false; A.unlock(); renderScene(i); }));
    add('Gift Box', () => { busy = false; A.unlock(); enterGift(); });
    add('Wishes', () => { busy = false; A.unlock(); enterWishes(); });
    add('Finale', () => { busy = false; A.unlock(); enterFinale(); });

    $('#dir-toggle').addEventListener('click', () => panel.classList.toggle('open'));
  }

  /* ---- mute toggle -------------------------------------------------------- */
  $('#mute').addEventListener('click', e => {
    const m = !A.isMuted(); A.setMuted(m);
    e.currentTarget.textContent = m ? '🔇' : '🔊';
    e.currentTarget.classList.toggle('off', m);
  });

  /* ---- boot --------------------------------------------------------------- */
  buildOpening();
  buildDirector();
})();
