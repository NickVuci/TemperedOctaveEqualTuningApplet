import { getElements, readControls, wireControls, updateOctaveDisplay, wireTooltip, wireSelection } from "./ui/dom.js";
import { parseManualIntervalsDetailed } from "./parse/manual.js";
import { buildJI } from "./tuning/ji.js";
import { generateEDOIntervals } from "./tuning/edo.js";
import { drawRulers } from "./render/canvas.js";
import { LAYOUT } from "./render/constants.js";
import { getState, setState } from "./state/store.js";
import { optimizeDetune } from "./optimize/detune.js";

const els = getElements();
let refreshTooltip = () => {};

// --- Persistence for canvas container size ---
const STORAGE_KEY_SIZE = 'jiEdoVisualizer.canvasSize.v1';

function applyPersistedContainerSize() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SIZE);
    if (!raw) return;
    const { w, h } = JSON.parse(raw);
    const width = Number(w);
    const height = Number(h);
    if (Number.isFinite(width) && width > 0) {
      els.canvasContainer.style.width = Math.max(LAYOUT.minCanvas, Math.round(width)) + 'px';
    }
    if (Number.isFinite(height) && height > 0) {
      els.canvasContainer.style.height = Math.max(LAYOUT.minCanvas, Math.round(height)) + 'px';
    }
  } catch {}
}

let saveSizeTimer = null;
function saveContainerSizeDebounced() {
  if (saveSizeTimer) clearTimeout(saveSizeTimer);
  saveSizeTimer = setTimeout(() => {
    try {
      const rect = els.canvasContainer.getBoundingClientRect();
      const payload = { w: Math.round(rect.width), h: Math.round(rect.height) };
      localStorage.setItem(STORAGE_KEY_SIZE, JSON.stringify(payload));
    } catch {}
    saveSizeTimer = null;
  }, 150);
}

function getCanvasCssSize() {
  const rect = els.canvas.getBoundingClientRect();
  return { width: Math.max(LAYOUT.minCanvas, Math.floor(rect.width)), height: Math.max(LAYOUT.minCanvas, Math.floor(rect.height)) };
}

function resizeCanvasToContainer() {
  const dpr = window.devicePixelRatio || 1;
  const rect = els.canvasContainer.getBoundingClientRect();
  const cs = getComputedStyle(els.canvasContainer);
  const bwL = parseFloat(cs.borderLeftWidth) || 0;
  const bwR = parseFloat(cs.borderRightWidth) || 0;
  const bwT = parseFloat(cs.borderTopWidth) || 0;
  const bwB = parseFloat(cs.borderBottomWidth) || 0;
  const innerW = Math.max(LAYOUT.minCanvas, Math.floor(rect.width - bwL - bwR));
  const innerH = Math.max(LAYOUT.minCanvas, Math.floor(rect.height - bwT - bwB));
  els.canvas.style.width = innerW + 'px';
  els.canvas.style.height = innerH + 'px';
  els.canvas.width = Math.floor(innerW * dpr);
  els.canvas.height = Math.floor(innerH * dpr);
  els.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Immediate redraw with current state so visuals persist during resize
  redrawWithCurrentState();
}

function update() {
  const controls = readControls(els);
  updateOctaveDisplay(els, controls.octaveCents);
  const manualDetailed = parseManualIntervalsDetailed(controls.manualText);
  const jiData = buildJI({ oddLimit: (Number.isFinite(controls.oddLimit) && controls.oddLimit % 2 === 0) ? controls.oddLimit - 1 : controls.oddLimit, primeLimit: controls.primeLimit, manualDetailed });
  const jiIntervals = jiData.map(o => o.cents);
  // EDO intervals for current layout (may be detuned)
  const edoIntervals = generateEDOIntervals(controls.edo, controls.octaveCents);
  // EDO intervals for original mapping (always 1200c octave)
  const edoOriginal = generateEDOIntervals(controls.edo, 1200);
  const { width, height } = getCanvasCssSize();
  const res = drawRulers({ ctx: els.ctx, width, height, jiIntervals, jiData, edoIntervals, edoOriginalIntervals: edoOriginal, showEdoLabels: controls.showEdoLabels, showJiLabels: controls.showJiLabels, selectedJiIndex: getState().selectedJiIndex });
  setState({ ji: jiIntervals, jiData, edo: edoIntervals, edoOriginal, octave: controls.octaveCents, edoCount: controls.edo, jiPixelXs: res.jiPixelXs, jiRows: res.jiRows, jiLineH: res.jiLineH });
  // Update tooltip in place if visible
  try { refreshTooltip(); } catch {}
}

let updateTimer = null;
function queuedUpdate() {
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(() => { update(); updateTimer = null; }, 80);
}

// Init
applyPersistedContainerSize();
// Wire controls: immediate for number/range/checkbox, queued for others
wireControls(queuedUpdate, () => { update(); });
// When EDO changes, reset octave detune back to 0 cents
if (els.edoInput && els.octaveDetuneInput) {
  els.edoInput.addEventListener('input', () => {
    // Reset detune to 0 on EDO change
    if (els.octaveDetuneInput.value !== '0.00') {
      els.octaveDetuneInput.value = '0.00';
      if (els.octaveDetuneSlider) els.octaveDetuneSlider.value = '0';
    }
    // Auto-set max range to half of a single EDO step (in cents)
    const edoVal = parseInt(els.edoInput.value) || 12;
    const halfStep = 600 / Math.max(1, edoVal); // 0.5 * (1200/edo)
    if (els.detuneRangeMax) {
      els.detuneRangeMax.value = (Math.round(halfStep * 100) / 100).toString();
    }
    applySliderRangeFromInput();
    update();
  });
}
// Handle changes to max detune range and keep slider bounds synced
function getRangeMax() {
  const r = parseFloat(els.detuneRangeMax?.value);
  return Number.isFinite(r) && r >= 0 ? Math.min(600, r) : 50;
}
function applySliderRangeFromInput() {
  const R = getRangeMax();
  if (els.octaveDetuneSlider) {
    els.octaveDetuneSlider.min = String(-R);
    els.octaveDetuneSlider.max = String(R);
    // Clamp current slider value to new bounds
    const cur = parseFloat(els.octaveDetuneSlider.value) || 0;
    const clamped = Math.max(-R, Math.min(R, cur));
    els.octaveDetuneSlider.value = String(clamped);
  }
  if (els.octaveDetuneInput) {
    const cur = parseFloat(els.octaveDetuneInput.value) || 0;
    const clamped = Math.max(-R, Math.min(R, cur));
    els.octaveDetuneInput.value = clamped.toFixed(2);
  }
}
if (els.detuneRangeMax) {
  els.detuneRangeMax.addEventListener('input', () => {
    applySliderRangeFromInput();
    update();
    refreshTooltip();
  });
}
// Keep slider and number input in lockstep
if (els.octaveDetuneSlider && els.octaveDetuneInput) {
  // First click focuses slider without changing value
  const slider = els.octaveDetuneSlider;
  const focusOnlyIfUnfocused = (e) => {
    if (document.activeElement !== slider) {
      e.preventDefault();
      // Avoid jump in value on first click; just focus
      try { slider.focus({ preventScroll: true }); } catch { slider.focus(); }
    }
  };
  slider.addEventListener('pointerdown', focusOnlyIfUnfocused);
  slider.addEventListener('mousedown', focusOnlyIfUnfocused);
  slider.addEventListener('touchstart', focusOnlyIfUnfocused, { passive: false });

  // Number -> Slider
  els.octaveDetuneInput.addEventListener('input', () => {
    const v = parseFloat(els.octaveDetuneInput.value) || 0;
    // Clamp to slider bounds but do not snap; allow fine precision on slider
    const R = getRangeMax();
    const clamped = Math.max(-R, Math.min(R, v));
    els.octaveDetuneSlider.value = String(clamped);
  });
  // Slider -> Number (real-time redraw)
  els.octaveDetuneSlider.addEventListener('input', (ev) => {
    const v = parseFloat(els.octaveDetuneSlider.value) || 0;
    els.octaveDetuneInput.value = v.toFixed(2);
    // Immediate update for smooth dragging/keys
    update();
    // Keep tooltip synced while dragging
    refreshTooltip();
    // Prevent duplicate queued updates from global handlers
    if (ev && typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
  });
  // Custom fine-grained keyboard control on slider
  els.octaveDetuneSlider.addEventListener('keydown', (e) => {
    const key = e.key;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'ArrowUp' && key !== 'ArrowDown') return;
    e.preventDefault();
    const cur = parseFloat(els.octaveDetuneSlider.value) || 0;
    const delta = (key === 'ArrowLeft' ? -0.1 : key === 'ArrowRight' ? 0.1 : key === 'ArrowUp' ? 0.01 : -0.01);
    let next = cur + delta;
    // round to 2 decimals to avoid float drift
    next = Math.round(next * 100) / 100;
  const R = getRangeMax();
  next = Math.max(-R, Math.min(R, next));
    els.octaveDetuneSlider.value = String(next);
    // Manually dispatch input to trigger sync and redraw
    els.octaveDetuneSlider.dispatchEvent(new Event('input', { bubbles: true }));
    // Extra immediate update for responsiveness
    update();
    refreshTooltip();
  });
}
refreshTooltip = wireTooltip(els, getState);
wireSelection(els, getState, (detune) => {
  if (els.octaveDetuneInput) {
    els.octaveDetuneInput.value = detune.toFixed(2);
    els.octaveDetuneInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (els.octaveDetuneSlider) {
    // Allow fine precision on slider
    const R = getRangeMax();
    const clamped = Math.max(-R, Math.min(R, detune));
    els.octaveDetuneSlider.value = String(Math.round(clamped * 100) / 100);
  }
});

// Optimize detune: search within [-50, 50] cents for best alignment
if (els.optimizeDetuneBtn) {
  els.optimizeDetuneBtn.addEventListener('click', () => {
    const state = getState();
    const jiIntervals = state && Array.isArray(state.ji) ? state.ji : [];
    if (!jiIntervals.length) return;
    const edo = parseInt(els.edoInput.value) || (state.edoCount || 12);
    const scheme = (els.optimizeSchemeSelect && els.optimizeSchemeSelect.value) || 'uniform';
    const symmetric = !!(els.symmetricOptimize && els.symmetricOptimize.checked);
    const within = parseFloat(els.optWithin?.value) || 15;
    const bonus5 = parseFloat(els.optBonus5?.value) || 0.5;
    const bonus1 = parseFloat(els.optBonus1?.value) || 0.5;
    const power = parseFloat(els.optPower?.value) || 1;
    const oddPower = parseFloat(els.optOddPower?.value) || 0.6;
    const primePower = parseFloat(els.optPrimePower?.value) || 0.8;

    const R = getRangeMax();
    const { detune: det } = optimizeDetune({
      edo,
      jiIntervals,
      jiData: state.jiData || [],
      generateEDOIntervals,
      scheme,
      params: {
        symmetric,
        power,
        oddPower,
        primePower,
        proximity: { within, bonus5, bonus1 },
      },
      bounds: { min: -R, max: R },
    });

    if (els.octaveDetuneInput) {
      els.octaveDetuneInput.value = det.toFixed(2);
      els.octaveDetuneInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (els.octaveDetuneSlider) {
      els.octaveDetuneSlider.value = String(det);
    }
    refreshTooltip();
  });
}

// Resize handling
if (window.ResizeObserver) {
  const ro = new ResizeObserver(() => { resizeCanvasToContainer(); saveContainerSizeDebounced(); queuedUpdate(); });
  ro.observe(els.canvasContainer);
}
window.addEventListener('resize', () => { resizeCanvasToContainer(); saveContainerSizeDebounced(); queuedUpdate(); });

// First render
resizeCanvasToContainer();
// Initialize detune range to half-step for current EDO
if (els.edoInput && els.detuneRangeMax) {
  const edoVal0 = parseInt(els.edoInput.value) || 12;
  const halfStep0 = 600 / Math.max(1, edoVal0);
  els.detuneRangeMax.value = (Math.round(halfStep0 * 100) / 100).toString();
}
applySliderRangeFromInput();
update();

// Redraw helper using current state and current label toggles
function redrawWithCurrentState() {
  const state = getState();
  if (!state || !Array.isArray(state.ji) || !state.ji.length || !Array.isArray(state.edo) || !state.edo.length) return;
  const { width, height } = getCanvasCssSize();
  const showEdoLabels = !!(els.showEdoLabelsEl && els.showEdoLabelsEl.checked);
  const showJiLabels = !!(els.showJiLabelsEl && els.showJiLabelsEl.checked);
  const res = drawRulers({
    ctx: els.ctx,
    width,
    height,
    jiIntervals: state.ji,
    jiData: state.jiData,
    edoIntervals: state.edo,
    edoOriginalIntervals: state.edoOriginal || generateEDOIntervals(state.edoCount || 12, 1200),
    showEdoLabels,
    showJiLabels,
    selectedJiIndex: state.selectedJiIndex,
  });
  setState({ jiPixelXs: res.jiPixelXs, jiRows: res.jiRows, jiLineH: res.jiLineH });
}
