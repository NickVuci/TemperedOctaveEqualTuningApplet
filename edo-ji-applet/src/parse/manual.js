import { ratioToCents, normalizeOctaveFraction } from "../utils/math.js";

/**
 * Parse manual interval text into objects. Accepts 'n/d', '702', or '702c'.
 * @param {string} text
 * @returns {{cents:number,n?:number,d?:number,source:string}[]}
 */
export function parseManualIntervalsDetailed(text) {
  if (!text) return [];
  const out = [];
  const parts = text.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
  for (const token of parts) {
    if (/^\d+\s*\/\s*\d+$/.test(token)) {
      const [rawN, rawD] = token.split("/").map(v => parseFloat(v));
      if (rawD !== 0 && Number.isFinite(rawN) && Number.isFinite(rawD)) {
        const { n, d } = normalizeOctaveFraction(rawN, rawD);
        const r = n / d;
        out.push({ cents: ratioToCents(r), n, d, source: 'manual' });
      }
      continue;
    }
    if (/^[-+]?\d+(?:\.\d+)?\s*(?:c|cent|cents|\u00A2)$/i.test(token)) {
      const num = parseFloat(token);
      if (Number.isFinite(num)) out.push({ cents: num, source: 'manual' });
      continue;
    }
    const num = parseFloat(token);
    if (Number.isFinite(num)) out.push({ cents: num, source: 'manual' });
  }
  return out;
}
