// 2D Perlin Noise implementation in TypeScript
// Based on Ken Perlin's Improved Noise

const p = new Uint8Array(256);
const permutation = [
  151,160,137,91,90,15,131,13,201,95,96,53,194,233, 7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
  190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,
  136,171,168, 68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,
  46,245,40,244,102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,135,130,116,188,159,
  86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,
  150,82,51,12,210,240,244,115,224,143,222,4,201,215,30,106,84,62,112,228,49,180,156,11,172,144,120,201,155,1,
  113,85,150,150,101,230,19,94,46,10,205,53,40,110,84,114,81,149,14,123,97,228,251,34,242,193,238,210,144,12,
  191,179,162,241, 81,51,145,235,249,14,239,107,49,192,214, 31,181,243,127,23,154,18,233,244,120,111,104,120,4,
  244,222,43,97,228,207,42,223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,129,22,
  39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,
  241,81,51,145,235,249,14,239,107,49,192,214,31,181,243,127,23,154,18,233,244,120,111,104,120,4,244,222,43,97,
  228,207,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,
  79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249
];

// Initialize perm array
for (let i = 0; i < 256; i++) {
  p[i] = permutation[i];
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(t: number, a: number, b: number): number {
  return a + t * (b - a);
}

function grad2D(hash: number, x: number, y: number): number {
  const h = hash & 7;
  const u = h < 4 ? x : y;
  const v = h < 4 ? y : x;
  return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : v);
}

export function noise2D(x: number, y: number): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;

  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);

  const u = fade(xf);
  const v = fade(yf);

  const aa = p[p[X] + Y];
  const ab = p[p[X] + (Y + 1)];
  const ba = p[p[X + 1] + Y];
  const bb = p[p[X + 1] + (Y + 1)];

  const x1 = lerp(u, grad2D(aa, xf, yf), grad2D(ba, xf - 1, yf));
  const x2 = lerp(u, grad2D(ab, xf, yf - 1), grad2D(bb, xf - 1, yf - 1));

  return lerp(v, x1, x2);
}

// Fractional Brownian Motion to create layered organic noise
export function fbm(x: number, y: number, octaves = 3): number {
  let value = 0;
  let amplitude = 1.0;
  let frequency = 1.0;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }

  return value / maxValue;
}
