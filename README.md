<div align="center">

# ▲ XAIC

**Insurance for the agentic economy.**
On-chain coverage for paid AI tool calls — settled in USDC over x402 on Algorand.

### 🔗 [Live demo → xaic-production.up.railway.app](https://xaic-production.up.railway.app)

<sub>Real x402 payments + on-chain refunds on Algorand TestNet. The UI is only a visualizer —
in production XAIC integrates directly with agents at the protocol layer.</sub>

</div>

---

## What XAIC does

AI agents increasingly **pay other agents** for tool calls (data, inference, APIs) using x402
micropayments. But a paid call can still return a **wrong, hallucinated, or unusable** result —
and today the buyer just eats that loss.

XAIC wraps any paid tool call in **insurance**. The consumer pays the normal tool price plus a
**tiny premium**. If the result is bad, an independent adjudicator agent verifies it and the
consumer is **refunded on-chain** — automatically, in seconds, with no human in the loop.

> Reliable results for the buyer. A new revenue stream for the seller. A protocol fee for the
> platform. All at near-zero extra cost to anyone.

---

## Business model

### The cast

| Party | Puts in | Gets out |
|---|---|---|
| 🧑‍💻 **Consumer** (buyer agent) | tool price + a nominal premium (~1% of tool cost) | reliable results; full refund if the output is bad |
| 🤖 **Producer** (seller agent) | a fixed **stake** (bond) to onboard | tool revenue **+ performance rewards** from the insurance fund |
| ▲ **XAIC** (platform) | adjudication + custody of funds | a periodic protocol cut |

### Money flow per request

```
                 tool price ($1.00)
   Consumer  ───────────────────────────────►  Producer        (normal tool revenue)
        │
        │      premium ($0.01, ~1%)
        └───────────────────────────────────►  Insurance Fund  (per-producer pool)
                                                     │
   if result is bad ─► Consumer files a claim        │  settles approved claims
   (+ small refundable anti-spam deposit) ◄──────────┘
```

The premium is bundled into every paid call. It is **tiny for the buyer** but, at scale,
**compounds into a real pool** for each producer.

### Why the fund grows (the math)

```
   1 producer × 10,000 calls/day × $0.01 premium  ≈  $100 / day  →  ~$3,000 / month

   A reliable tool fails rarely, so claims consume only a small slice of that pool.
   Result: the producer's insurance fund grows continuously.
```

### How a claim gets paid — the waterfall

```
   Approved claim
        │
        ▼
   ┌─────────────────────────┐   drained first
   │ 1. Collected premiums   │ ───────────────►  covers virtually all real-world claims
   └─────────────────────────┘
        │ only if exhausted (≈ tool is exceptionally bad)
        ▼
   ┌─────────────────────────┐
   │ 2. Producer's stake     │ ───────────────►  last-resort backstop
   └─────────────────────────┘
```

Hitting the stake means the tool is performing terribly — which is exactly when it *should*
pay. In practice the premium pool absorbs claims and is rarely exhausted.

### Periodic distribution of the pool

Each settlement period, a producer's accumulated pool (e.g. ~$100/day) is split:

| Slice | Share | Purpose |
|---|---|---|
| 🛡️ **Claims settled** | 10–20% | refunds paid to consumers for bad results |
| ▲ **Platform cut** | 20–30% | XAIC's protocol revenue |
| 🏆 **Producer reward** | 20–30% | paid to the producer for **reliable performance** |
| 🏦 **Reserve** | remainder | rolling buffer; producer can **cash it out + reclaim stake on offboarding** |

### The flywheel — why everyone opts in

```
   Consumer pays ~1% more  ─►  bigger insurance pool  ─►  bigger producer rewards
        ▲                                                        │
        │                                                        ▼
   trusts paid calls more  ◄─  more reliable producers join  ◄─  producers earn for being good
```

- **Consumers** get insured, reliable results for a near-invisible fee.
- **Producers** earn **extra income for being reliable**, on top of normal tool revenue, at
  **zero additional cost to their users** — a direct incentive to onboard.
- **XAIC** earns a sustainable cut and holds a growing book of per-producer reserves.

### Anti-spam on claims

To stop consumers from spamming free claims, filing a claim requires a **small refundable
deposit**. If the claim is **approved**, the deposit is **returned along with the refund**. If
**rejected**, it is forfeited — so honest claims are free and frivolous ones cost the spammer.

### Market

Any agent that **pays for tools** is a buyer; any agent that **sells tools** is a seller.
XAIC is a thin insurance layer that drops onto the **entire agentic economy** — model APIs,
data feeds, retrieval, compute, and agent-to-agent services.

---

## This repository — a working proof of concept

A live, end-to-end slice of XAIC on **Algorand TestNet**: **two real x402 payments** + **one
real on-chain refund**, with three real LLM agents. Built on the
[GoPlausible x402-avm](https://www.npmjs.com/org/x402-avm) packages and the hosted facilitator
at `https://facilitator.goplausible.xyz`.

```
Consumer ──x402 $1.00──► Producer    POST /tool   → (LLM answer, sometimes wrong)
Consumer ──x402 $0.01──► Insurance   POST /claim  → adjudicates, and if bad…
Insurance ──USDC $1.01─► Consumer    on-chain refund (tool fee + claim fee)
```

> Demo simplification: here the $0.01 is charged at claim time and the refund returns it. In
> the production model above it is a per-call **premium** that funds the pool, and the claim
> carries a separate refundable anti-spam deposit.

### The three agents (real LLMs via Groq)

| Component | x402 endpoint | Role |
|---|---|---|
| `producer/server.ts` | `POST /tool` | Answers the prompt with an LLM. For the demo it's told to answer **wrong** (honest when `?good=1`). Stores `{prompt, response}` in memory. |
| `insurance/server.ts` | `POST /claim` | Charges a claim fee, then **independently** adjudicates the answer with an LLM; if it's a hallucination, refunds on-chain. |
| `consumer/{agent,flow}.ts` | — | Pays for the tool call, uses an LLM to **judge** the answer, and files + pays for a claim if unsatisfied. |

The web UI (`web/`) streams every stage live over SSE.

## Setup

Requires Node 18+ (tested on Node 24).

```bash
npm install
npm run gen-accounts     # creates 3 TestNet accounts -> .env (+ prints addresses & faucet links)
```

Fund the printed addresses, then:

1. **ALGO** for all 3 accounts — https://lora.algokit.io/testnet/fund (~1 ALGO each).
2. `npm run optin` — opts all 3 into USDC (ASA `10458941`).
3. **USDC** for **CONSUMER** + **INSURANCE** — https://faucet.circle.com (Algorand Testnet).
4. `npm run balances` — pre-flight; must print **OK** for all roles.
5. Add `GROQ_API_KEY=...` to `.env` (the agents call Groq's OpenAI-compatible API).

> `.env` holds real mnemonics + the Groq key and is gitignored.

## Run

```bash
npm run start    # boots Producer :4021 + Insurance :4022 + Web UI :4023
npm run demo     # CLI run (or open http://localhost:4023 and click Run demo)
```

Each run prints/links the two x402 payments and the on-chain refund on the TestNet explorer.

## How the x402 plumbing works

- **Servers** gate a route with `paymentMiddleware(routes, server)` from `@x402-avm/express`.
  An unpaid request gets `402 Payment Required`; the handler runs only after the facilitator
  verifies + settles the payment on-chain.
- **Client** wraps `fetch` with `wrapFetchWithPayment(fetch, client)` from `@x402-avm/fetch` —
  it catches the 402, signs a USDC transfer, and retries with the `X-PAYMENT` header.
- **Refund** has no x402 primitive (x402 is pay-per-request), so the Insurance agent sends a
  direct USDC ASA transfer back via `algosdk` (`shared/chain.ts:sendUSDC`).

## Files

```
shared/config.ts    network ids, USDC asset id, facilitator url, ports, prices
shared/chain.ts     algosdk helpers: opt-in, sendUSDC (refund/relay), balances
shared/llm.ts       minimal Groq (OpenAI-compatible) client used by all agents
producer/server.ts  POST /tool  (x402)  + GET /_request/:id (internal lookup)
insurance/server.ts POST /claim (x402) -> LLM adjudication -> on-chain refund
consumer/flow.ts    the agent journey (pay → judge → claim), streamed as stage events
web/                SSE orchestrator + Vercel-style live UI
scripts/*           generate-accounts, optin-usdc, check-balances, relay (USDC top-ups)
```
