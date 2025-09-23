# JI vs EDO Visualizer – Development Instructions

This document provides step-by-step guidance for creating a simple **client-side HTML/JS applet** in vanilla JavaScript.  
The applet will visualize **Just Intonation (JI) intervals vs Equal Division of the Octave (EDO)**, with interactive controls for EDO size and octave stretch/compression.

---

## Step 1: Project Setup
1. Open **VSCode**.
2. Create a new folder for the project, e.g., `edo-ji-applet`.
3. Inside the folder, create:
  - `index.html`
  - `README.md` (this file can serve as documentation).
  - `src/` (ES Modules live here)

---

## Step 2: Basic HTML Structure
1. In `index.html`, add the following boilerplate:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JI vs EDO Visualizer</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    canvas { border: 1px solid black; margin-top: 20px; }
    .controls { margin-bottom: 20px; }
    label { display: block; margin-top: 10px; }
  </style>
</head>
<body>
  <h1>JI vs EDO Visualizer</h1>
  <div class="controls">
    <label>EDO: <input type="number" id="edoInput" value="12" min="1"></label>
    <label>Octave Size (cents): <input type="number" id="octaveInput" value="1200" step="1"></label>
    <label>Odd Limit: <input type="number" id="oddLimitInput" value="7" min="1"></label>
    <label>Prime Limit: <input type="number" id="primeLimitInput" value="5" min="2"></label>
    <label>Manual Intervals (comma separated, e.g. 3/2, 5/4, 7/4):</label>
    <textarea id="manualIntervals" rows="3" cols="50"></textarea>
  </div>
  <canvas id="visualizer" width="1000" height="200"></canvas>

  <script type="module" src="./src/main.js"></script>
</body>
</html>
```

---

## Step 3: Add JavaScript Logic
1. Create `src/` with modular files. Example breakdown:
  - `src/utils/math.js` — ratio helpers
  - `src/tuning/edo.js` — EDO generation
  - `src/render/canvas.js` — drawing
  - `src/main.js` — wire inputs and draw
2. Implement core helper functions in `src/utils/math.js`:

```javascript
function ratioToCents(ratio) {
  return 1200 * Math.log2(ratio);
}

function generateEDOIntervals(edo, octaveCents) {
  let step = octaveCents / edo;
  return Array.from({ length: edo + 1 }, (_, i) => i * step);
}

function getColorForDeviation(diff) {
  let absDiff = Math.abs(diff);
  if (absDiff === 0) return "green";
  if (absDiff <= 1) return "yellow";
  if (absDiff <= 5) return "orange";
  if (absDiff <= 10) return "red";
  return "black";
}
```

---

## Step 4: Drawing the Rulers
1. Use the `canvas` API to draw two rulers:
   - Bottom ruler = JI intervals.
   - Top ruler = EDO intervals.
2. Example function:

```javascript
function drawRulers(ctx, jiIntervals, edoIntervals, width, height) {
  ctx.clearRect(0, 0, width, height);

  // Draw JI intervals (bottom line)
  ctx.strokeStyle = "blue";
  ctx.beginPath();
  ctx.moveTo(0, height - 20);
  ctx.lineTo(width, height - 20);
  ctx.stroke();
  jiIntervals.forEach(c => {
    let x = (c / 1200) * width;
    ctx.fillStyle = "blue";
    ctx.fillRect(x, height - 30, 2, 10);
  });

  // Draw EDO intervals (top line)
  ctx.strokeStyle = "black";
  ctx.beginPath();
  ctx.moveTo(0, 20);
  ctx.lineTo(width, 20);
  ctx.stroke();
  edoIntervals.forEach(c => {
    let x = (c / 1200) * width;
    let nearest = jiIntervals.reduce((a, b) => Math.abs(b - c) < Math.abs(a - c) ? b : a);
    let diff = c - nearest;
    ctx.fillStyle = getColorForDeviation(diff);
    ctx.fillRect(x, 10, 2, 10);
  });
}
```

---

## Step 5: Handling Inputs and Updates
1. Add event listeners in `src/main.js` to recompute intervals and redraw when inputs change.

```javascript
const canvas = document.getElementById("visualizer");
const ctx = canvas.getContext("2d");

function update() {
  const edo = parseInt(document.getElementById("edoInput").value);
  const octaveCents = parseFloat(document.getElementById("octaveInput").value);
  // For now, use simple hardcoded JI intervals
  const jiIntervals = [ratioToCents(3/2), ratioToCents(5/4), ratioToCents(7/4)];

  const edoIntervals = generateEDOIntervals(edo, octaveCents);
  drawRulers(ctx, jiIntervals, edoIntervals, canvas.width, canvas.height);
}

document.querySelectorAll("input, textarea").forEach(el => el.addEventListener("input", update));

update();
```

---

## Step 6: Extending Functionality
- Implement odd-limit and prime-limit interval generation.
- Parse manual intervals from textarea (`3/2`, `5/4`, or cent values).
- Add tooltips showing interval data when hovering over ticks.

---

## Step 7: Testing
- Open `index.html` in a browser.
- Change inputs and verify real-time updates.

---

## Step 8: Future Enhancements (Optional)
- Toggle between **absolute cents** and **relative to JI nearest approximation**.
- Add multiple rows for different EDOs at once.
- Export visualization as image or JSON.

---

## File Structure
```
edo-ji-applet/
  index.html
  README.md
  src/
    main.js
    utils/
      math.js
    tuning/
      edo.js
    render/
      canvas.js
```

---

This is the development roadmap. Copilot should be guided step by step by editing `index.html` and the modules in `src/` in VSCode, following the instructions above.
