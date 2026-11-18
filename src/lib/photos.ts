// Photos of challans, bills, orders and damage. Each photo is shrunk on the phone (about 100–200 KB)
// and kept on this device; the shared log only carries a reference. With file storage connected
// (Supabase Storage), the same reference would point to the shared copy.

const KEY = (id: string) => `loadmatch-photo-${id}`;

export type PhotoRef = { id: string; name: string; kind: string; by?: string; at?: number };

export const newPhotoId = () => {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return `ph-${Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')}`;
};

function shrink(file: File, maxSide = 1100, quality = 0.62): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Not an image')); };
    img.src = url;
  });
}

// Save the picked files on this phone; returns references to put on the truck
export async function savePhotos(files: FileList | File[] | null, kind: string): Promise<PhotoRef[]> {
  const out: PhotoRef[] = [];
  for (const f of Array.from(files || [])) {
    const id = newPhotoId();
    try {
      const data = await shrink(f);
      localStorage.setItem(KEY(id), data);
    } catch {
      // too big for this phone's storage, or not an image: keep the reference so the record is honest
    }
    out.push({ id, name: f.name || 'photo.jpg', kind });
  }
  return out;
}

export const photoData = (id: string): string | null => { try { return localStorage.getItem(KEY(id)); } catch { return null; } };

export function openPhoto(id: string) {
  const data = photoData(id);
  if (!data) return false;
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(`<!DOCTYPE html><title>Photo</title><body style="margin:0;background:#111;display:flex;justify-content:center"><img src="${data}" style="max-width:100%;height:auto"></body>`);
  w.document.close();
  return true;
}
