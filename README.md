# Lucas Schwalm Silva

Personal site, live infrastructure monitor and **Coffee for the night shift**, a three-counter resource game backed by Plinth.

## Run locally

```sh
pnpm install --frozen-lockfile
```

The game has no server: the browser calls Plinth directly with a public JWT. That token may only run the `portfolio-cafe-v4` game templates and read the game's public domains.

Create `.env.local` (ignored by Git). The admin login is only for the scripts; it never enters the bundle:

```dotenv
PLINTH_EMAIL=your-admin-email
PLINTH_PASSWORD=your-admin-password
```

```sh
pnpm run cafe:token
pnpm run dev
```

On its first run, `cafe:token` registers an Ed25519 signing key with Plinth. It prints `PLINTH_SIGNING_KID` and `PLINTH_SIGNING_KEY`; keep both in `.env.local` so later runs reuse them. Each run prints a `VITE_PLINTH_TOKEN`; put it in the committed `.env` file. It is valid for 365 days by default (`pnpm run cafe:token <days>`). Plinth refuses a lifetime above its `PLINTH_TOKEN_MAX_TTL`, which defaults to 7 days. To revoke the token, retire the signing key with `DELETE /v1/auth/signing-key`.

`vpx scripts/cafe-templates.ts` prints the domains and templates as a Plinth proposal. Templates are immutable, so a rule change needs a new version.

## Cloudflare Pages

Build with `pnpm run build` and publish `dist` as a static site. The build reads `VITE_PLINTH_TOKEN` from the committed `.env`; the token is public by design. Do not put the admin login or the signing key in `.env` or in the Pages environment.

## Game and persistence

New rounds are two-minute rushes: keep as many fictional credits as possible before the deadline or twelve decisions. Three orders are available at once. Serving or discarding a ticket replaces only that ticket. Plinth draws each ticket's recipe and price with its `random` and `pick` nodes and stores them as bucket attributes, so the browser cannot choose an order. To serve or discard, the browser repeats the ticket's attributes, and Plinth rejects any change. The game uses the `portfolio-cafe-v4` domain tree; older rounds stay in Plinth but the site no longer reads them.

Start with 20 credits, 4 coffee and 2 milk. One machine prepares an order in 1, 3 or 5 seconds, deterministically assigned to its ticket. Longer preparations occupy the machine while other offers can be discarded. Discarding immediately frees a counter and saves ingredients but uses one of twelve decisions without earning anything.

Coffee and milk deliveries take 6, 9 or 12 seconds, independently of brewing and each other. Buy 3 coffee for 7 credits or 3 milk for 5; prices remain fixed by the existing Plinth templates. Pantry capacities remain 10 coffee and 8 milk. The browser holds the quoted credits while a delivery is pending. Actual payment and stock receipt happen together in one Plinth transaction after the delivery timer. Incoming portions cannot be brewed early. Unsubmitted work is cancelled on closure without a charge.

Preparation and delivery timers are browser pacing, not authoritative backend jobs or an anti-cheat mechanism. Absolute deadlines and request IDs are saved in local storage, so reloading resumes the same tasks instead of resetting their timers. Closed tabs do not submit background transactions: returning before the round closes catches up overdue tasks; returning afterwards cancels unsubmitted work. Unconfirmed submissions retain their original keys for safe retries.

Opening is one Plinth transaction that provisions the round buckets and the first three tickets. Every round bucket is named `c4<resource>:<round>`; Plinth composes the name from the round number. Each later operation checks the shift deadline and decision limit. Serving or discarding consumes a single-use ticket and provisions its replacement in the same transaction. Serving also checks stock, consumes ingredients and collects payment atomically. Independent simultaneous requests cannot consume the same ticket twice or take the round beyond twelve decisions. Retries retain their original idempotency keys; opening retries replay the committed opening transaction.

The opening template uses Plinth's `created_at` clock to save an immutable deadline exactly 120 whole seconds later. Every gameplay template checks that clock (`WITHIN_SHIFT`) and the twelve-decision limit (`SHIFT_OPEN`), so Plinth refuses late actions. The deadline is the balance of the round's `end` bucket. The browser reads it to show closure and to answer retries after it.

Closure is a derived terminal status, so no scheduler or timeout transaction is needed. A rush finishes at twelve decisions or its two-minute deadline, with the till balance as its score. Committed requests can be confirmed safely after closure using their saved metadata, while new actions are rejected. Changing the browser clock cannot extend the deadline, because Plinth checks its own clock.

The site displays the six most recently opened v4 rounds with dates, mode, served/discarded counts, credits and status. This includes ongoing rounds. It refreshes every fifteen seconds and reads only the game's own ledger records. Public summaries show the round number, which is not a capability.

The counter and choices are reconstructed from the persisted receipt in journal posting sequence. The browser keeps the current round number and a random secret for each round in local storage. Clearing site data loses that browser's access. Opening a round stores the secret as an attribute of a bucket in `portfolio-cafe-v4-keys`, which the public token cannot read. Every action reopens that bucket with `reuse`, so a wrong secret fails with 409. Every transaction also posts to that bucket, so the public token sees it as partial and Plinth hides its inputs, including the secret. A new round switches the active receipt while retaining older records in Plinth. Each game version uses a separate domain tree. No application database or process-local game lock is used.

The quantities are fictional. Before opening it to heavy public traffic, configure Cloudflare rate limiting for `/v1/transactions/execute/portfolio-cafe-v4-start` on the Plinth host, because `start` provisions new buckets. Keep this tenant dedicated to the demo.

## Check

```sh
pnpm run check
pnpm run build
pnpm run cafe:timing-check
pnpm run cafe:check
```

`check` runs [Vite+](https://viteplus.dev) format, lint (Oxlint) and type checks; `pnpm exec vp check --fix` fixes formatting. `build` runs the same checks except format.

`cafe:timing-check` runs locally without a service connection. It checks preparation times, independent delivery deadlines, reserved costs, reload recovery, stale tickets, closure and unconfirmed retry persistence.

`cafe:check` writes seven rush test rounds and one zero-duration round to the **real Plinth tenant**. It plays through the browser client with `VITE_PLINTH_TOKEN`, and uses the admin login only for the `portfolio-cafe-v4-expiry-check` fixture (an opening with a zero-second deadline) and does not publish or change templates. It checks that public readers cannot see a round secret and that a wrong secret is refused, plus atomic opening, idempotency, single-use tickets, stock capacity, concurrent last decisions, public history, the client's closure status (by advancing its clock in the test), closed-round retries and the Plinth clock guard through the fixture. It preserves the immutable test receipts.
