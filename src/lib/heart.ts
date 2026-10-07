/**
 * Mathematical representation of the Billion-Coin Heart.
 *
 * We never render a billion nodes. We sample a grid, keep the points that fall
 * inside the classic heart curve, and treat each rendered cell as a
 * representative "window" onto the full billion.
 */

export interface HeartCell {
  index: number;
  /** percentage position inside the square container */
  x: number;
  y: number;
  size: number;
  /** deterministic 0..1 jitter used for subtle visual variation */
  seed: number;
  coin_number: number;
}

const COIN_NUMBER_BASE = 18000;

function inHeart(x: number, y: number) {
  const a = x * x + y * y - 1;
  return a * a * a - x * x * (y * y * y) <= 0;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function buildHeart(resolution = 46): HeartCell[] {
  const cells: HeartCell[] = [];
  const span = 3.4;
  const step = span / resolution;
  let index = 0;

  for (let row = 0; row < resolution; row++) {
    for (let col = 0; col < resolution; col++) {
      const x = -span / 2 + step * (col + 0.5);
      const yMath = span / 2 - step * (row + 0.5);
      // slight vertical squeeze keeps the silhouette elegant rather than squat
      if (!inHeart(x / 1.22, yMath / 1.12)) continue;

      const seed = round3(hash(index + 1));
      cells.push({
        index,
        x: round3(((x + span / 2) / span) * 100),
        y: round3(((span / 2 - yMath) / span) * 100),
        size: round3((100 / resolution) * 0.78),
        seed,
        coin_number: COIN_NUMBER_BASE + index,
      });
      index++;
    }
  }
  return cells;
}

export const CLAIMED_BASELINE = 18472;
