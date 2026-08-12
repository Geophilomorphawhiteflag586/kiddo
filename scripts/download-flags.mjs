/**
 * Скачивает флаги всех стран в public/flags, чтобы приложение не зависело от
 * стороннего CDN во время игры (и работало офлайн).
 *
 *   node scripts/download-flags.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'public/flags');
mkdirSync(out, { recursive: true });

const source = readFileSync(resolve(root, 'src/data/countries.ts'), 'utf8');
const codes = [...source.matchAll(/"code":\s*"([A-Z]{2})"/g)].map((m) => m[1]);

let downloaded = 0;
const failed = [];

for (const code of codes) {
  const file = resolve(out, `${code}.png`);
  if (existsSync(file)) continue;
  const url = `https://flagcdn.com/w320/${code.toLowerCase()}.png`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    downloaded += 1;
  } catch (error) {
    failed.push(`${code}: ${error.message}`);
  }
}

console.log(`Скачано ${downloaded} флагов из ${codes.length}`);
if (failed.length) console.warn('Ошибки:', failed.join('; '));
