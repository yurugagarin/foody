import { db, newId } from '../db';

async function resize(file: Blob, max: number, quality: number): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k);
  const h = Math.round(bmp.height * k);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Fotoğraf işlenemedi'))), 'image/jpeg', quality));
}

/** Stores a phone photo in two sizes (full and gallery thumbnail) and returns its id. */
export async function savePhoto(file: File): Promise<string> {
  const [blob, thumb] = await Promise.all([resize(file, 1600, 0.82), resize(file, 640, 0.78)]);
  const id = newId();
  await db.photos.add({ id, blob, thumb, createdAt: Date.now() });
  return id;
}

export async function deletePhoto(id: string | undefined): Promise<void> {
  if (id) await db.photos.delete(id);
}
