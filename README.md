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

New rounds are two-minute rushes: keep as many fictional credits as possible before the deadline or twelve decisions. Three orders are available at once. Serving or discarding a ticket replaces only that ticket; its recipe and price are persisted in Plinth. Older rounds retain their original fifteen-minute deadline and eight-served / fifty-credit target. A `rush-v1` marker in the opening transaction metadata selects the new rules without changing any published template.

Start with 20 credits, 4 coffee and 2 milk. One machine prepares an order in 1, 3 or 5 seconds, deterministically assigned to its ticket. Longer preparations occupy the machine while other offers can be discarded. Discarding immediately frees a counter and saves ingredients but uses one of twelve decisions without earning anything.

Coffee and milk deliveries take 6, 9 or 12 seconds, independently of brewing and each other. Buy 3 coffee for 7 credits or 3 milk for 5; prices remain fixed by the existing Plinth templates. Pantry capacities remain 10 coffee and 8 milk. The browser holds the quoted credits while a delivery is pending. Actual payment and stock receipt happen together in one Plinth transaction after the delivery timer. Incoming portions cannot be brewed early. Unsubmitted work is cancelled on closure without a charge.

Preparation and delivery timers are browser pacing, not authoritative backend jobs or an anti-cheat mechanism. Absolute deadlines and request IDs are saved in local storage, so reloading resumes the same tasks instead of resetting their timers. Closed tabs do not submit background transactions: returning before the round closes catches up overdue tasks; returning afterwards cancels unsubmitted work. Unconfirmed submissions retain their original keys for safe retries.

Opening uses a three-operation atomic Plinth batch because each template may provision at most four buckets. Each later operation checks the shift deadline and decision limit. Serving or discarding consumes a single-use ticket and provisions its replacement in the same transaction. Serving also checks stock, consumes ingredients and collects payment atomically. Independent simultaneous requests cannot consume the same ticket twice or take the round beyond twelve decisions. Retries retain their original idempotency keys; opening retries confirm the already committed atomic batch.

The unchanged opening template uses Plinth's `created_at` clock to save an immutable native deadline exactly 900 whole seconds later. Every gameplay template checks that clock and the twelve-decision limit. For rushes, the site's Function derives the shorter deadline from the same immutable start time plus 120 seconds, returns it to the UI, and checks it again immediately before submitting a transaction, including after authentication retries. A request already sent to Plinth may settle after the rush deadline; the receipt includes that committed result. Enforcing an exact two-minute commit cutoff inside Plinth itself would require new templates. The existing native fifteen-minute guard remains in place.

Closure is a derived terminal status, so no scheduler or timeout transaction is needed. A rush finishes at twelve decisions or its two-minute deadline, with the till balance as its score; original rounds retain active/won/lost/expired outcomes. Committed requests can be confirmed safely after closure using their saved metadata, while new actions are rejected. Changing the browser clock or reloading cannot extend the Function's deadline.

The site displays the six most recently opened v2 rounds with dates, mode, served/discarded counts, credits and status. This includes ongoing rounds. It refreshes every fifteen seconds and reads only the game's own ledger records. Public summaries expose a short anonymous label, never the full cookie capability.

The counter and choices are reconstructed from the persisted receipt in journal posting sequence. A random, HttpOnly cookie restores the current round in the same browser for up to a year; clearing cookies loses that browser's access. A new round switches the active receipt while retaining older records in Plinth. The v2 game uses a separate domain tree from the earlier eight-order demo. No application database or process-local game lock is used. Login sessions are renewed after a Plinth 401.

This uses the supplied test account and fictional quantities. Before opening it to heavy public traffic, configure Cloudflare rate limiting for `/api/cafe`, especially `start`, which provisions new buckets. Keep this account dedicated to the demo.

## Check

```sh
npm run build
npm run cafe:timing-check
npm run cafe:check
```

`cafe:timing-check` runs locally without a service connection. It checks preparation times, independent delivery deadlines, reserved costs, reload recovery, stale tickets, cancellation and unconfirmed retry persistence.

`cafe:check` writes seven rush test rounds and one zero-duration round to the configured **real Plinth account**. It reuses the previously published `portfolio-cafe-v2-expiry-check` fixture and does not publish or change templates. It checks atomic opening, rush metadata, idempotency, single-use tickets, stock capacity, concurrent last decisions, public history, the Function's rush deadline (by advancing its clock in the test), closed-round retries and the original Plinth clock guard through the existing fixture. It preserves the immutable test receipts.
