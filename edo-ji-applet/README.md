# JI vs EDO Visualizer

A simple client-side HTML/JS applet to visualize Just Intonation (JI) intervals against Equal Division of the Octave (EDO). Built in vanilla JavaScript with an HTML5 canvas.

## Features
- Adjustable EDO (number of equal steps per octave)
- Adjustable octave size (in cents) for stretch/compression
- Generate JI sets by odd-limit and prime-limit
- Enter manual intervals as fractions (e.g., `3/2`) or cents (e.g., `702`)
- Color-coded EDO ticks by deviation from nearest JI interval

## How to Use
1. Open `index.html` in any modern browser (double-click in Explorer).
2. Use the controls to change EDO, octave size, odd/prime limits, or type manual intervals.
3. The visualization updates in real time.

Notes:
- Manual intervals accept comma/space-separated values. Fractions are converted to cents; plain numbers are interpreted as cents.
- If both odd-limit and prime-limit are blank and manual list is empty, a default JI set (3/2, 5/4, 7/4) is shown.

## Development
All logic lives in `script.js`. The canvas draws two horizontal rulers:
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
  script.js
  README.md
```
