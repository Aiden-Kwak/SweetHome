import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../apps/web/public/pitch/', import.meta.url);
const deck = JSON.parse(readFileSync(new URL('deck.json', root), 'utf8'));

test('the original deck is preserved and all eleven slides have images and accessible text', () => {
  assert.equal(deck.slides.length, 11);
  const original = readFileSync(new URL(deck.source, root));
  assert.equal(createHash('sha256').update(original).digest('hex'), deck.sha256);
  for (const slide of deck.slides) {
    assert(slide.title.length > 0);
    assert(slide.text.length > 0);
    assert(slide.notes.length > 0);
    const image = readFileSync(new URL(slide.image, root));
    assert.equal(image.subarray(1, 4).toString(), 'PNG');
  }
});

test('the web presentation has self-contained assets and a visible prototype caveat', () => {
  const html = readFileSync(new URL('index.html', root), 'utf8');
  assert(html.includes('실제 구현 상태나 검증된 가격 예측을 보장하지 않습니다'));
  assert(html.includes('슬라이드 텍스트와 발표자 노트 보기'));
  assert(readFileSync(new URL('pitch.css', root)).length > 0);
  assert(readFileSync(new URL('pitch.js', root)).length > 0);
});
