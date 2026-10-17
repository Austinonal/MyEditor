import { openMedia } from './media';
import type { Project } from './schema';

// A photo used as the canvas background, decoded once so drawing a frame stays synchronous.
const images = new Map<string, ImageBitmap>();

export async function prepareCanvasImage(p: Project) {
  if (p.canvas.kind !== 'image') return;
  const id = p.canvas.image;
  if (p.assets[id] && !images.has(id)) images.set(id, await createImageBitmap(await openMedia(p.assets[id].file)));
}

export const canvasImage = (id: string) => images.get(id);
