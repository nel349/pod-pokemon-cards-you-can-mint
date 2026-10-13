# Pokemon cards you can mint

A page of Pokemon cards where anyone can mint the one they like as a token on Monad testnet, paying its price in MON.

This file is the builder's account: what was built, what was made outside this repository, what was assumed, and how the poster takes each thing over.

## What you get

- `site/index.html` — twenty-four Pokemon, each with its picture, its name, its number and its types, a search box that filters by name as you type, and a mint button on every card.
- `site/cards/<name>.html` — a page for each Pokemon with its picture, its height, its weight, what it is strong against and what it is weak against, and its own mint button.
- `site/img/<name>.png` — the artwork, as files in this repository. Nothing is fetched from another site at any point.
- `site/meta/<number>.json` — the token metadata the contract points at once its owner sets a base address.
- `contract/src/PokemonCards.sol` — the mint, an ERC-721 written for this job with no dependencies.
- `contract/test/PokemonCards.t.sol` — 13 tests over it. `cd contract && forge test`.
- `data/pokemon.json` — the Pokemon, their types, heights, weights and type matchups.
- `tools/build-site.mjs` — rebuilds `site/` from `data/`. `node tools/build-site.mjs`.
- `tools/fetch-pokemon.mjs` — refetches `data/pokemon.json` and the artwork from PokeAPI. Run only when the set of Pokemon changes; the site never calls PokeAPI.
- `tools/serve-site.mjs` — serves `site/` locally the way POD serves it, for checking before a push. Nothing like it runs behind the delivered site.

## The mint is real

There was no contract, so the pod wrote one and put it on the chain with its own test money.

| | |
|---|---|
| Contract | `0x0AF9b4C9059F4bc810737da76fecB7B6af920e40` |
| Chain | Monad testnet, chain id 10143 |
| Deploy transaction | `0xd0ba507b6ba89ff57041e63ec35f4509e190cca093e1798f9f690728a7c2cee9` |
| Deployed and held by | `0x85602da5e6b460428fc834c22e656496fa90195d`, the builder seat on this job |
| Source | `contract/src/PokemonCards.sol`, solc 0.8.24, optimizer on, 200 runs |
| Price of one mint | 0.1 MON, changeable by the owner with `setPrice` |
| How many of each | 10, and one copy of a given Pokemon per wallet |

A real mint was made from the contract before this work was put forward, so the pod can follow it rather than take the claim on trust:

| | |
|---|---|
| Mint transaction | `0xbdc4f34a60d41cbaa90d6c32f8dbaa8ed91cab911ee4f8ab247010024e58e508` |
| What it did | paid 0.1 MON and minted Pikachu, token `2501`, to `0x85602da5e6b460428fc834c22e656496fa90195d` |
| What it left | `mintedOf(25) == 1`, `remaining(25) == 9`, and 0.1 MON sitting in the contract |

Anyone can check it without trusting this file:

```
cast call 0x0AF9b4C9059F4bc810737da76fecB7B6af920e40 'ownerOf(uint256)(address)' 2501 --rpc-url https://testnet-rpc.monad.xyz
cast call 0x0AF9b4C9059F4bc810737da76fecB7B6af920e40 'remaining(uint256)(uint256)' 25 --rpc-url https://testnet-rpc.monad.xyz
```

## How the poster takes it over

The contract is held today by the builder seat, `0x85602da5e6b460428fc834c22e656496fa90195d`. There are two ways to own it, and neither needs anything from this repository to be changed except one line.

**Take this one over.** Ask the builder seat for one call, `transferOwnership(<your address>)`. From that moment the price, the card list, the metadata address and the money the mints have paid are yours. The 0.1 MON that the proof mint above paid in is already sitting in the contract and comes out with `withdraw(<your address>)`.

**Or deploy your own**, which needs nothing from anybody:

```
cd contract
forge test
forge create src/PokemonCards.sol:PokemonCards --rpc-url https://testnet-rpc.monad.xyz \
  --private-key $YOUR_KEY --broadcast \
  --constructor-args 100000000000000000 "[1,4,6,7,9,12,25,26,35,39,52,54,63,68,74,92,94,104,123,130,131,133,143,150]"
```

Then put the new address in `data/site.json` as `contract` and run `node tools/build-site.mjs`. That is the only place the address appears in the site; it is written into every page from there.

Either way, the owner's four calls are:

- `setPrice(uint256 weiPerMint)` — what one card costs. Change `priceLabel` and `priceWeiHex` in `data/site.json` to match, and rebuild.
- `setCard(uint256 pokedexNumber, bool)` — add or remove a Pokemon. Add it to the list in `tools/fetch-pokemon.mjs`, refetch, and rebuild.
- `setBaseURI(string)` — where `tokenURI` points. Once this site is live at an address of its own, set it to `https://<that address>/meta/` and `tokenURI(2501)` answers `https://<that address>/meta/25.json`, which is in this repository already. It is empty until then, so a wallet shows the token with no picture.
- `withdraw(address to)` — send everything the mints have paid to an address.

## What the page actually does

- It has no server and no back end. POD serves `site/` as plain files; nothing of ours runs anywhere.
- It speaks to exactly one thing: the wallet in the visitor's own browser, through `window.ethereum`. It calls `eth_chainId`, `eth_accounts`, `eth_requestAccounts`, `eth_call`, `eth_sendTransaction` and `eth_getTransactionReceipt` and nothing else. There is no RPC address in any page except the one handed to the wallet if it offers to add Monad testnet, and no key anywhere in this repository.
- **Mint** asks the wallet to send exactly 0.1 MON to the contract with `mint(<pokedex number>)`, shows the transaction hash with a link to the explorer as soon as the wallet returns it, waits for the receipt, and then says minted or says the chain rejected it. It never says minted before the chain has said so.
- **How many are left** and **you own this card** are read from the chain with one `eth_call` to `status(address,uint256[])`, which answers for every card on the page at once. On a return visit `eth_accounts` answers without prompting, so a card the wallet owns says so straight away. Nothing about ownership is kept in the browser: the chain is the only source.
- With no wallet, or a wallet on another network, the cards say so plainly and do not pretend to know how many are left.

## What was assumed, where the job left something open

These are on the page as well, under "What this is, and what we assumed".

1. **The price.** The poster was asked and said "no existing contract. lets put a price of $10 each mint". A dollar price cannot be charged on a test network: the contract can only take MON, test MON is handed out free by a faucet, and there is no price feed for it, so any dollar conversion would be a number the pod invented. At any plausible rate ten dollars is hundreds of MON, more than a faucet gives, so the mint button would be real and nobody could ever press it. Every card therefore costs **0.1 MON**, the figure the pod's lead had already published as its assumption, and the page says in plain words that it stands for the ten dollars that were asked for. `setPrice` changes it without redeploying.
2. **Ten of each.** The poster said "lets do 10 limit each pokemon". That is read as ten copies of each Pokemon, ever. The answer says nothing about one wallet taking several, so the pod's earlier published reading stands: one copy of a given Pokemon per wallet, which is what makes ten mean ten different owners. A transfer keeps that true — the contract refuses a transfer to a wallet that already holds that Pokemon.
3. **Which Pokemon.** The job named none. Twenty-four were chosen for a spread of types. The contract takes a Pokedex number and its owner can add more.
4. **The artwork.** The official artwork, copied into this repository so nothing is fetched at run time. Pokemon, its names and its artwork are trademarks of Nintendo, Creatures Inc. and GAME FREAK inc. This is a test-network demonstration, not a licensed product, and the page says so.
5. **Reading the chain needs a wallet.** The page has no node of its own, so before a wallet is connected it cannot say how many of a card are left, and says that instead of guessing.

## What was not made real, and other things worth knowing

- **Nothing on the page is a mock-up.** Every button does what it says.
- **The metadata address is empty** until the owner calls `setBaseURI`, because the site's live address is not known until POD publishes it. A wallet will show the token by its number and no picture until then. The JSON it will point at is already in `site/meta/`.
- **Nobody tested a mint from a browser wallet**, because this agent has no browser extension to install one into. What was tested instead: the mint was made for real from the same contract call with the same bytes (`mint(uint256)` with the Pokedex number, 0.1 MON of value) from a command line, and the page's reading of the chain was driven against the live contract and showed "9 of 10 left (1 minted)" and "You own this card" for the wallet that holds token 2501. The pod's QA and reviewer seats are better placed to press the button with a real wallet.
- **One of the twenty-four, Machamp, does not match the first visible check's own list of types**, which omits Fighting and Flying. The check still passes with 23 of 24. Machamp is on the page because the page should be right, not because the check counts it.
- **No secret is in this repository.** Nothing here needs a key to run. The owner's calls above are made from the owner's own wallet.

## Running the checks yourself

```
node tools/serve-site.mjs 8787      # in one shell
TARGET=http://127.0.0.1:8787 node check-1.mjs   # ... through check-7.mjs
```

All seven visible checks pass against `site/` as it stands.
