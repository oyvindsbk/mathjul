/**
 * A self-contained QR code encoder, sized for share URLs.
 *
 * The only thing this module has to encode is an ASCII URL of a few dozen
 * characters, so it implements exactly that slice of ISO/IEC 18004: byte mode,
 * error correction level M, versions 1-10 (up to 213 bytes). That is enough for
 * any `https://.../delt/<token>` we mint, and it keeps the client free of a new
 * runtime dependency.
 *
 * `renderQrSvg` is the entry point; `encodeQr` is exported so the matrix can be
 * decoded back and verified.
 */

/** Modules per side, per version: 21, 25, 29, ... */
function moduleCount(version: number): number {
  return version * 4 + 17;
}

/**
 * Per version (1-10) at EC level M: total data codewords, EC codewords per
 * block, and the block layout as [count, dataCodewordsPerBlock] groups.
 */
interface VersionSpec {
  dataCodewords: number;
  ecCodewordsPerBlock: number;
  blocks: [number, number][];
}

const VERSION_SPECS: Record<number, VersionSpec> = {
  1: { dataCodewords: 16, ecCodewordsPerBlock: 10, blocks: [[1, 16]] },
  2: { dataCodewords: 28, ecCodewordsPerBlock: 16, blocks: [[1, 28]] },
  3: { dataCodewords: 44, ecCodewordsPerBlock: 26, blocks: [[1, 44]] },
  4: { dataCodewords: 64, ecCodewordsPerBlock: 18, blocks: [[2, 32]] },
  5: { dataCodewords: 86, ecCodewordsPerBlock: 24, blocks: [[2, 43]] },
  6: { dataCodewords: 108, ecCodewordsPerBlock: 16, blocks: [[4, 27]] },
  7: { dataCodewords: 124, ecCodewordsPerBlock: 18, blocks: [[4, 31]] },
  8: { dataCodewords: 154, ecCodewordsPerBlock: 22, blocks: [[2, 38], [2, 39]] },
  9: { dataCodewords: 182, ecCodewordsPerBlock: 22, blocks: [[3, 36], [2, 37]] },
  10: { dataCodewords: 216, ecCodewordsPerBlock: 26, blocks: [[4, 43], [1, 44]] },
};

const MAX_VERSION = 10;

/** Row/column centres of the alignment patterns, per version. */
const ALIGNMENT_CENTERS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

// --- GF(256) arithmetic, the field QR's Reed-Solomon codes live in ---------

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // the QR generator polynomial x^8+x^4+x^3+x^2+1
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

/** Generator polynomial for `degree` error correction codewords. */
function rsGenerator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], 1);
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data: Uint8Array, degree: number): Uint8Array {
  const generator = rsGenerator(degree);
  const remainder = new Uint8Array(degree);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.copyWithin(0, 1);
    remainder[degree - 1] = 0;
    for (let i = 0; i < degree; i++) {
      remainder[i] ^= gfMul(generator[i + 1], factor);
    }
  }
  return remainder;
}

// --- Bit buffer -----------------------------------------------------------

class BitBuffer {
  private readonly bits: number[] = [];

  put(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((value >>> i) & 1);
    }
  }

  get length(): number {
    return this.bits.length;
  }

  /** Pads to a byte boundary and returns the codewords. */
  toBytes(): Uint8Array {
    const bytes = new Uint8Array(Math.ceil(this.bits.length / 8));
    this.bits.forEach((bit, i) => {
      if (bit) bytes[i >>> 3] |= 0x80 >>> (i & 7);
    });
    return bytes;
  }
}

// --- Data encoding --------------------------------------------------------

/** UTF-8 bytes; ASCII URLs pass through unchanged, but non-ASCII still works. */
function toUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Byte mode uses an 8-bit character count for versions 1-9, 16-bit from 10. */
function charCountBits(version: number): number {
  return version < 10 ? 8 : 16;
}

function chooseVersion(byteLength: number): number {
  for (let version = 1; version <= MAX_VERSION; version++) {
    const capacityBits =
      VERSION_SPECS[version].dataCodewords * 8 - 4 - charCountBits(version);
    if (byteLength * 8 <= capacityBits) return version;
  }
  throw new Error(
    `Text is too long for a version ${MAX_VERSION} QR code (${byteLength} bytes)`
  );
}

/** Data codewords with the mode header, terminator and pad bytes. */
function buildDataCodewords(data: Uint8Array, version: number): Uint8Array {
  const spec = VERSION_SPECS[version];
  const capacityBits = spec.dataCodewords * 8;

  const buffer = new BitBuffer();
  buffer.put(0b0100, 4); // byte mode
  buffer.put(data.length, charCountBits(version));
  for (const byte of data) buffer.put(byte, 8);

  buffer.put(0, Math.min(4, capacityBits - buffer.length)); // terminator
  buffer.put(0, (8 - (buffer.length % 8)) % 8); // pad to a byte boundary

  const codewords = new Uint8Array(spec.dataCodewords);
  codewords.set(buffer.toBytes());
  for (let i = buffer.length / 8; i < spec.dataCodewords; i++) {
    // The standard's alternating pad bytes.
    codewords[i] = (i - buffer.length / 8) % 2 === 0 ? 0xec : 0x11;
  }
  return codewords;
}

/** Splits into blocks, appends EC codewords, and interleaves both. */
function buildFinalCodewords(
  dataCodewords: Uint8Array,
  version: number
): Uint8Array {
  const spec = VERSION_SPECS[version];
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];

  let offset = 0;
  for (const [count, blockLength] of spec.blocks) {
    for (let i = 0; i < count; i++) {
      const block = dataCodewords.subarray(offset, offset + blockLength);
      offset += blockLength;
      dataBlocks.push(block);
      ecBlocks.push(rsRemainder(block, spec.ecCodewordsPerBlock));
    }
  }

  const result: number[] = [];
  const maxDataLength = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxDataLength; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i]);
    }
  }
  for (let i = 0; i < spec.ecCodewordsPerBlock; i++) {
    for (const block of ecBlocks) result.push(block[i]);
  }
  return new Uint8Array(result);
}

// --- Matrix construction --------------------------------------------------

/** `null` where no module has been placed yet, so function patterns stay put. */
type Grid = (boolean | null)[][];

function placeFinderPattern(grid: Grid, row: number, col: number): void {
  const size = grid.length;
  // The 7x7 finder plus its one-module separator, clipped to the grid.
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const y = row + r;
      const x = col + c;
      if (y < 0 || y >= size || x < 0 || x >= size) continue;
      const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
      grid[y][x] = ring !== 2 && ring <= 3;
    }
  }
}

function placeFunctionPatterns(grid: Grid, version: number): void {
  const size = grid.length;

  placeFinderPattern(grid, 0, 0);
  placeFinderPattern(grid, 0, size - 7);
  placeFinderPattern(grid, size - 7, 0);

  // Timing patterns.
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    grid[6][i] = dark;
    grid[i][6] = dark;
  }

  // Alignment patterns, skipping the three that would sit on a finder.
  const centers = ALIGNMENT_CENTERS[version];
  for (const row of centers) {
    for (const col of centers) {
      const onFinder =
        (row === 6 && col === 6) ||
        (row === 6 && col === size - 7) ||
        (row === size - 7 && col === 6);
      if (onFinder) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          grid[row + r][col + c] = Math.max(Math.abs(r), Math.abs(c)) !== 1;
        }
      }
    }
  }

  // The always-dark module above the bottom-left finder.
  grid[size - 8][8] = true;
}

/**
 * BCH(18,6) version information, required from version 7 up. Six data bits and
 * twelve error correction bits, placed in two 6x3 blocks by the finders.
 */
function placeVersionInfo(grid: Grid, version: number): void {
  if (version < 7) return;
  const size = grid.length;

  let value = version << 12;
  for (let i = 5; i >= 0; i--) {
    if ((value >>> (12 + i)) & 1) value ^= 0b1111100100101 << i;
  }
  const bits = (version << 12) | value;

  for (let i = 0; i < 18; i++) {
    const bit = ((bits >>> i) & 1) === 1;
    const row = Math.floor(i / 3);
    const col = size - 11 + (i % 3);
    grid[row][col] = bit; // above the top-right finder
    grid[col][row] = bit; // left of the bottom-left finder, transposed
  }
}

/** Reserves the format information modules so data placement skips them. */
function reserveFormatArea(grid: Grid): void {
  const size = grid.length;
  for (let i = 0; i <= 8; i++) {
    if (grid[8][i] === null) grid[8][i] = false;
    if (grid[i][8] === null) grid[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (grid[8][size - 1 - i] === null) grid[8][size - 1 - i] = false;
    if (grid[size - 1 - i][8] === null) grid[size - 1 - i][8] = false;
  }
}

/**
 * Walks the zigzag data path, right to left in two-column strips, writing one
 * bit per free module. Returns the coordinates in placement order so masking
 * can be applied to exactly those modules.
 */
function placeData(grid: Grid, codewords: Uint8Array): [number, number][] {
  const size = grid.length;
  const placed: [number, number][] = [];
  let bitIndex = 0;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // the vertical timing column is not part of a strip
    for (let vertical = 0; vertical < size; vertical++) {
      for (let c = 0; c < 2; c++) {
        const col = right - c;
        const upward = ((right + 1) & 2) === 0;
        const row = upward ? size - 1 - vertical : vertical;
        if (grid[row][col] !== null) continue;
        const byte = codewords[bitIndex >>> 3] ?? 0;
        grid[row][col] = ((byte >>> (7 - (bitIndex & 7))) & 1) === 1;
        placed.push([row, col]);
        bitIndex++;
      }
    }
  }
  return placed;
}

function maskBit(mask: number, row: number, col: number): boolean {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    default:
      return ((((row + col) % 2) + ((row * col) % 3)) % 2) === 0;
  }
}

/** BCH(15,5) format information for EC level M and the chosen mask. */
function formatBits(mask: number): number {
  const data = (0b00 << 3) | mask; // 00 = EC level M
  let value = data << 10;
  for (let i = 4; i >= 0; i--) {
    if ((value >>> (10 + i)) & 1) value ^= 0b10100110111 << i;
  }
  return ((data << 10) | value) ^ 0b101010000010010;
}

function placeFormatInfo(grid: Grid, mask: number): void {
  const size = grid.length;
  const bits = formatBits(mask);
  // The 15 bits run most-significant first along each copy's path.
  const bitAt = (i: number) => ((bits >>> (14 - i)) & 1) === 1;

  // Copy 1, around the top-left finder.
  for (let i = 0; i <= 5; i++) grid[8][i] = bitAt(i);
  grid[8][7] = bitAt(6);
  grid[8][8] = bitAt(7);
  grid[7][8] = bitAt(8);
  for (let i = 9; i < 15; i++) grid[14 - i][8] = bitAt(i);

  // Copy 2: bits 0-6 run up column 8 from the bottom, bits 7-14 run right
  // along row 8 to the edge.
  for (let i = 0; i < 7; i++) grid[size - 1 - i][8] = bitAt(i);
  for (let i = 7; i < 15; i++) grid[8][size - 15 + i] = bitAt(i);
}

// --- Mask scoring (ISO/IEC 18004 penalty rules) ---------------------------

function penalty(matrix: boolean[][]): number {
  const size = matrix.length;
  let score = 0;

  // Rule 1: runs of five or more same-coloured modules in a row or column.
  for (let i = 0; i < size; i++) {
    for (const line of [matrix[i], matrix.map((row) => row[i])]) {
      let run = 1;
      for (let j = 1; j < size; j++) {
        if (line[j] === line[j - 1]) {
          run++;
        } else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
      if (run >= 5) score += run - 2;
    }
  }

  // Rule 2: 2x2 blocks of one colour.
  for (let row = 0; row < size - 1; row++) {
    for (let col = 0; col < size - 1; col++) {
      const v = matrix[row][col];
      if (
        v === matrix[row][col + 1] &&
        v === matrix[row + 1][col] &&
        v === matrix[row + 1][col + 1]
      ) {
        score += 3;
      }
    }
  }

  // Rule 3: the finder-like 1:1:3:1:1 pattern with four light modules beside it.
  const finderLike = [true, false, true, true, true, false, true];
  const light4 = [false, false, false, false];
  const matches = (line: boolean[], at: number, pattern: boolean[]) =>
    pattern.every((v, k) => line[at + k] === v);
  for (let i = 0; i < size; i++) {
    for (const line of [matrix[i], matrix.map((row) => row[i])]) {
      for (let j = 0; j + 7 <= size; j++) {
        if (!matches(line, j, finderLike)) continue;
        const before = j >= 4 && matches(line, j - 4, light4);
        const after = j + 11 <= size && matches(line, j + 7, light4);
        if (before || after) score += 40;
      }
    }
  }

  // Rule 4: deviation from an even split of dark and light modules.
  const dark = matrix.reduce(
    (sum, row) => sum + row.reduce((n, v) => n + (v ? 1 : 0), 0),
    0
  );
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

// --- Public API -----------------------------------------------------------

export interface QrCode {
  /** `matrix[row][col]` — true is a dark module. */
  matrix: boolean[][];
  /** Modules per side, including no quiet zone. */
  size: number;
  version: number;
}

/**
 * Encodes `text` as a QR code at error correction level M.
 *
 * @throws if the text does not fit a version 10 symbol (213 bytes).
 */
export function encodeQr(text: string): QrCode {
  const data = toUtf8(text);
  const version = chooseVersion(data.length);
  const codewords = buildFinalCodewords(
    buildDataCodewords(data, version),
    version
  );

  const size = moduleCount(version);
  const grid: Grid = Array.from({ length: size }, () =>
    new Array<boolean | null>(size).fill(null)
  );
  placeFunctionPatterns(grid, version);
  placeVersionInfo(grid, version);
  reserveFormatArea(grid);

  // Data placement has to happen before masking, but the format area was only
  // reserved with placeholders, so it is rewritten per candidate mask below.
  const dataModules = placeData(grid, codewords);

  let best: boolean[][] | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = grid.map((row) => row.map((v) => v === true));
    for (const [row, col] of dataModules) {
      if (maskBit(mask, row, col)) candidate[row][col] = !candidate[row][col];
    }
    placeFormatInfo(candidate as Grid, mask);
    const score = penalty(candidate);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return { matrix: best as boolean[][], size, version };
}

export interface QrSvgOptions {
  /** Light modules of margin around the symbol. The standard asks for 4. */
  quietZone?: number;
  /** Rendered edge length in CSS pixels. */
  pixelSize?: number;
  /** Dark module colour. */
  color?: string;
  /** Background colour, or `"transparent"`. */
  background?: string;
  /** Accessible name for the symbol. */
  title?: string;
}

/**
 * Renders `text` as an SVG string. The symbol is drawn on a `viewBox` in module
 * units, so it scales cleanly to whatever `pixelSize` the caller asks for.
 */
export function renderQrSvg(text: string, options: QrSvgOptions = {}): string {
  const {
    quietZone = 4,
    pixelSize = 256,
    color = "#000000",
    background = "#ffffff",
    title = "QR-kode",
  } = options;

  const { matrix, size } = encodeQr(text);
  const total = size + quietZone * 2;

  // One path of per-module rectangles keeps the markup small and crisp.
  const parts: string[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (matrix[row][col]) {
        parts.push(`M${col + quietZone} ${row + quietZone}h1v1h-1z`);
      }
    }
  }

  const escapedTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}"`,
    ` width="${pixelSize}" height="${pixelSize}" role="img" shape-rendering="crispEdges">`,
    `<title>${escapedTitle}</title>`,
    background === "transparent"
      ? ""
      : `<rect width="${total}" height="${total}" fill="${background}"/>`,
    `<path fill="${color}" d="${parts.join("")}"/>`,
    `</svg>`,
  ].join("");
}
