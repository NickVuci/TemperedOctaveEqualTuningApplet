import { getElements, readControls, wireControls, updateOctaveDisplay, wireTooltip, wireSelection } from "./ui/dom.js";
import { parseManualIntervalsDetailed } from "./parse/manual.js";
import { buildJI } from "./tuning/ji.js";
import { generateEDOIntervals } from "./tuning/edo.js";
import { drawRulers } from "./render/canvas.js";
import { LAYOUT } from "./render/constants.js";
import { getState, setState } from "./state/store.js";

const els = getElements();

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
    if (els.octaveDetuneInput.value !== '0.00') {
      els.octaveDetuneInput.value = '0.00';
      if (els.octaveDetuneSlider) els.octaveDetuneSlider.value = '0';
      // Immediate update after resetting detune
      update();
    }
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
    const clamped = Math.max(-50, Math.min(50, v));
    els.octaveDetuneSlider.value = String(clamped);
  });
  // Slider -> Number (real-time redraw)
  els.octaveDetuneSlider.addEventListener('input', (ev) => {
    const v = parseFloat(els.octaveDetuneSlider.value) || 0;
    els.octaveDetuneInput.value = v.toFixed(2);
    // Immediate update for smooth dragging/keys
    update();
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
    next = Math.max(-50, Math.min(50, next));
    els.octaveDetuneSlider.value = String(next);
    // Manually dispatch input to trigger sync and redraw
    els.octaveDetuneSlider.dispatchEvent(new Event('input', { bubbles: true }));
    // Extra immediate update for responsiveness
    update();
  });
}
wireTooltip(els, getState);
wireSelection(els, getState, (detune) => {
  if (els.octaveDetuneInput) {
    els.octaveDetuneInput.value = detune.toFixed(2);
    els.octaveDetuneInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (els.octaveDetuneSlider) {
    // Allow fine precision on slider
    const clamped = Math.max(-50, Math.min(50, detune));
    els.octaveDetuneSlider.value = String(Math.round(clamped * 100) / 100);
  }
});

// Resize handling
if (window.ResizeObserver) {
  const ro = new ResizeObserver(() => { resizeCanvasToContainer(); saveContainerSizeDebounced(); queuedUpdate(); });
  ro.observe(els.canvasContainer);
}
window.addEventListener('resize', () => { resizeCanvasToContainer(); saveContainerSizeDebounced(); queuedUpdate(); });

// First render
resizeCanvasToContainer();
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
