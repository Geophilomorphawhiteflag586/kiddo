/**
 * Страница-ревизия базы «Известные люди»: public/people-review.html
 *
 *   node scripts/people-review.mjs   →   http://localhost:3000/people-review.html
 *
 * Нужна до того, как появится интерфейс модуля: пролистать 125 карточек
 * глазами дешевле, чем ловить неверное фото уже в квизе у ребёнка.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PEOPLE } from '../src/modules/people/data/people.ts';
import { CREDIT_BY_ID } from '../src/modules/people/data/credits.ts';

const CATEGORY_RU = {
  history: 'История', alash: 'Алаш', literature: 'Литература', science: 'Наука',
  music: 'Музыка', art: 'Искусство и кино', sport: 'Спорт', space: 'Космос и авиация',
};

const escape = (text) =>
  String(text ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const cards = Object.entries(CATEGORY_RU)
  .map(([key, title]) => {
    const list = PEOPLE.filter((person) => person.category === key);
    if (list.length === 0) return '';
    const items = list
      .map((person) => {
        const credit = CREDIT_BY_ID.get(person.id);
        const years = [person.birthYear, person.deathYear].filter(Boolean).join(' — ');
        return `<figure>
  <img src="/people/${person.id}.webp" alt="${escape(person.nameRu)}" loading="lazy">
  ${person.imageKind === 'depiction' ? '<span class="tag">портрет, не фото</span>' : ''}
  <figcaption>
    <b>${escape(person.nameRu)}</b>
    <span class="role">${escape(person.role)}</span>
    <span class="years">${escape(years)}</span>
    <span class="desc">${escape(person.shortDescription ?? '')}</span>
    <span class="lic">${escape(credit?.license)} · <a href="${escape(credit?.sourceUrl)}" target="_blank">файл</a>
      · <a href="${escape(credit?.dataSource)}" target="_blank">данные</a></span>
  </figcaption>
</figure>`;
      })
      .join('\n');
    return `<h2>${title} <small>${list.length}</small></h2>\n<div class="grid">${items}</div>`;
  })
  .join('\n');

writeFileSync(
  join(process.cwd(), 'public', 'people-review.html'),
  `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ревизия базы «Известные люди»</title>
<style>
 body{background:#0f1220;color:#e8ebf5;font:15px/1.45 system-ui,sans-serif;margin:0;padding:24px}
 h1{margin:0 0 4px} h2{margin:32px 0 12px;font-size:20px}
 h2 small{color:#8b93a7;font-weight:400}
 .sum{color:#9aa3bb;margin-bottom:8px}
 .grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(190px,1fr))}
 figure{margin:0;background:#181c2e;border-radius:14px;overflow:hidden;position:relative}
 img{width:100%;aspect-ratio:1;object-fit:cover;display:block;background:#fff}
 .tag{position:absolute;top:8px;left:8px;background:#f59e0b;color:#1a1a1a;font-size:11px;
      font-weight:700;padding:2px 7px;border-radius:99px}
 figcaption{padding:10px;display:flex;flex-direction:column;gap:3px}
 .role{color:#8b5cf6;font-weight:700;font-size:13px}
 .years,.desc,.lic{color:#8b93a7;font-size:12px}
 .desc{max-height:34px;overflow:hidden}
 a{color:#6ea8fe}
</style></head><body>
<h1>Ревизия базы «Известные люди»</h1>
<p class="sum">Всего ${PEOPLE.length} · фотографий ${PEOPLE.filter((p) => p.imageKind === 'photo').length}
 · портретов ${PEOPLE.filter((p) => p.imageKind === 'depiction').length}.
 Проверяйте: то ли лицо, верна ли роль, нет ли повторов.</p>
${cards}
</body></html>`,
);

console.log(`public/people-review.html — ${PEOPLE.length} карточек`);
