import { test } from 'node:test'; import assert from 'node:assert/strict';
import { money, seen, unsupported, extractFigures } from '../../kit/fn/guard.js';
const facts = { allowed: new Set([61600, 122800]), page: 71 };
const none = { amounts: new Set(), pages: new Set() };
test('money formats whole dollars', () => assert.equal(money(122800), '$122,800'));
test('extractFigures pulls dollar amounts and page numbers', () => {
  assert.deepEqual(extractFigures('limits are $61,600 and $122,800 on page 71'), { amounts: [61600, 122800], pages: [71] });
});
test('a figure not in the facts is unsupported (the usda incident)', () => {
  assert.equal(unsupported('the moderate limit is $105,700 (page 9)', facts, none), true);
});
test('figures from the facts, on the right page, are supported', () => {
  assert.equal(unsupported('Direct $61,600 and Guaranteed $122,800, page 71', facts, none), false);
});
test('small figures like the $480 deduction are always fine', () => {
  assert.equal(unsupported('USDA deducts $480 per child', facts, none), false);
});
test('a figure the person or a tool already said is allowed', () => {
  const prior = seen([{ role: 'user', content: 'my cousin says it is $1,000,000' }]);
  assert.equal(unsupported('It is not $1,000,000.', facts, prior), false);
});
test('with no facts, any large dollar figure is unsupported', () => {
  assert.equal(unsupported('around $52,000', null, none), true);
});
test('seen() excludes pages from the last message unless it is a tool-results message', () => {
  assert.deepEqual([...seen([{ role: 'user', content: 'is it page 12?' }]).pages], []);
  assert.deepEqual([...seen([{ role: 'user', content: 'Results from the 3FS agents: pdf_page: 71' }]).pages], [71]);
});
