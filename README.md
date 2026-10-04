# Lucas Schwalm Silva

Personal site, live infrastructure monitor and **Coffee for the night shift**, a three-counter resource game backed by Plinth.

## Run locally

```sh
pnpm install --frozen-lockfile
```

Create `.env.local` (ignored by Git):

```dotenv
PLINTH_EMAIL=your-test-account-email
PLINTH_PASSWORD=your-test-account-password
```

```sh
npm run cafe:setup
npm run dev
```

Open `/play`. Setup creates the game's own `portfolio-cafe-v2` domain tree and seven immutable templates. It can be run again safely. The supplied test account has already been initialized.

## Cloudflare Pages

Build with `npm run build`, publish `dist`, and keep the root `functions` directory in the Pages Git deployment. `functions/api/cafe.ts` handles `/api/cafe`.

Set **PLINTH_EMAIL** and **PLINTH_PASSWORD** as server secrets in the Pages project's Production and Preview environments. Do not prefix them with `VITE_`: they must never enter the browser bundle. A static upload of `dist` alone cannot run the game's API. `npm run preview` also serves only the static build; use `npm run dev` for the local game.

## Game and persistence

Three orders are available at once. Serving or discarding a ticket replaces only that ticket; its recipe and price are persisted in Plinth. Each round has twelve decisions and a 15-minute deadline. Win by serving at least eight orders and keeping at least 50 fictional credits.

Start with 20 credits, 4 coffee and 2 milk. Buy 3 coffee for 7 credits or 3 milk for 5. Pantry capacities are 10 coffee and 8 milk. Deliveries spend credits but do not use decisions. Discards use one decision without earning anything, so more than four discards makes the service target unreachable.

Opening uses a three-operation atomic Plinth batch because each template may provision at most four buckets. Each later operation checks the shift deadline and decision limit. Serving or discarding consumes a single-use ticket and provisions its replacement in the same transaction. Serving also checks stock, consumes ingredients and collects payment atomically. Independent simultaneous requests cannot consume the same ticket twice or take the round beyond twelve decisions. Retries retain their original idempotency keys; opening retries confirm the already committed atomic batch.

The opening template uses Plinth's `created_at` clock to compute a deadline exactly 900 whole seconds later and stores it as an immutable journal attribute. Every gameplay template checks that server clock against the saved deadline. The browser timer is only a display. A closed tab, changed browser clock or restart cannot extend the round.

Expiry is a derived terminal status: an unfinished round at or beyond its saved deadline is expired and accepts no further gameplay writes. No scheduler or timeout transaction is needed; no background job appends a record at minute fifteen. Completed results remain completed after their deadline. The history shows the deadline as the closure time for expired rounds.

The site displays the six most recently opened v2 rounds with opening dates, served/discarded counts, credits and active/won/lost/expired statuses. This includes ongoing rounds. It refreshes every fifteen seconds and reads only the game's own ledger records. Public summaries expose a short anonymous label, never the full cookie capability.

The counter and choices are reconstructed from the persisted receipt in journal posting sequence. A random, HttpOnly cookie restores the current round in the same browser for up to a year; clearing cookies loses that browser's access. A new round switches the active receipt while retaining older records in Plinth. The v2 game uses a separate domain tree from the earlier eight-order demo. No application database or process-local game lock is used. Login sessions are renewed after a Plinth 401.

This uses the supplied test account and fictional quantities. Before opening it to heavy public traffic, configure Cloudflare rate limiting for `/api/cafe`, especially `start`, which provisions new buckets. Keep this account dedicated to the demo.

## Check

```sh
npm run build
npm run cafe:check
```

`cafe:check` writes seven normal test rounds and one zero-duration clock fixture to the configured **real Plinth account**. It checks three persistent choices, discards, stock capacity, atomic opening, idempotent retries, simultaneous ticket use, the concurrent last decision, the latest six public rounds, a completed game and expiry of every action using the real Plinth clock. It preserves the immutable test receipts.
