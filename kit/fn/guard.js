// 3FS kit: the grounded-guide number guard. The model never gets the last word on a number.
// facts = { allowed: Set<number>, page: number|null } built server-side from the door's own data.
export const money = n => '$' + Math.round(n).toLocaleString('en-US');

const AMT_ANY = /\$?\s?\b(\d{1,3}(?:,\d{3})+|\d{5,7})\b(?:\.\d+)?/g;      // any amount-looking figure (for prior context)
const AMT_DOLLAR = /\$\s?(\d{1,3}(?:,\d{3})+|\d{5,7})(?:\.\d+)?/g;          // a figure the model presents as money
const PAGE_ANY = /\b(?:page|pdf_page\W+)\s*(\d{1,4})\b/gi;
const PAGE_SAID = /\bpage\s+(\d{1,4})\b/gi;
const toNum = s => Math.round(+s.replace(/,/g, ''));

export function extractFigures(text) {
  return {
    amounts: [...String(text).matchAll(AMT_DOLLAR)].map(m => toNum(m[1])),
    pages: [...String(text).matchAll(PAGE_SAID)].map(m => +m[1])
  };
}

// Figures already in the conversation: tool results the site fed back, and the person's own words.
// Pages from the last message are ignored unless that message is a tool-results message.
export function seen(msgs) {
  const amounts = new Set(), pages = new Set();
  msgs.forEach((m, i) => {
    const c = String(m.content || '');
    for (const x of c.matchAll(AMT_ANY)) amounts.add(toNum(x[1]));
    if (i < msgs.length - 1 || /^Results from the 3FS agents/.test(c)) for (const x of c.matchAll(PAGE_ANY)) pages.add(+x[1]);
  });
  return { amounts, pages };
}

export function unsupported(text, facts, prior) {
  const { amounts, pages } = extractFigures(text);
  const okAmt = a => a < 10000 || (prior && prior.amounts.has(a)) || (facts && facts.allowed.has(a));
  const okPage = p => (prior && prior.pages.has(p)) || (facts && p === facts.page);
  return amounts.some(a => !okAmt(a)) || pages.some(p => !okPage(p));
}
