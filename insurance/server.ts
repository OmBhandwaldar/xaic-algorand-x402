import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402-avm/express";
import { registerExactAvmScheme } from "@x402-avm/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402-avm/core/server";
import {
  NETWORK,
  USDC_ASA_ID,
  FACILITATOR_URL,
  INSURANCE_PORT,
  PRODUCER_URL,
  CLAIM_PRICE_USD,
  REFUND_MICRO,
  requireEnv,
} from "../shared/config.js";
import { accountFromMnemonic, sendUSDC, explorerTx } from "../shared/chain.js";
import { chat } from "../shared/llm.js";
import type { StoredRequest, ClaimRequest, ClaimResponse } from "../shared/types.js";

const INSURANCE_ADDR = requireEnv("INSURANCE_ADDR");
const insurer = accountFromMnemonic(requireEnv("INSURANCE_MNEMONIC"));

// The pool of premiums the insurer holds to cover approved claims (demo-only ledger).
const producerBalance = { reserve: 100 };

const app = express();
app.use(express.json());

// --- x402 payment gate on POST /claim (the claim fee) ---
const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const server = new x402ResourceServer(facilitator);
registerExactAvmScheme(server);

const routes = {
  "POST /claim": {
    accepts: {
      scheme: "exact",
      network: NETWORK,
      payTo: INSURANCE_ADDR,
      price: CLAIM_PRICE_USD,
      extra: { asset: USDC_ASA_ID },
    },
    description: "AIShield insurance claim",
  },
};
app.use(paymentMiddleware(routes, server));

// --- paid handler: evaluate the claim, refund on-chain if the response was bad ---
app.post("/claim", async (req, res) => {
  const { requestId, reason, refundAddr } = req.body as ClaimRequest;
  console.log(`[insurance] paid /claim ${requestId} reason="${reason}"`);

  // Look up the original Producer record (cross-process, non-paid).
  const lookup = await fetch(`${PRODUCER_URL}/_request/${requestId}`);
  if (!lookup.ok) {
    const out: ClaimResponse = { status: "rejected", reason: "unknown requestId" };
    return res.status(404).json(out);
  }
  const record = (await lookup.json()) as StoredRequest;

  // Insurance independently adjudicates with an LLM (does NOT trust the producer).
  let approve: boolean;
  let verdict: string;
  try {
    verdict = await chat(
      "You are an insurance claim adjudicator for AI answers. Given a question and the AI's answer, decide if the answer is factually wrong / a hallucination (claim VALID) or correct (claim INVALID). Reply with exactly one word — APPROVE or REJECT — then a dash and a brief reason.",
      `Question: ${record.prompt}\nAI answer: ${record.response}`,
      50,
    );
    approve = /approve/i.test(verdict);
  } catch (e) {
    approve = record.bad; // fallback to producer's intent flag
    verdict = "LLM adjudicator unavailable — fell back to producer flag";
  }

  if (!approve) {
    console.log(`[insurance] rejected ${requestId}: ${verdict}`);
    const out: ClaimResponse = { status: "rejected", reason: verdict };
    return res.json(out);
  }

  // Approved: refund the tool fee + return the claim fee on-chain ($1.00 + $0.01 = $1.01).
  const refundUsd = (REFUND_MICRO / 1e6).toFixed(2);
  const refundTxId = await sendUSDC(insurer, refundAddr, REFUND_MICRO);
  producerBalance.reserve -= Number(refundUsd);
  console.log(
    `[insurance] approved ${requestId} -> refund ${refundUsd} USDC ${explorerTx(refundTxId)} ` +
      `(reserve now ${producerBalance.reserve.toFixed(2)})`,
  );

  const out: ClaimResponse = {
    status: "approved",
    refundedAmount: refundUsd,
    refundTxId,
    reason: verdict,
  };
  res.json(out);
});

app.listen(INSURANCE_PORT, () => {
  console.log(`[insurance] listening on http://localhost:${INSURANCE_PORT}`);
  console.log(`[insurance] payTo ${INSURANCE_ADDR}`);
});
