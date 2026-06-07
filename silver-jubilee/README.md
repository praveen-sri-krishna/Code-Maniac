# 🎭 Silver Jubilee — Magic Show: From Retro to Now

A surprise 25th-anniversary website for **Preethi & Sathi**, built as a *magic
show that is secretly a film screening*. The curtains rise, a magic wand is
tapped, and the viewer is pulled back through time — from a black-and-white
"before marriage" prologue through 25 colour chapters (one per year, colour
slowly blooming from sepia to full gold) — to a gift-box video reveal, a live
wishes wall, and a confetti finale.

> This is the **working prototype**. The theme, the usage/flow, and the
> transitions are all built and tunable. Real photos, video, narration and music
> drop in later (see below) — no code changes needed.

---

## ▶ Run it

It's pure HTML/CSS/JS — no build step.

```bash
# from this folder
python3 -m http.server 8080
# then open http://localhost:8080
```

(Opening `index.html` directly works too, but a tiny server avoids browser
file-loading quirks for audio/video.)

**Controls**
- Tap the **wand** to begin · tap the **◀ ▶ side wands** (or ← → arrow keys) to move between chapters.
- **🔊** top-right toggles sound · **✦** opens the *Director's Panel* — a prototype-only jump menu to preview any scene. (It is not part of the real experience and is trivially removed.)

---

## ✨ What's built (the three things you asked to focus on)

| Focus | What's in the prototype |
|---|---|
| **Theme** | The magic show is the through-line everywhere: velvet curtains, a glowing wand as the *only* navigation, sparkle bursts, and film-reel transitions. The "edit" treatment is old-Bollywood / vintage: film grain, sepia title cards, Polaroid frames for colour years, sprocket-hole film strips for the B&W prologue. |
| **Usage / flow** | The complete journey is wired: Opening → Prologue (1974, 1982) → 25 colour chapters → Gift Box reveal → Wishes Wall → Finale. Full-screen, no scrolling inside chapters, subtle "Year X of 25" progress indicator, milestone years glow. |
| **Transitions** | A reusable **time-travel transition** (film-reel spin + vintage countdown leader + tunnel + flash) fires between every scene. Curtains part on open and snap shut on the big jump. Photos enter via Polaroid-drop / Ken Burns / pop-up / zoom / collage. Colour evolves gradually across all 25 years via one interpolation function. |

---

## 🖼 Adding real content later (this is the whole point)

**You only ever edit `js/data.js`.** Everything is data-driven.

### Photos
Each photo points at a file in `media/<year>/`. Until the file exists, a tasteful
vintage "undeveloped film" placeholder shows with the caption. Drop the real file
in and it simply appears — no code change.

```
media/2001/01.jpg     media/2001/02.jpg     media/2001/03.jpg
media/2007/01.jpg     ...
media/1974/01.jpg     (prologue)
```

To change a caption, the number of photos, or the entrance animation for a year,
edit that chapter's entry in `js/data.js`:

```js
photos: [
  photo(2001, 1, 'Two hearts, one mandap.', 'kenburns'),
  photo(2001, 2, 'The day everything changed.', 'polaroid'),
  // anim ∈ polaroid | kenburns | popup | zoom | collage
]
```

### The gift-box video
Drop your compiled family video at **`media/finale/family.mp4`**. Until then a
labelled placeholder shows in the frame.

### Narration & music (production)
The prototype uses synthesised sound effects (Web Audio) so the magic is audible.
For the real thing, load files with **Howler.js** — one narration track and one
era song per chapter. Add the file paths to each chapter in `data.js` and play
them from `renderScene()`. Recommended: narration louder, music underneath.

### Colours
The B&W → gold journey is controlled by `PALETTE_STOPS` in `data.js`. Nudge a
stop's `sepia` / `sat` / `accent` and every in-between year re-interpolates
automatically.

---

## 🌐 Going live (free, per the brief)

- **Hosting:** Cloudflare Pages — unlimited bandwidth on the free tier (ideal for
  50+ people loading media at once). Drag this folder in, or connect the repo.
- **Wishes Wall (real-time):** Supabase. The prototype stores wishes in
  `localStorage`; swap `onWish()` / `seedWishes()` in `app.js` for a Supabase
  table + realtime subscription:

  ```js
  // insert
  await supabase.from('wishes').insert({ name, msg });
  // live for all 50+ users
  supabase.channel('wishes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wishes' },
        ({ new: w }) => pinWish(w, 0, true))
    .subscribe();
  ```

  ⚠️ Supabase free projects pause after 7 days idle — send one test wish 1–2 days
  before the event (or set a GitHub Actions cron ping) so it's awake on the day.
- **Video:** Cloudflare Stream (free 1,000 min) is mobile-optimised for the reveal.

---

## 📁 Structure

```
silver-jubilee/
├── index.html         # stage shell
├── css/styles.css     # the entire vintage / magic-show look
├── js/
│   ├── data.js        # ← THE STORY. edit this to add content
│   ├── audio.js       # synthesised SFX (placeholder for narration/music)
│   └── app.js         # engine: stage machine, photo player, transitions
└── media/
    ├── <year>/        # drop photos here (01.jpg, 02.jpg, …)
    └── finale/        # family.mp4
```

---

## 🔜 Suggested next steps
1. Replace sample captions with Preru & Sammu's real words in `data.js`.
2. Drop the first batch of real photos into `media/<year>/`.
3. Decide the wedding colour-burst style and gift-box style (the brief lists options).
4. Wire Supabase for the live wishes wall.
5. Record narration; add Howler.js playback.
6. Deploy to Cloudflare Pages.

*Made with love for Preethi & Sathi — 25 years and counting.*
