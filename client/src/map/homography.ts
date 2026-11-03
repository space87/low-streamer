// Four-point perspective calibration for the table map overlay.
// Maps board space (pixels of the rendered board) onto the camera image.

export interface Pt { x: number; y: number }
/** Row-major 3x3, h[8] normalised to 1. */
export type Homography = [number, number, number, number, number, number, number, number, number];

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (Math.abs(M[pivot][col]) < 1e-12) throw new Error("Degenerate corners: points must form a proper quadrilateral");
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let k = col; k <= n; k++) M[r][k] -= f * M[col][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** Homography taking each src[i] to dst[i] (exactly 4 points, in order). */
export function computeHomography(src: Pt[], dst: Pt[]): Homography {
  if (src.length !== 4 || dst.length !== 4) throw new Error("Need exactly 4 point pairs");
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solve(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

export function applyHomography(h: Homography, p: Pt): Pt {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

/**
 * CSS matrix3d for an element of size width×height (transform-origin: 0 0)
 * so its corners land on the 4 clicked camera points (TL, TR, BR, BL).
 */
export function cssMatrix3d(width: number, height: number, corners: [Pt, Pt, Pt, Pt]): string {
  const src = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
  const h = computeHomography(src, corners);
  // Column-major 4x4 embedding of the 2D homography.
  const m = [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, h[8]];
  return `matrix3d(${m.map((v) => +v.toFixed(10)).join(",")})`;
}

/** Convert a board-inch position to rendered board pixels. */
export function inchesToBoardPx(p: Pt, board: { widthIn: number; depthIn: number }, px: { width: number; height: number }): Pt {
  return { x: (p.x / board.widthIn) * px.width, y: px.height - (p.y / board.depthIn) * px.height };
}
