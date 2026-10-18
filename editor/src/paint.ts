// Flood fill for the drawing page: every pixel connected to (x, y) whose colour is within `tolerance` of the one
// clicked takes `colour` (RGBA bytes). Pure, so it is unit-tested. Returns how many pixels changed.
export function floodFill(data: Uint8ClampedArray, w: number, h: number, x: number, y: number, colour: [number, number, number, number], tolerance = 32): number {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= w || y >= h) return 0;
  const at = (y * w + x) * 4;
  const target = [data[at], data[at + 1], data[at + 2], data[at + 3]];
  if (target.every((v, k) => v === colour[k])) return 0;
  const near = (i: number) =>
    Math.abs(data[i] - target[0]) + Math.abs(data[i + 1] - target[1]) + Math.abs(data[i + 2] - target[2]) + Math.abs(data[i + 3] - target[3]) <= tolerance;
  const seen = new Uint8Array(w * h);
  const stack = [y * w + x];
  seen[y * w + x] = 1;
  let n = 0;
  while (stack.length) {
    const p = stack.pop()!;
    data.set(colour, p * 4);
    n++;
    const px = p % w;
    for (const q of [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p + w < w * h ? p + w : -1]) {
      if (q >= 0 && !seen[q] && near(q * 4)) {
        seen[q] = 1;
        stack.push(q);
      }
    }
  }
  return n;
}

export const STICKER_GROUPS: [string, string[]][] = [
  ['หน้ายิ้ม', ['😀', '😂', '🤣', '😍', '🥰', '😎', '🤩', '😭', '😱', '🤔', '😴', '🥳', '😡', '🤯', '😇', '🙄', '😏', '🤭']],
  ['หัวใจ', ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💖', '💕', '💔', '💯']],
  ['มือ', ['👍', '👎', '👏', '🙏', '👌', '✌️', '🤞', '👉', '👈', '👆', '👇', '💪']],
  ['สัตว์', ['🐶', '🐱', '🐰', '🐻', '🐼', '🐨', '🐯', '🦁', '🐸', '🐧', '🦄', '🐝']],
  ['อาหาร', ['🍕', '🍔', '🍟', '🍜', '🍣', '🍩', '🍰', '🍦', '☕', '🧋', '🍉', '🍓']],
  ['สัญลักษณ์', ['⭐', '✨', '🔥', '⚡', '💥', '❗', '❓', '✅', '❌', '🆕', '🔴', '🏆', '💰', '🎉', '📌', '🎵']],
  ['ลูกศร', ['⬆️', '⬇️', '⬅️', '➡️', '↗️', '↘️', '↙️', '↖️', '🔄', '🔝']],
];
