// Pixel art sprite data for Claude Avatars
// Each sprite is a 16x16 grid where values represent palette indices:
// 0 = transparent
// 1 = body (recolored per session)
// 2 = body shadow (darker variant)
// 3 = eyes / dark details
// 4 = white / highlights
// 5 = accent (mouth, blush, etc.)

export type SpriteFrame = number[][];

export interface SpriteAnimation {
  frames: SpriteFrame[];
  particleEffect?: 'sparkle' | 'bubbles' | 'zzz' | 'exclamation';
}

export type SpriteSet = Record<string, SpriteAnimation>;

// Base creature shape - a cute round blob with stubby legs
const BASE_BODY: SpriteFrame = [
  [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,1,1,1,3,3,1,1,3,3,1,1,1,0,0],
  [0,0,1,1,1,3,4,1,1,3,4,1,1,1,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,1,1,1,1,1,5,5,1,1,1,1,1,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,2,1,1,2,1,1,0,0,0,0],
  [0,0,0,0,1,1,2,1,1,2,1,1,0,0,0,0],
  [0,0,0,0,0,2,2,0,0,2,2,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

// --- IDLE STATE ---
// Frame 1: eyes open, neutral
const IDLE_1: SpriteFrame = BASE_BODY.map(row => [...row]);

// Frame 2: eyes half closed (sleepy)
const IDLE_2: SpriteFrame = BASE_BODY.map((row, y) => {
  const newRow = [...row];
  if (y === 5) { // Top of eyes → closed
    newRow[5] = 1; newRow[6] = 1; newRow[9] = 1; newRow[10] = 1;
  }
  if (y === 6) { // Eyes become lines
    newRow[5] = 3; newRow[6] = 3; newRow[9] = 3; newRow[10] = 3;
  }
  return newRow;
});

// Frame 3: eyes closed (blink)
const IDLE_3: SpriteFrame = BASE_BODY.map((row, y) => {
  const newRow = [...row];
  if (y === 5) {
    newRow[5] = 1; newRow[6] = 1; newRow[9] = 1; newRow[10] = 1;
  }
  if (y === 6) {
    newRow[5] = 1; newRow[6] = 3; newRow[9] = 1; newRow[10] = 3;
  }
  return newRow;
});

// --- CODING STATE ---
// Frame 1: happy eyes, sparkle particles
const CODING_1: SpriteFrame = BASE_BODY.map((row, y) => {
  const newRow = [...row];
  // Happy curved eyes
  if (y === 5) {
    newRow[5] = 1; newRow[6] = 1; newRow[9] = 1; newRow[10] = 1;
  }
  if (y === 6) {
    newRow[5] = 1; newRow[6] = 3; newRow[9] = 1; newRow[10] = 3;
  }
  // Wide smile
  if (y === 8) {
    newRow[6] = 5; newRow[7] = 5; newRow[8] = 5; newRow[9] = 5;
  }
  return newRow;
});

// Frame 2: same but slight body shift (typing motion)
const CODING_2: SpriteFrame = CODING_1.map((row, y) => {
  const newRow = [...row];
  // Slight vertical shift simulation — compress middle
  if (y === 11) {
    return BASE_BODY[11].map(v => v);
  }
  return newRow;
});

// --- THINKING STATE ---
// Frame 1: eyes looking up
const THINKING_1: SpriteFrame = BASE_BODY.map((row, y) => {
  const newRow = [...row];
  // Eyes look up
  if (y === 5) {
    newRow[5] = 3; newRow[6] = 4; newRow[9] = 3; newRow[10] = 4;
  }
  if (y === 6) {
    newRow[5] = 1; newRow[6] = 1; newRow[9] = 1; newRow[10] = 1;
  }
  // Small 'o' mouth (thinking)
  if (y === 8) {
    newRow[7] = 3; newRow[8] = 3;
  }
  return newRow;
});

// Frame 2: eyes looking up-right
const THINKING_2: SpriteFrame = BASE_BODY.map((row, y) => {
  const newRow = [...row];
  if (y === 5) {
    newRow[5] = 1; newRow[6] = 4; newRow[9] = 1; newRow[10] = 4;
  }
  if (y === 6) {
    newRow[5] = 1; newRow[6] = 3; newRow[9] = 1; newRow[10] = 3;
  }
  if (y === 8) {
    newRow[7] = 3; newRow[8] = 3;
  }
  return newRow;
});

// --- ERROR STATE ---
// Frame 1: X eyes, frown
const ERROR_1: SpriteFrame = BASE_BODY.map((row, y) => {
  const newRow = [...row];
  // X eyes
  if (y === 5) {
    newRow[5] = 3; newRow[6] = 1; newRow[9] = 3; newRow[10] = 1;
  }
  if (y === 6) {
    newRow[5] = 1; newRow[6] = 3; newRow[9] = 1; newRow[10] = 3;
  }
  // Frown
  if (y === 8) {
    newRow[6] = 1; newRow[7] = 1; newRow[8] = 1; newRow[9] = 1;
  }
  if (y === 9) {
    newRow[7] = 5; newRow[8] = 5;
  }
  return newRow;
});

// Frame 2: same with shifted accents
const ERROR_2: SpriteFrame = ERROR_1.map(row => [...row]);

// Export all animations
export const SPRITES: SpriteSet = {
  idle: {
    frames: [IDLE_1, IDLE_1, IDLE_1, IDLE_2, IDLE_3, IDLE_2],
    particleEffect: 'zzz',
  },
  coding: {
    frames: [CODING_1, CODING_2, CODING_1, CODING_2],
    particleEffect: 'sparkle',
  },
  thinking: {
    frames: [THINKING_1, THINKING_2, THINKING_1, THINKING_2],
    particleEffect: 'bubbles',
  },
  error: {
    frames: [ERROR_1, ERROR_2, ERROR_1, ERROR_2],
    particleEffect: 'exclamation',
  },
};

// --- Palette colors for each index ---
export interface PaletteColors {
  body: string;        // index 1
  shadow: string;      // index 2
  dark: string;        // index 3
  highlight: string;   // index 4
  accent: string;      // index 5
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

export function getPaletteFromHSL(hslString: string): PaletteColors {
  // Parse "hsl(H, S%, L%)"
  const match = hslString.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) {
    return { body: '#888888', shadow: '#666666', dark: '#222222', highlight: '#ffffff', accent: '#ff6666' };
  }

  const h = parseInt(match[1]);
  const s = parseInt(match[2]);
  const l = parseInt(match[3]);

  const [r, g, b] = hslToRgb(h, s, l);
  const [sr, sg, sb] = hslToRgb(h, s, Math.max(l - 20, 10));

  return {
    body: `rgb(${r},${g},${b})`,
    shadow: `rgb(${sr},${sg},${sb})`,
    dark: '#1a1a2e',
    highlight: '#ffffff',
    accent: `rgb(${Math.min(r + 40, 255)},${Math.max(g - 20, 0)},${Math.max(b - 20, 0)})`,
  };
}
