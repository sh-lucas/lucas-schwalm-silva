# Lucas Schwalm Silva

Personal site, live infrastructure monitor and **Coffee for the night shift**, an eight-order game backed by Plinth.

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

Open `/play`. Setup creates the game's own `portfolio-cafe-v1` domain tree and five immutable templates. It can be run again safely. The supplied test account has already been initialized.

## Cloudflare Pages

Build with `npm run build`, publish `dist`, and keep the root `functions` directory in the Pages Git deployment. `functions/api/cafe.ts` handles `/api/cafe`.

Set **PLINTH_EMAIL** and **PLINTH_PASSWORD** as server secrets in the Pages project's Production and Preview environments. Do not prefix them with `VITE_`: they must never enter the browser bundle. A static upload of `dist` alone cannot run the game's API. `npm run preview` also serves only the static build; use `npm run dev` for the local game.

## Game and persistence

Serve eight orders and aim for 60 fictional credits. Start with 20 credits, 4 coffee and 2 milk; each delivery costs 14 credits and adds 4 coffee and 3 milk. Two deliveries at the right time finish with 65 credits.

Each shift has four isolated buckets. Plinth templates check the current order and ingredient or credit balances, then commit all postings atomically. The simultaneous-request button submits two independent executions of the same order: one can commit, the other is rejected by the order guard. Interrupted requests remain unconfirmed until the receipt is refreshed or the same keys are retried.

The counter is derived from the persisted transaction receipt. A random, HttpOnly cookie restores the current shift in the same browser for up to a year; clearing cookies loses that browser's access. Starting another shift leaves the old ledger records intact but switches the active receipt. No application database or process-local game lock is used. Requests retry with their original idempotency keys. Login sessions are renewed after a Plinth 401.

This uses the supplied test account and fictional quantities. Before opening it to heavy public traffic, configure Cloudflare rate limiting for `/api/cafe`, especially `start`, which provisions new buckets. Keep this account dedicated to the demo.

## Check

```sh
npm run build
npm run cafe:check
```

`cafe:check` writes two isolated test shifts to the configured **real Plinth account**. It checks persistence, concurrent execution, retries, atomic rejection, shift isolation and the complete winning route. It preserves the immutable test receipts.
