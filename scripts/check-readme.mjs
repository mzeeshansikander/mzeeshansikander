// Guards against defects that silently break a profile README on GitHub.
import { readFileSync, readdirSync } from 'node:fs';
const s = readFileSync('README.md', 'utf8');
const errs = [];

// 1. capsule-render silently fails on encoded ampersands
for (const u of s.match(/capsule-render[^"]*/g) ?? [])
  if (u.includes('%26')) errs.push(`capsule-render URL contains %26 (renders as a broken image): ${u.slice(0, 90)}`);

// 2. every image needs alt text (a11y + readable fallback if a host is down)
for (const t of s.match(/<img [^>]*>/g) ?? [])
  if (!t.includes('alt=')) errs.push(`<img> without alt: ${t.slice(0, 90)}`);

// 3. balanced structure
const pair = (o, c, n) => { const a = (s.match(new RegExp(o, 'g')) ?? []).length,
                                  b = (s.match(new RegExp(c, 'g')) ?? []).length;
  if (a !== b) errs.push(`${n} unbalanced: ${a} open vs ${b} close`); };
pair('<div align="center">', '</div>', 'div');
pair('<table>', '</table>', 'table');
pair('<details', '</details>', 'details');

// 4. stats markers must survive edits or the daily workflow silently no-ops
if ((s.match(/<!--STATS:START-->/g) ?? []).length !== 1 ||
    (s.match(/<!--STATS:END-->/g) ?? []).length !== 1)
  errs.push('STATS markers missing or duplicated — the stats workflow would no-op');

// 5. every in-page link must resolve to an explicit named anchor
const anchors = new Set([...s.matchAll(/<a name="([^"]+)"><\/a>/g)].map(m => m[1]));
for (const [, target] of s.matchAll(/href="#([^"]+)"/g))
  if (!anchors.has(target)) errs.push(`in-page link #${target} has no <a name="${target}"> anchor`);

// 6. every prominent badge carries a real brand mark, not a bare colour chip.
//    Exception: simple-icons has removed some marks on trademark request, so
//    shields silently renders nothing for them. Those badges rely on brand
//    colour alone — passing logo=<slug> would be a no-op, not a fix.
const NO_BRAND_MARK = ['LinkedIn'];   // also gone: OpenAI, Pinecone
for (const u of s.match(/img\.shields\.io\/badge\/[^"]*/g) ?? []) {
  if (!u.includes('for-the-badge') || u.includes('logo=')) continue;
  const label = decodeURIComponent(u.split('/badge/')[1]?.split('-')[0] ?? '');
  if (!NO_BRAND_MARK.includes(label)) errs.push(`for-the-badge badge without a logo: ${u.slice(0, 80)}`);
}

// 6b. these slugs are not in simple-icons — shields renders the badge with no
//     icon at all, which looks like a styling mistake rather than a failure.
for (const [, slug] of s.matchAll(/[?&]logo=([a-z0-9.-]+)/g))
  if (['openai', 'linkedin', 'pinecone'].includes(slug))
    errs.push(`logo=${slug} does not exist in simple-icons — the badge will render with no icon`);

// 7. unresolved content placeholders must never reach main
for (const [, tok] of s.matchAll(/\{\{([A-Z_]+)\}\}/g))
  errs.push(`unresolved placeholder {{${tok}}} left in README`);

// 8. locally-hosted assets must be referenced by absolute raw URL — relative
//    paths do not render on the GitHub profile page
for (const t of s.match(/<img [^>]*src="(?!https?:)[^"]*"[^>]*>/g) ?? [])
  errs.push(`relative image src (will not render on the profile page): ${t.slice(0, 90)}`);

// 9. hand-authored SVGs must be well-formed XML. A bare "&" in a label is the
//    common slip and makes the whole asset fail to render as an image.
for (const f of readdirSync('assets').filter(n => n.endsWith('.svg'))) {
  const svg = readFileSync(`assets/${f}`, 'utf8');
  for (const [m] of svg.matchAll(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g))
    errs.push(`${f}: unescaped "&" — use &amp; (SVG will not render)`);
  const open = (svg.match(/<svg[\s>]/g) ?? []).length, close = (svg.match(/<\/svg>/g) ?? []).length;
  if (open !== 1 || close !== 1) errs.push(`${f}: expected exactly one <svg> root, found ${open} open / ${close} close`);
  if (!/role="img"/.test(svg) || !/aria-label="/.test(svg))
    errs.push(`${f}: missing role="img" or aria-label (screen readers announce nothing)`);
}

if (errs.length) { console.error('README check failed:\n- ' + errs.join('\n- ')); process.exit(1); }
console.log('README check passed');
