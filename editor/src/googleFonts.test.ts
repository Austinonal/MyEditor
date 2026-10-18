import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleFaces } from './googleFonts.ts';

test('google fonts: keeps the Thai and Latin files from gstatic only', () => {
  const css = `/* thai */
@font-face { font-family: 'K2D'; src: url(https://fonts.gstatic.com/s/k2d/v1/th.woff2) format('woff2'); unicode-range: U+0E01-0E5B; }
/* vietnamese */
@font-face { font-family: 'K2D'; src: url(https://fonts.gstatic.com/s/k2d/v1/vi.woff2) format('woff2'); unicode-range: U+0102-0103; }
/* latin */
@font-face { font-family: 'K2D'; src: url(https://evil.example/x.woff2) format('woff2'); unicode-range: U+0000-00FF; }`;
  assert.deepEqual(googleFaces(css), [{ url: 'https://fonts.gstatic.com/s/k2d/v1/th.woff2', range: 'U+0E01-0E5B' }]);
  assert.deepEqual(googleFaces("@font-face { src: url(https://fonts.gstatic.com/a.ttf) format('truetype'); }"), [{ url: 'https://fonts.gstatic.com/a.ttf', range: undefined }]);
});
