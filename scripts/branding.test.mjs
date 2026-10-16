import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('SweetHome is used for service branding and browser metadata', () => {
  const html = read('apps/web/index.html');
  const ui = read('apps/web/src/Workbench.tsx');
  assert(html.includes('<title>SweetHome |'));
  assert(html.includes('%3ES%3C/text%3E'));
  assert(ui.includes('src="/brand/sweethome-logo-v1.png" alt="SweetHome"'));
  assert(!ui.includes('className="brand-mark"'));
  const logo = readFileSync(new URL('../apps/web/public/brand/sweethome-logo-v1.png', import.meta.url));
  assert.equal(logo.subarray(1,4).toString(), 'PNG');
  assert(!ui.includes('PolicyMap'));
  assert(read('services/api/src/policymap_api/main.py').includes('title="SweetHome API"'));
});

test('presentation shell is renamed while original assets and stored drafts stay compatible', () => {
  assert(read('apps/web/public/pitch/index.html').includes('alt="SweetHome"'));
  assert(read('apps/web/public/pitch/pitch.js').includes('document.title = `SweetHome |'));
  assert(read('apps/web/public/pitch/index.html').includes('./SweetHome_final_pitch_v3_EN.pptx'));
  assert(read('apps/web/src/graph-editor.ts').includes('policymap:graph-draft:v1:'));
  assert(read('apps/web/src/KnowledgeGraph.tsx').includes('sweethome-graph-draft-'));
});
