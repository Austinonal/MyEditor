import type { Media, Project } from './types'

// shortcut: IndexedDB key-value instead of the SQLite schema in replica/schema.sql, same shapes.
// Swap for SQLite-WASM/OPFS when the Android engine needs to share files with the web one.
const STORES = ['projects', 'media', 'blobs'] as const
let dbp: Promise<IDBDatabase> | null = null

function db(): Promise<IDBDatabase> {
  return (dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open('autocut', 1)
    r.onupgradeneeded = () => STORES.forEach((s) => r.result.createObjectStore(s))
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  }))
}

async function tx<T>(store: (typeof STORES)[number], mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise((res, rej) => {
    const q = f(d.transaction(store, mode).objectStore(store))
    q.onsuccess = () => res(q.result)
    q.onerror = () => rej(q.error)
  })
}

export const putProject = (p: Project) => tx('projects', 'readwrite', (s) => s.put({ ...p, updatedAt: Date.now() }, p.id))
export const getProject = (id: string) => tx<Project | undefined>('projects', 'readonly', (s) => s.get(id))
export const deleteProject = (id: string) => tx('projects', 'readwrite', (s) => s.delete(id))
export async function listProjects(): Promise<Project[]> {
  const all = await tx<Project[]>('projects', 'readonly', (s) => s.getAll())
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}
export const putMedia = async (m: Media, blob: Blob) => { await tx('media', 'readwrite', (s) => s.put(m, m.id)); await tx('blobs', 'readwrite', (s) => s.put(blob, m.id)) }
export const getMedia = (id: string) => tx<Media | undefined>('media', 'readonly', (s) => s.get(id))
export const getBlob = (id: string) => tx<Blob | undefined>('blobs', 'readonly', (s) => s.get(id))
export const listMedia = () => tx<Media[]>('media', 'readonly', (s) => s.getAll())
