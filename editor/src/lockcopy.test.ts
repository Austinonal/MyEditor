import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEC, addText, assertValid, copyOf, deleteClip, duplicateClip, findClip, isLocked, newProject, pasteClip, setTrackLock, addMedia } from './timeline.ts';
import type { MediaAsset, TextClip } from './schema.ts';

const a = (id: string): MediaAsset => ({ id, kind: 'video', name: id, file: `media/p/${id}`, bytes: 1, duration: 4 * SEC, width: 1080, height: 1920, rotation: 0, hasAudio: true });
const make = () => {
  const p = newProject('p', 't', a('a'), '2026-01-01T00:00:00Z');
  addMedia(p, [a('b')]);
  return p;
};

test('duplicate a main clip: the copy comes right after it, settings kept, new id', () => {
  const p = make();
  const [first] = p.tracks[0].clips;
  (first as { volume: number }).volume = 0.5;
  const id = duplicateClip(p, first.id);
  assertValid(p);
  assert.deepEqual(p.tracks[0].clips.map((c) => (c as { assetId: string }).assetId), ['a', 'a', 'b']);
  assert.notEqual(id, first.id);
  assert.equal((findClip(p, id) as { volume: number }).volume, 0.5);
});

test('copy and paste: main clips go in after the clip under the playhead; text goes at the playhead', () => {
  const p = make();
  const b = p.tracks[0].clips[1];
  const copied = copyOf(p, b.id);
  deleteClip(p, b.id); // the original can be gone
  pasteClip(p, copied, 1 * SEC);
  assert.deepEqual(p.tracks[0].clips.map((c) => (c as { assetId: string }).assetId), ['a', 'b']);
  const t = addText(p, 0, 'สวัสดี');
  const id = pasteClip(p, copyOf(p, t), 2.5 * SEC);
  assert.equal(findClip(p, id).start, 2.5 * SEC);
  assert.equal((findClip(p, id) as TextClip).text, 'สวัสดี');
  assertValid(p);
});

test('paste refuses a clip whose file is in another project', () => {
  const p = make();
  const copied = copyOf(p, p.tracks[0].clips[0].id);
  const other = newProject('q', 'q', a('z'), '2026-01-01T00:00:00Z');
  assert.throws(() => pasteClip(other, copied, 0));
});

test('locked tracks: clips report locked, cannot be duplicated, main paste refused', () => {
  const p = make();
  const main = p.tracks[0];
  setTrackLock(p, main.id, true);
  assert.ok(isLocked(p, main.clips[0].id));
  assert.throws(() => duplicateClip(p, main.clips[0].id));
  assert.throws(() => pasteClip(p, copyOf(p, main.clips[0].id), 0));
  setTrackLock(p, main.id, false);
  assert.ok(!isLocked(p, main.clips[0].id));
  duplicateClip(p, main.clips[0].id);
  assertValid(p);
});
