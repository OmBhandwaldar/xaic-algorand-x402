# AIShield — x402 insurance for AI tool calls (Algorand TestNet)

A minimal proof-of-concept for the **Algorand x402 hackathon**: insurance for paid AI tool
calls. A Consumer pays an AI agent (Producer) for a result over **x402**. When the Producer
returns a hallucinated answer, the Consumer pays a small fee to an Insurance agent, which
verifies the bad response and **refunds the Consumer on-chain**.

It demonstrates **two real x402 payments** + **one real on-chain refund**, all settled in
USDC on Algorand TestNet via the [GoPlausible x402-avm](https://www.npmjs.com/org/x402-avm)
packages and the hosted facilitator at `https://facilitator.goplausible.xyz`.

```
Consumer --x402 $0.01--> Producer   (POST /tool   -> "WRONG: Berlin", bad=true)
Consumer --x402 $0.01--> Insurance  (POST /claim  -> verifies bad -> approves)
Insurance --USDC $0.02--> Consumer  (on-chain refund: tool fee + claim fee)
```

## Actors

| Component | x402 endpoint | Role |
|---|---|---|
| `producer/server.ts` | `POST /tool` | Sells AI tool calls; deterministically hallucinates on the France question for the demo. Stores `{prompt, response, bad}` in memory. |
| `insurance/server.ts` | `POST /claim` | Charges a claim fee; looks up the original call; if it was `bad`, refunds the consumer on-chain. |
| `consumer/agent.ts` | — | Orchestration script: pays for the tool call, detects `"WRONG"`, files + pays for a claim, prints the result. |

## Setup

Requires Node 18+ (tested on Node 24).

```bash
npm install
npm run gen-accounts     # creates 3 TestNet accounts -> .env (+ prints addresses & faucet links)
```

Then fund the printed addresses:

1. **ALGO** for all 3 accounts — TestNet dispenser: https://lora.algokit.io/testnet/fund
   (covers min-balance, USDC opt-in, and fees; ~1 ALGO each).
2. `npm run optin` — opts all 3 accounts into USDC (ASA `10458941`).
3. **USDC** for **CONSUMER** and **INSURANCE** — Circle faucet (select *Algorand Testnet*):
   https://faucet.circle.com (~1 USDC each).
4. `npm run balances` — pre-flight; must print **OK** for all roles.

> Funding is a hard prerequisite — the demo can't settle without TestNet ALGO + USDC.
> `.env` holds real mnemonics and is gitignored.

## Run the demo

```bash
npm run start            # terminal A: boots Producer :4021 + Insurance :4022
npm run demo             # terminal B: runs the consumer
```

Expected output:

```
Calling producer...

Paid x402 fee.  (https://lora.algokit.io/testnet/transaction/...)
Received response:

WRONG: Berlin

Response unsatisfactory.

Submitting insurance claim...

Paid claim fee.  (https://lora.algokit.io/testnet/transaction/...)

Claim approved.
Refund issued. 0.02 USDC  (https://lora.algokit.io/testnet/transaction/...)

Demo complete.
```

Open the printed transaction links on the TestNet explorer to verify the two payments and the
refund on-chain.

## Bonus: the rejected-claim path

The Producer answers correctly (and `bad=false`) for any non-France prompt, or when
`?good=1` is set. With a valid response the Insurance agent returns `{"status":"rejected"}`
and keeps the claim fee — no refund tx. (Edit the prompt in `consumer/agent.ts` to try it.)

## How the x402 plumbing works

- **Servers** gate a route with `paymentMiddleware(routes, server)` from `@x402-avm/express`.
  An unpaid request gets `402 Payment Required` with the accepted terms; the route handler
  only runs after the facilitator verifies + settles the payment.
- **Client** wraps `fetch` with `wrapFetchWithPayment(fetch, client)` from `@x402-avm/fetch`.
  It catches the 402, signs a USDC transfer with the consumer's key, and retries with the
  `X-PAYMENT` header — transparently.
- **Refund** has no x402 primitive (x402 is pay-per-request), so the Insurance agent sends a
  direct USDC ASA transfer back via `algosdk` (`shared/chain.ts:sendUSDC`).

## Files

```
shared/config.ts   network ids, USDC asset id, facilitator url, ports, prices
shared/types.ts    request/response shapes
shared/chain.ts    algosdk helpers: opt-in, sendUSDC (refund), balances
scripts/*          generate-accounts, optin-usdc, check-balances
producer/server.ts POST /tool  (x402)  + GET /_request/:id (internal lookup)
insurance/server.ts POST /claim (x402) -> on-chain refund
consumer/agent.ts  the demo orchestration
```
