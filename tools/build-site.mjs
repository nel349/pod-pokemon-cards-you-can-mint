// Builds site/ from data/pokemon.json and data/site.json.
// Everything the browser needs is written into the page itself: no build step
// runs on the server, no script is fetched from anywhere, and no RPC of ours
// is ever called. Run with: node tools/build-site.mjs
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pokemon = JSON.parse(await readFile(join(root, 'data/pokemon.json'), 'utf8'));
const cfg = JSON.parse(await readFile(join(root, 'data/site.json'), 'utf8'));

const PRICE = `${cfg.priceLabel} ${cfg.coin}`; // the one price that appears anywhere
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const dex = (n) => `#${String(n).padStart(3, '0')}`;
const typeList = (ts) => ts.map(title).join(' / ');

const TYPE_COLOUR = {
  normal: '#9fa19f', fire: '#e8702a', water: '#2b7ce8', electric: '#e3c01c', grass: '#4caf50',
  ice: '#58c8d8', fighting: '#c0392b', poison: '#8e44ad', ground: '#b89d4c', flying: '#7f9fe0',
  psychic: '#e05c86', bug: '#8fbe2a', rock: '#9c8544', ghost: '#6a5acd', dragon: '#4a52c4',
  dark: '#5b5146', steel: '#7f98a8', fairy: '#e89ad0',
};

const css = `
:root {
  --ink: #f2f4f8; --dim: #a9b2c4; --edge: #2a3350; --panel: #161c30; --panel2: #1e2640;
  --accent: #8ab4ff; --good: #4ade80; --warn: #fbbf24;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: radial-gradient(1200px 700px at 50% -200px, #24305c, #0c1020 60%) fixed, #0c1020;
  color: var(--ink); font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  -webkit-text-size-adjust: 100%;
}
a { color: var(--accent); }
.wrap { max-width: 1100px; margin: 0 auto; padding: 24px 16px 72px; }
header.top { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; justify-content: space-between; }
h1 { font-size: 30px; margin: 0 0 4px; letter-spacing: -0.01em; }
.sub { color: var(--dim); margin: 0; }
.chain {
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 18px 0 0;
  background: var(--panel); border: 1px solid var(--edge); border-radius: 14px; padding: 12px 14px;
}
.chain .who { font-variant-numeric: tabular-nums; color: var(--dim); font-size: 14px; word-break: break-all; }
button {
  font: inherit; font-weight: 600; cursor: pointer; border-radius: 10px; padding: 9px 16px;
  border: 1px solid var(--edge); background: var(--panel2); color: var(--ink);
}
button.primary { background: linear-gradient(#3f6fe0, #2f55bb); border-color: #4f7ae8; }
button:disabled { opacity: .5; cursor: not-allowed; }
.searchbar { margin: 18px 0 6px; }
.searchbar input {
  width: 100%; font: inherit; padding: 13px 16px; border-radius: 12px; color: var(--ink);
  background: var(--panel); border: 1px solid var(--edge);
}
.count { color: var(--dim); font-size: 14px; margin: 8px 2px 16px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 16px; }
.card {
  background: linear-gradient(180deg, var(--panel2), var(--panel)); border: 1px solid var(--edge);
  border-radius: 18px; padding: 14px; display: flex; flex-direction: column; gap: 8px;
}
.card button.mint { margin-top: auto; }
.yours:empty, .state:empty { display: none; }
.card img.art { width: 100%; height: auto; aspect-ratio: 1 / 1; object-fit: contain; display: block; background: #0f1426; border-radius: 12px; }
.dex { margin: 2px 0 0; color: var(--dim); font-size: 13px; letter-spacing: .04em; text-transform: uppercase; }
.name { margin: 0; font-size: 20px; }
.name a { text-decoration: none; color: var(--ink); }
.name a:hover { text-decoration: underline; }
.pills { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; }
.pill { font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: 999px; color: #0b0f1c; }
.price { margin: 4px 0 0; font-size: 14px; color: var(--dim); }
.price b { color: var(--ink); font-size: 16px; white-space: nowrap; }
.left { font-size: 13px; color: var(--dim); min-height: 19px; margin: 0; }
.left.gone { color: var(--warn); }
.yours { font-size: 13px; color: var(--good); font-weight: 700; margin: 0; }
.cardlink { font-size: 14px; margin: 0; }
.state { font-size: 13px; color: var(--dim); word-break: break-all; margin: 0; }
.state.bad { color: #ff9b9b; }
.detail { display: grid; grid-template-columns: 320px 1fr; gap: 28px; align-items: start; margin-top: 18px; }
.detail img.art { width: 100%; height: auto; background: var(--panel); border: 1px solid var(--edge); border-radius: 20px; }
.facts { border-collapse: collapse; width: 100%; margin: 14px 0; }
.facts th, .facts td { text-align: left; padding: 9px 10px; border-bottom: 1px solid var(--edge); vertical-align: top; }
.facts th { color: var(--dim); font-weight: 600; width: 44%; }
.buy { background: var(--panel); border: 1px solid var(--edge); border-radius: 16px; padding: 16px; margin-top: 10px; }
.notes { margin-top: 44px; background: var(--panel); border: 1px solid var(--edge); border-radius: 16px; padding: 18px 20px; }
.notes h2 { font-size: 18px; margin: 0 0 10px; }
.notes li { margin-bottom: 8px; color: var(--dim); }
.notes li b { color: var(--ink); }
code { background: #0f1426; border: 1px solid var(--edge); border-radius: 6px; padding: 1px 5px; font-size: 13px; word-break: break-all; }
.back { display: inline-block; margin-bottom: 6px; font-size: 14px; }
@media (max-width: 760px) {
  .grid { grid-template-columns: 1fr; }
  .detail { grid-template-columns: 1fr; }
  h1 { font-size: 24px; }
  .wrap { padding: 16px 14px 56px; }
  /* One column, so the art is kept short enough that a card fits a phone screen. */
  .card img.art { aspect-ratio: 2 / 1; }
  .detail .card img.art { aspect-ratio: 1 / 1; max-width: 300px; margin: 0 auto; }
  .facts th, .facts td { padding: 8px 4px; }
  .facts th { width: 46%; }
}
`.trim();

const pills = (types) =>
  `<p class="pills">${types.map((t) => `<span class="pill" style="background:${TYPE_COLOUR[t] || '#888'}">${esc(title(t))}</span>`).join('')}</p>`;

// The chain code. It speaks only to the visitor's own wallet (window.ethereum):
// eth_chainId, eth_accounts, eth_requestAccounts, eth_call, eth_sendTransaction,
// eth_getTransactionReceipt. There is no RPC address in this file and no key.
const chainScript = (list) => `
const CONTRACT = ${JSON.stringify(cfg.contract)};
const CHAIN_ID = ${JSON.stringify(cfg.chainIdHex)};
const CHAIN_NAME = ${JSON.stringify(cfg.chainName)};
const EXPLORER = ${JSON.stringify(cfg.explorer)};
const PRICE_WEI = ${JSON.stringify(cfg.priceWeiHex)};
const PRICE_TEXT = ${JSON.stringify(PRICE)};
const EDITIONS = ${cfg.editions};
const MINT_SELECTOR = ${JSON.stringify(cfg.mintSelector)};
const STATUS_SELECTOR = ${JSON.stringify(cfg.statusSelector)};
const DEX = ${JSON.stringify(list.map((p) => p.id))};

const pad = (n) => BigInt(n).toString(16).padStart(64, '0');
const eth = () => window.ethereum;
let account = null;

const say = (el, text, bad) => { if (el) { el.textContent = text; el.classList.toggle('bad', !!bad); } };

function statusCall(who) {
  // status(address who, uint256[] pokedex) -> (uint256[] minted, bool[] owned)
  let data = STATUS_SELECTOR + pad(BigInt(who || '0x0')) + pad(64) + pad(DEX.length);
  for (const d of DEX) data += pad(d);
  return data;
}

function readWords(hex) {
  const body = hex.startsWith('0x') ? hex.slice(2) : hex;
  const words = [];
  for (let i = 0; i + 64 <= body.length; i += 64) words.push(body.slice(i, i + 64));
  return words;
}

function decodeStatus(hex) {
  const w = readWords(hex);
  if (w.length < 2) return null;
  const at = (word) => Number(BigInt('0x' + word)) / 32;
  const readArray = (start) => {
    const n = Number(BigInt('0x' + w[start]));
    return w.slice(start + 1, start + 1 + n).map((x) => BigInt('0x' + x));
  };
  const minted = readArray(at(w[0]));
  const owned = readArray(at(w[1])).map((x) => x !== 0n);
  if (minted.length !== DEX.length || owned.length !== DEX.length) return null;
  return { minted: minted.map(Number), owned };
}

function paint(row) {
  DEX.forEach((id, i) => {
    const card = document.querySelector('[data-dex="' + id + '"]');
    if (!card) return;
    const leftEl = card.querySelector('.left');
    const yoursEl = card.querySelector('.yours');
    const btn = card.querySelector('button.mint');
    if (!row) {
      say(leftEl, 'Connect a wallet to see how many are left.');
      say(yoursEl, '');
      if (btn) { btn.disabled = false; btn.textContent = 'Mint for ' + PRICE_TEXT; }
      return;
    }
    const gone = row.minted[i];
    const left = EDITIONS - gone;
    const owned = row.owned[i];
    leftEl.classList.toggle('gone', left === 0);
    say(leftEl, left + ' of ' + EDITIONS + ' left (' + gone + ' minted)');
    say(yoursEl, owned ? 'You own this card' : '');
    if (btn) {
      if (owned) { btn.disabled = true; btn.textContent = 'Already yours'; }
      else if (left === 0) { btn.disabled = true; btn.textContent = 'Sold out'; }
      else { btn.disabled = false; btn.textContent = 'Mint for ' + PRICE_TEXT; }
    }
  });
}

async function onRightChain() {
  const id = await eth().request({ method: 'eth_chainId' });
  return id && id.toLowerCase() === CHAIN_ID;
}

async function refresh() {
  const bar = document.getElementById('walletState');
  if (!eth()) { say(bar, 'No wallet in this browser. Install one that speaks to ' + CHAIN_NAME + ' to mint.', true); paint(null); return; }
  if (!(await onRightChain())) {
    say(bar, account ? 'Your wallet is on another network. Press Connect to switch to ' + CHAIN_NAME + '.' : 'Connect a wallet on ' + CHAIN_NAME + '.');
    paint(null);
    return;
  }
  try {
    const hex = await eth().request({ method: 'eth_call', params: [{ to: CONTRACT, data: statusCall(account) }, 'latest'] });
    const row = decodeStatus(hex);
    paint(row);
    say(bar, account ? 'Connected as ' + account + ' on ' + CHAIN_NAME + '.' : 'Reading ' + CHAIN_NAME + '. Connect a wallet to mint and to see the cards you own.');
  } catch (err) {
    paint(null);
    say(bar, 'Could not read the contract: ' + (err && err.message ? err.message : err), true);
  }
}

async function connect() {
  const bar = document.getElementById('walletState');
  if (!eth()) { say(bar, 'No wallet in this browser.', true); return; }
  try {
    const accounts = await eth().request({ method: 'eth_requestAccounts' });
    account = accounts && accounts[0] ? accounts[0] : null;
    if (!(await onRightChain())) {
      try {
        await eth().request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID }] });
      } catch (switchErr) {
        if (switchErr && (switchErr.code === 4902 || switchErr.code === -32603)) {
          await eth().request({ method: 'wallet_addEthereumChain', params: [{
            chainId: CHAIN_ID, chainName: CHAIN_NAME,
            nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
            rpcUrls: [${JSON.stringify(cfg.rpcForWallet)}], blockExplorerUrls: [EXPLORER],
          }] });
        } else { throw switchErr; }
      }
    }
  } catch (err) {
    say(bar, 'Wallet said no: ' + (err && err.message ? err.message : err), true);
    return;
  }
  await refresh();
}

async function mint(id, card) {
  const state = card.querySelector('.state');
  const btn = card.querySelector('button.mint');
  if (!eth()) { say(state, 'No wallet in this browser.', true); return; }
  if (!account) { await connect(); if (!account) return; }
  if (!(await onRightChain())) { say(state, 'Switch your wallet to ' + CHAIN_NAME + ' first.', true); return; }
  btn.disabled = true;
  say(state, 'Asking your wallet to pay ' + PRICE_TEXT + '...');
  let hash;
  try {
    hash = await eth().request({ method: 'eth_sendTransaction', params: [{
      from: account, to: CONTRACT, value: PRICE_WEI, data: MINT_SELECTOR + pad(id),
    }] });
  } catch (err) {
    say(state, 'Not minted: ' + (err && err.message ? err.message : err), true);
    btn.disabled = false;
    return;
  }
  const link = '<a href="' + EXPLORER + '/tx/' + hash + '" target="_blank" rel="noopener">' + hash + '</a>';
  state.innerHTML = 'Sent. Transaction ' + link + ' - waiting for ' + CHAIN_NAME + '...';
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    let receipt = null;
    try { receipt = await eth().request({ method: 'eth_getTransactionReceipt', params: [hash] }); } catch (e) { receipt = null; }
    if (receipt) {
      const ok = receipt.status === '0x1';
      state.innerHTML = (ok ? 'Minted. Transaction ' : 'The chain rejected it. Transaction ') + link;
      state.classList.toggle('bad', !ok);
      await refresh();
      return;
    }
  }
  state.innerHTML = 'Still waiting. Transaction ' + link;
}

document.querySelectorAll('button.mint').forEach((btn) => {
  btn.addEventListener('click', () => mint(Number(btn.closest('.card').dataset.dex), btn.closest('.card')));
});
const connectBtn = document.getElementById('connect');
if (connectBtn) connectBtn.addEventListener('click', connect);

(async () => {
  if (!eth()) { await refresh(); return; }
  // A return visit with the same wallet: eth_accounts answers without a prompt,
  // so an owned card is read back off the chain and shown straight away.
  try {
    const accounts = await eth().request({ method: 'eth_accounts' });
    account = accounts && accounts[0] ? accounts[0] : null;
  } catch (e) { account = null; }
  if (eth().on) {
    eth().on('accountsChanged', (a) => { account = a && a[0] ? a[0] : null; refresh(); });
    eth().on('chainChanged', () => refresh());
  }
  await refresh();
})();
`.trim();

const walletBar = `
    <div class="chain">
      <button id="connect" class="primary" type="button">Connect wallet</button>
      <span class="who" id="walletState">Looking for a wallet...</span>
    </div>`;

const assumptions = (where) => `
    <section class="notes">
      <h2>What this is, and what we assumed</h2>
      <ul>
        <li><b>The mint is real.</b> Pressing mint asks your own wallet to send ${PRICE} to the contract at <code>${cfg.contract}</code> on ${cfg.chainName}, which mints the card to you and shows you the transaction. Nothing on this page pretends.</li>
        <li><b>The price.</b> Whoever posted this job asked for ten dollars a mint. ${cfg.chainName} coins are handed out free by a faucet and have no dollar price, so a dollar figure cannot be charged here and any conversion would be invented. Every card costs ${PRICE}, the test-network stand-in for that ten dollars. The contract has <code>setPrice</code>, so its owner changes the figure without redeploying.</li>
        <li><b>Ten of each.</b> Ten copies of each Pokemon exist, ever, and one wallet may hold one copy of a given Pokemon. Ten of a Pokemon therefore means ten different owners. Each card says how many are left, read from the chain.</li>
        <li><b>Where the chain is read.</b> Only through your own wallet. This site has no server and calls no node of its own, so until a wallet is connected it cannot say how many are left.</li>
        <li><b>The pictures</b> are files in this site, not fetched from anywhere. Pokemon, its names and its artwork are trademarks of Nintendo, Creatures Inc. and GAME FREAK inc. This is a test-network demonstration, not a licensed product.</li>
        <li><b>The twenty-four</b> Pokemon here were chosen by the pod for a spread of types; the job did not name any. The contract takes a Pokedex number, and its owner can add more with <code>setCard</code>.</li>
      </ul>
      ${where}
    </section>`;

const page = ({ head, body, script }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${head}
<style>
${css}
</style>
</head>
<body>
<div class="wrap">
${body}
</div>
<script>
${script}
</script>
</body>
</html>
`;

// ------------------------------------------------------------------ home page

const cardHtml = (p) => `      <article class="card" data-dex="${p.id}" data-name="${esc(p.slug)}" data-types="${esc(p.types.join(' '))}">
        <img class="art" src="/img/${esc(p.slug)}.png" alt="${esc(p.name)}" width="240" height="240" loading="lazy">
        <p class="dex">${dex(p.id)} &middot; ${esc(typeList(p.types))}</p>
        <h2 class="name"><a href="/cards/${esc(p.slug)}.html">${esc(p.name)}</a></h2>
        ${pills(p.types)}
        <p class="price">Mint on ${cfg.chainName} for <b>${PRICE}</b></p>
        <p class="left">Connect a wallet to see how many are left.</p>
        <p class="yours"></p>
        <button class="mint primary" type="button">Mint for ${PRICE}</button>
        <p class="state"></p>
        <p class="cardlink"><a href="/cards/${esc(p.slug)}.html">${esc(p.name)}'s card &rarr;</a></p>
      </article>`;

const home = page({
  head: `<title>Pokemon cards you can mint on ${cfg.chainName}</title>
<meta name="description" content="Twenty-four Pokemon cards. Mint the one you like as a token on ${cfg.chainName} for ${PRICE}.">`,
  body: `  <header class="top">
    <div>
      <h1>Pokemon cards you can mint</h1>
      <p class="sub">Twenty-four cards. Mint the one you like as a token on ${cfg.chainName}. Every card costs <b>${PRICE}</b>, and there are only ${cfg.editions} of each.</p>
    </div>
  </header>
${walletBar}
  <div class="searchbar">
    <label class="sub" for="search">Search by name</label>
    <input id="search" type="search" placeholder="Type part of a name, such as pika" autocomplete="off" spellcheck="false">
  </div>
  <p class="count" id="count">${pokemon.length} Pokemon</p>
  <main class="grid" id="grid">
${pokemon.map(cardHtml).join('\n')}
  </main>
${assumptions(`<p class="sub">The contract is <code>${cfg.contract}</code> on ${cfg.chainName}. Its source and the whole of this site are in the job's repository.</p>`)}`,
  script: `${chainScript(pokemon)}

// Typing part of a name leaves only the Pokemon whose names match.
const search = document.getElementById('search');
const countEl = document.getElementById('count');
const allCards = Array.from(document.querySelectorAll('#grid .card'));
search.addEventListener('input', () => {
  const needle = search.value.trim().toLowerCase();
  let shown = 0;
  for (const card of allCards) {
    const match = needle === '' || card.dataset.name.includes(needle);
    card.hidden = !match;
    card.style.display = match ? '' : 'none';
    if (match) shown++;
  }
  countEl.textContent = needle === ''
    ? shown + ' Pokemon'
    : shown + (shown === 1 ? ' Pokemon matches "' : ' Pokemon match "') + search.value.trim() + '"';
});`,
});

// ------------------------------------------------------------------ card pages

const detail = (p) => page({
  head: `<title>${esc(p.name)} ${dex(p.id)} - mint it on ${cfg.chainName}</title>
<meta name="description" content="${esc(p.name)}, ${esc(typeList(p.types))}. Height, weight, what it is strong and weak against, and a mint on ${cfg.chainName} for ${PRICE}.">`,
  body: `  <p class="back"><a href="/">&larr; All ${pokemon.length} cards</a></p>
  <header class="top">
    <div>
      <h1>${esc(p.name)}</h1>
      <p class="sub">${dex(p.id)} &middot; ${esc(typeList(p.types))}</p>
    </div>
  </header>
${walletBar}
  <div class="detail">
    <article class="card" data-dex="${p.id}" data-name="${esc(p.slug)}">
      <img class="art" src="/img/${esc(p.slug)}.png" alt="${esc(p.name)}" width="320" height="320">
      <p class="dex">${dex(p.id)} &middot; ${esc(typeList(p.types))}</p>
      ${pills(p.types)}
      <p class="price">Mint on ${cfg.chainName} for <b>${PRICE}</b></p>
      <p class="left">Connect a wallet to see how many are left.</p>
      <p class="yours"></p>
      <button class="mint primary" type="button">Mint for ${PRICE}</button>
      <p class="state"></p>
    </article>
    <div>
      <table class="facts">
        <tbody>
          <tr><th scope="row">Number</th><td>${dex(p.id)}</td></tr>
          <tr><th scope="row">Type</th><td>${esc(typeList(p.types))}</td></tr>
          <tr><th scope="row">Height</th><td>${p.heightM} m</td></tr>
          <tr><th scope="row">Weight</th><td>${p.weightKg} kg</td></tr>
          <tr><th scope="row">Strong against</th><td>${p.strong.length ? esc(p.strong.map(title).join(', ')) : 'Nothing in particular: its own types hit everything for normal damage or less.'}</td></tr>
          <tr><th scope="row">Weak against</th><td>${p.weak.length ? esc(p.weak.map(title).join(', ')) : 'Nothing: no type hits it for more than normal damage.'}</td></tr>
          <tr><th scope="row">Price to mint</th><td>${PRICE} on ${cfg.chainName}</td></tr>
          <tr><th scope="row">How many exist</th><td>${cfg.editions}, one to a wallet</td></tr>
        </tbody>
      </table>
      <p class="sub">Strong against is what ${esc(p.name)}'s own types hit for double damage. Weak against is what hits ${esc(p.name)} for more than normal damage, counting both of its types.</p>
    </div>
  </div>
${assumptions(`<p class="sub">The contract is <code>${cfg.contract}</code> on ${cfg.chainName}, and this card is Pokedex number ${p.id} in it.</p>`)}`,
  script: chainScript([p]),
});

// ------------------------------------------------------------------ write it out

await rm(join(root, 'site/cards'), { recursive: true, force: true });
await rm(join(root, 'site/meta'), { recursive: true, force: true });
await mkdir(join(root, 'site/cards'), { recursive: true });
await mkdir(join(root, 'site/meta'), { recursive: true });
await writeFile(join(root, 'site/index.html'), home);
for (const p of pokemon) {
  await writeFile(join(root, `site/cards/${p.slug}.html`), detail(p));
  // What tokenURI points at once the contract's owner sets a base address.
  await writeFile(join(root, `site/meta/${p.id}.json`), `${JSON.stringify({
    name: `${p.name} ${dex(p.id)}`,
    description: `${p.name}, ${typeList(p.types)}. One of ${cfg.editions} minted on ${cfg.chainName}.`,
    image: `/img/${p.slug}.png`,
    attributes: [
      { trait_type: 'Pokedex number', value: p.id },
      ...p.types.map((t) => ({ trait_type: 'Type', value: title(t) })),
      { trait_type: 'Height (m)', value: p.heightM },
      { trait_type: 'Weight (kg)', value: p.weightKg },
    ],
  }, null, 2)}\n`);
}
console.log(`site/index.html + ${pokemon.length} card pages + ${pokemon.length} metadata files`);
