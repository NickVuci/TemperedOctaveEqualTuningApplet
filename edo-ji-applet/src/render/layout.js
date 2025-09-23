import { maxPrimeFactor } from "../utils/math.js";
import { LAYOUT, FONTS } from "./constants.js";

// Compute multi-row assignment for JI labels so all display
// Returns { rows, rowOf, lineH }
/**
 * Compute multi-row label layout for JI fractions.
 * @param {{ctx:CanvasRenderingContext2D,width:number,jiIntervals:number[],jiData:any[],showJiLabels:boolean}} args
 * @returns {{rows:number,rowOf:number[],lineH:number}}
 */
export function computeJiLabelRows({ ctx, width, jiIntervals, jiData, showJiLabels }) {
  const lineH = LAYOUT.jiLabelLineHeight;
  const rowOf = [];
  if (!showJiLabels || !jiIntervals || jiIntervals.length === 0) {
    return { rows: 0, rowOf, lineH };
  }
  ctx.font = FONTS.label;
  const gap = LAYOUT.labelGap;
  let items = jiIntervals.map((c, i) => {
    const jiObj = jiData && jiData[i];
    const label = (jiObj && jiObj.n && jiObj.d) ? `${jiObj.n}/${jiObj.d}` : '';
    if (!label) return null;
    const x = (c / 1200) * width;
    const w = ctx.measureText(label).width + 6;
    const l = x - w / 2, r = x + w / 2;
    let pr = 9999;
    if (jiObj && jiObj.n && jiObj.d) pr = Math.max(maxPrimeFactor(jiObj.n), maxPrimeFactor(jiObj.d));
    return { i, x, w, l, r, pr };
  }).filter(Boolean);
  if (items.length === 0) return { rows: 0, rowOf, lineH };

  items.sort((a, b) => (a.l - b.l) || (a.pr - b.pr));

  let rows = 0;
  while (items.length) {
    rows++;
    const placed = [];
    let lastRight = -Infinity;
    for (let k = 0; k < items.length; k++) {
      const it = items[k];
      if (it.l > lastRight + gap) {
        placed.push(it);
        lastRight = it.r;
      } else {
        const prev = placed[placed.length - 1];
        if (prev && it.pr < prev.pr) {
          placed[placed.length - 1] = it;
          lastRight = it.r;
        }
      }
    }
    for (const p of placed) rowOf[p.i] = rows - 1;
    const placedSet = new Set(placed.map(p => p.i));
    items = items.filter(it => !placedSet.has(it.i));
  }
  return { rows, rowOf, lineH };
}
