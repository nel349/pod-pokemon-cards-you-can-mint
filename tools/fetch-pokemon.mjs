// Fetches the 24 Pokemon this site shows from PokeAPI once, and writes
// data/pokemon.json plus site/img/<name>.png. Run only when the set changes;
// the site itself never calls PokeAPI.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const IDS = [1, 4, 6, 7, 9, 12, 25, 26, 35, 39, 52, 54, 63, 68, 74, 92, 94, 104, 123, 130, 131, 133, 143, 150];
const TYPES = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];

const api = async (path) => {
  const res = await fetch(`https://pokeapi.co/api/v2/${path}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
};

// damage_relations, once per type, so strengths and weaknesses are computed, not guessed.
const chart = {};
for (const t of TYPES) {
  const d = (await api(`type/${t}`)).damage_relations;
  chart[t] = {
    doubleTo: d.double_damage_to.map((x) => x.name),
    halfTo: d.half_damage_to.map((x) => x.name),
    noTo: d.no_damage_to.map((x) => x.name),
  };
}

const multiplier = (attacking, defending) => {
  const r = chart[attacking];
  if (r.noTo.includes(defending)) return 0;
  if (r.doubleTo.includes(defending)) return 2;
  if (r.halfTo.includes(defending)) return 0.5;
  return 1;
};

const out = [];
for (const id of IDS) {
  const p = await api(`pokemon/${id}`);
  const types = p.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name);

  // Strong against: a type this Pokemon's own types hit for double damage.
  const strong = TYPES.filter((d) => types.some((a) => multiplier(a, d) === 2));
  // Weak against: an attacking type that hits this Pokemon for more than normal damage,
  // multiplied across both of its types.
  const weak = TYPES.filter((a) => types.reduce((m, d) => m * multiplier(a, d), 1) > 1);

  out.push({
    id: p.id,
    name: p.name.charAt(0).toUpperCase() + p.name.slice(1),
    slug: p.name,
    types,
    heightM: p.height / 10,
    weightKg: p.weight / 10,
    strong,
    weak,
  });

  const art = p.sprites.other['official-artwork'].front_default;
  const img = Buffer.from(await (await fetch(art)).arrayBuffer());
  await mkdir(join(root, 'site/img'), { recursive: true });
  await writeFile(join(root, `site/img/${p.name}.png`), img);
  console.log(`${p.id} ${p.name} ${types.join('/')} ${(img.length / 1024).toFixed(0)}KB`);
}

await mkdir(join(root, 'data'), { recursive: true });
await writeFile(join(root, 'data/pokemon.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(`wrote data/pokemon.json with ${out.length} Pokemon`);
