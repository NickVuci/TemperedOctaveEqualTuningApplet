const state = {
  ji: [], jiData: [], edo: [], octave: 1200, edoCount: 12,
  jiPixelXs: [], jiRows: 0, jiLineH: 14,
  selectedJiIndex: null,
};

export function getState() { return state; }

export function setState(patch) {
  Object.assign(state, patch);
}
