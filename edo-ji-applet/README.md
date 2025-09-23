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
