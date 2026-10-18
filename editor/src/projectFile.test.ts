import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packProject, unpackProject } from './projectFile.ts';
import { SEC, newProject } from './timeline.ts';
import type { MediaAsset } from './schema.ts';

const asset: MediaAsset = { id: 'a1', kind: 'video', name: 'คลิป', file: 'media/old/a1', bytes: 3, duration: 2 * SEC, width: 1080, height: 1920, rotation: 0, hasAudio: true };
const media: Record<string, Blob> = { 'media/old/a1': new Blob(['abc']) };
const pack = (p = newProject('old', 'ชื่อไทย', asset, '2026-01-01T00:00:00Z')) => packProject(p, async (path) => media[path]);

test('a project survives export and import, under a new id with its media', async () => {
  const { project, files } = await unpackProject(await pack(), 'new', '2026-02-02T00:00:00Z');
  assert.equal(project.id, 'new');
  assert.equal(project.name, 'ชื่อไทย');
  assert.equal(project.assets.a1.file, 'media/new/a1');
  assert.equal(files.length, 1);
  assert.equal(files[0].name, 'a1');
  assert.equal(await files[0].blob.text(), 'abc');
});

test('import refuses broken or tampered files', async () => {
  await assert.rejects(unpackProject(new Blob(['hello']), 'n', ''), /ไม่ใช่ไฟล์/);
  const good = await pack();
  await assert.rejects(unpackProject(good.slice(0, good.size - 1), 'n', ''), /ขนาดไม่ตรง/);
  const p = newProject('old', 't', { ...asset, file: 'media/other-project/a1' }, '2026-01-01T00:00:00Z');
  media['media/other-project/a1'] = new Blob(['x']);
  await assert.rejects(unpackProject(await pack(p), 'n', ''), /ชื่อไฟล์สื่อแปลก/);
  const evil = newProject('old', 't', { ...asset, file: 'media/old/../x' }, '2026-01-01T00:00:00Z');
  media['media/old/../x'] = new Blob(['x']);
  await assert.rejects(unpackProject(await pack(evil), 'n', ''), /ชื่อไฟล์สื่อแปลก/);
});
