# PostingGTA

**Play wild. Post smart.**

[![Live site](https://img.shields.io/badge/live-postinggta.fun-fc37b2?style=flat-square)](https://postinggta.fun)
![Chain](https://img.shields.io/badge/chain-Solana-fec427?style=flat-square)

- **Chain:** Solana mainnet
- **Contract address:** `TBA` (shown at the top of the site once announced)

## Overview

PostingGTA is the landing site for the $POSTING community: a place that turns game footage into short vertical posts, with a live Solana market board running next to it. The page is a static build with no backend.

## Features

- Pinned CA slot at the top of every page with click-to-copy, inert until an address is stated
- Live Solana market board: top boosted pairs, ticker and card stack from one feed, refreshed every 60 seconds and paused while the tab is hidden
- Row one is reserved for $POSTING and switches from a branded placeholder to live data when the address is stated
- Register-driven facts: every external link or address is one record in `src/register.json` with a state of `stated`, `absent` or `unconfirmed`
- Spring-physics scroll reveals, hero parallax, spotlight hovers, and full reduced-motion support

## Links

- Site: https://postinggta.fun
- X: https://x.com/postingGTA
- Whitepaper: [docs/whitepaper.md](docs/whitepaper.md)

## Develop

```bash
npm install
npm run build   # writes dist/
npm test        # runs every gate against dist/ and both CA branches
npm run serve   # serves dist/ on http://localhost:4173
```

To announce the contract address, set `ca` in `src/register.json` to `{ "state": "stated", "value": "<address>" }` and rebuild. Brand sources live in `BRAND/`; `npm run assets` regenerates the cropped logo, mark and favicon from them.

## License

MIT, see [LICENSE](LICENSE).
