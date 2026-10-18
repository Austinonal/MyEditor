// A whole project in one file (.myedit) to move it to another phone or keep a backup: a magic line, the header's byte
// length, a JSON header (the project and the list of media files), then the media bytes one after another.
import type { Project } from './schema.ts';
import { assertValid } from './timeline.ts';

const MAGIC = 'MYEDITOR-PROJECT-1\n';
export const PROJECT_EXT = '.myedit';
const SAFE_NAME = /^[A-Za-z0-9-]{1,64}$/;

interface Header {
  project: Project;
  files: { path: string; size: number }[];
}

const pathsOf = (p: Project) => Object.values(p.assets).flatMap((a) => (a.reversedFile ? [a.file, a.reversedFile] : [a.file]));

// Points every media path at the project's (new) id; used by duplicate and by import.
export function rehome(p: Project, from: string, to: string) {
  for (const a of Object.values(p.assets)) {
    a.file = a.file.replace(`media/${from}/`, `media/${to}/`);
    if (a.reversedFile) a.reversedFile = a.reversedFile.replace(`media/${from}/`, `media/${to}/`);
  }
}

export async function packProject(p: Project, read: (path: string) => Promise<Blob>): Promise<Blob> {
  const blobs = await Promise.all(pathsOf(p).map(read));
  const header = new TextEncoder().encode(JSON.stringify({ project: p, files: pathsOf(p).map((path, i) => ({ path, size: blobs[i].size })) } satisfies Header));
  return new Blob([MAGIC, `${header.length}\n`, header, ...blobs], { type: 'application/octet-stream' });
}

// The file comes from outside the app, so everything is checked before any byte is written: the media names, that
// every asset's file is in it, that the sizes add up, and that the project itself is valid.
export async function unpackProject(file: Blob, newId: string, now: string): Promise<{ project: Project; files: { name: string; blob: Blob }[] }> {
  const bad = (why: string) => new Error(`ไฟล์โปรเจกต์ใช้ไม่ได้ (${why})`);
  const head = new TextDecoder().decode(await file.slice(0, MAGIC.length + 12).arrayBuffer());
  if (!head.startsWith(MAGIC)) throw bad('ไม่ใช่ไฟล์ .myedit');
  const lenLine = head.slice(MAGIC.length).split('\n')[0];
  const len = Number(lenLine);
  const start = MAGIC.length + lenLine.length + 1;
  if (!/^\d+$/.test(lenLine) || start + len > file.size) throw bad('ไฟล์ไม่ครบ');
  let header: Header;
  try {
    header = JSON.parse(new TextDecoder().decode(await file.slice(start, start + len).arrayBuffer()));
  } catch {
    throw bad('อ่านข้อมูลไม่ได้');
  }
  const { project, files } = header;
  if (!project || typeof project.id !== 'string' || !Array.isArray(files)) throw bad('ข้อมูลไม่ครบ');
  const prefix = `media/${project.id}/`;
  const listed = new Set(files.map((f) => f.path));
  for (const f of files) {
    if (typeof f.path !== 'string' || !f.path.startsWith(prefix) || !SAFE_NAME.test(f.path.slice(prefix.length)) || !Number.isSafeInteger(f.size) || f.size < 0) throw bad('ชื่อไฟล์สื่อแปลก');
  }
  if (!pathsOf(project).every((path) => listed.has(path))) throw bad('สื่อบางไฟล์หายไป');
  let at = start + len;
  const out = files.map((f) => ({ name: f.path.slice(prefix.length), blob: file.slice(at, (at += f.size)) }));
  if (at !== file.size) throw bad('ขนาดไม่ตรง');
  const old = project.id;
  project.id = newId;
  project.createdAt = project.updatedAt = now;
  rehome(project, old, newId);
  assertValid(project);
  return { project, files: out };
}
