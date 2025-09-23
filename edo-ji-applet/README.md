# JI vs EDO Visualizer

A simple client-side HTML/JS applet to visualize Just Intonation (JI) intervals against Equal Division of the Octave (EDO). Built in vanilla JavaScript with an HTML5 canvas.

## Features
- Adjustable EDO (number of equal steps per octave)
- Octave detuning (± cents) with live total octave display (1200 + detuning)
- Generate JI sets by odd-limit (odd-only) and optional prime-limit filtering
- Enter manual intervals as fractions (e.g., `3/2`) or cents (e.g., `702`)
- Color-coded EDO ticks by deviation from nearest JI interval

## How to Use
1. Open `index.html` in any modern browser (double-click in Explorer).
2. Use the controls to change EDO, octave size, odd/prime limits, or type manual intervals.
3. The visualization updates in real time.

Notes:
- Manual intervals accept comma/space-separated values. Fractions are converted to cents; plain numbers are interpreted as cents.
- Odd-limit input is odd-only; even entries are rounded down to the nearest odd. The set consists of reduced odd/odd ratios n/d (n,d odd ≤ odd-limit), mapped into [1, 2), plus 1/1.
- Prime-limit is optional: when > 0, it filters the odd-limit set to those intervals whose ratios can be expressed using only primes ≤ prime-limit (within a small tolerance); when 0, no filtering is done.
- Deviations are shown to two decimal places; tiny deviations (< 0.01c) are treated as zero for coloring.

## Development
The app is implemented as browser-native ES Modules under `src/`. The entrypoint is `src/main.js`, loaded from `index.html` via `<script type="module">`. The canvas draws two horizontal rulers:
- Top: EDO ticks (0..EDO) colored by deviation from nearest JI interval
- Bottom: JI ticks (0..1200 cents)

Color scheme for EDO deviations:
- 0 cents: green
- ≤ 1 cent: yellow
- ≤ 5 cents: orange
- ≤ 10 cents: red
- > 10 cents: black

## Folder Structure
```
edo-ji-applet/
  index.html
  README.md
  src/
    main.js
    state/
      store.js
    ui/
      dom.js
    parse/
      manual.js
    tuning/
      edo.js
      ji.js
    render/
      canvas.js
      layout.js
      constants.js
    utils/
      math.js
      array.js
```

## Development: editing modules
- Entry point: `src/main.js` orchestrates control reads, data building, and drawing.
- UI & DOM: `src/ui/dom.js` centralizes element lookups and event wiring (controls, tooltip, selection).
- Rendering: `src/render/canvas.js` (drawing), `src/render/layout.js` (label packing), `src/render/constants.js` (colors/fonts/gaps), `src/render/scale.js` (cents↔x helpers).
- Tuning logic: `src/tuning/edo.js` and `src/tuning/ji.js` (pure functions, no DOM access).
- Parsing: `src/parse/manual.js` handles fractions/cents input.
- Utilities: `src/utils/math.js` (ratios, gcd, normalization), `src/utils/array.js` (nearest, uniq by cents).
- State: `src/state/store.js` keeps the last computed values shared across modules.

Conventions
- Keep render and tuning modules pure (no direct DOM reads). Pass data/flags in via function args.
- Use JSDoc on exported functions for better IntelliSense and clarity.
- Keep imports relative and browser-friendly (no bundler required). The app runs by opening `index.html`.

Adding a new feature (example)
1. Define any new math/array helpers in `src/utils/` (with JSDoc).
2. Extend parsing or tuning in `src/parse/` or `src/tuning/` as needed (pure functions).
3. If it affects layout/drawing, add options to `drawRulers` or `computeJiLabelRows` (keep them pure) and thread flags from `main`.
4. Wire new UI controls in `src/ui/dom.js` and thread values into `main.update()`.
5. Update `index.html` controls if a new input or toggle is needed.

Running locally
- Open `index.html` directly in a modern browser. Since everything is ES Modules and static assets, no build step is required.
