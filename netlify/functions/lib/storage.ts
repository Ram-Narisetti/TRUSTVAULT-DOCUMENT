import { getStore } from "@netlify/blobs";

// In-memory fallback if Blobs isn't configured in a given environment
const inMemoryStore = new Map<string, Buffer>();

export async function saveDocumentFile(key: string, data: Buffer | Uint8Array): Promise<void> {
  try {
    const store = getStore("documents");
    await store.set(key, data);
    return;
  } catch (err) {
    console.warn("Netlify Blobs set failed, using in-memory store fallback:", err);
  }
  inMemoryStore.set(key, Buffer.from(data));
}

export async function getDocumentFile(key: string): Promise<Buffer | null> {
  try {
    const store = getStore("documents");
    const arrayBuffer = await store.get(key, { type: "arrayBuffer" });
    if (arrayBuffer) {
      return Buffer.from(arrayBuffer);
    }
  } catch (err) {
    console.warn("Netlify Blobs get failed, using in-memory store fallback:", err);
  }

  const inMem = inMemoryStore.get(key);
  if (inMem) {
    return inMem;
  }
  return null;
}

export async function deleteDocumentFile(key: string): Promise<void> {
  try {
    const store = getStore("documents");
    await store.delete(key);
  } catch (err) {
    console.warn("Netlify Blobs delete failed:", err);
  }
  inMemoryStore.delete(key);
}
