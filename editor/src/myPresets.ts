// Text presets the user saved ("พรีเซ็ตของฉัน"), kept on this device in IndexedDB.
import { createStore, del, set, values } from 'idb-keyval';
import type { TextTemplate } from './textTemplates.ts';

const store = () => createStore('editor-presets', 'text');
export const listPresets = async () => (await values<TextTemplate>(store())).sort((a, b) => a.name.localeCompare(b.name, 'th'));
export const savePreset = (t: TextTemplate) => set(t.id, t, store());
export const removePreset = (id: string) => del(id, store());
