import algosdk from "algosdk";
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402-avm/fetch";
import { registerExactAvmScheme } from "@x402-avm/avm/exact/client";
import {
  ALGOD_URL,
  PRODUCER_URL,
  INSURANCE_URL,
  PRODUCER_ADDR,
  INSURANCE_ADDR,
  TOOL_FEE_MICRO,
  CLAIM_FEE_MICRO,
  requireEnv,
} from "../shared/config.js";
import { explorerTx, getBalances } from "../shared/chain.js";
import { chat } from "../shared/llm.js";
import type { ToolResponse, ClaimResponse, ClaimRequest } from "../shared/types.js";

/** A single step in the demo, streamed to any UI (CLI or browser). */
export interface StageEvent {
  stage:
    | "start"
    | "tool:request"
    | "tool:pay"
    | "tool:result"
    | "judge"
    | "claim:request"
    | "claim:pay"
    | "claim:verify"
    | "refund"
    | "complete"
    | "error";
  status: "active" | "done" | "info" | "error";
  title: string;
  detail?: string;
  txId?: string;
  txUrl?: string;
  data?: Record<string, unknown>;
}

export type Emit = (e: StageEvent) => void;

export interface DemoOptions {
  prompt?: string;
  forceGood?: boolean; // hit producer with ?good=1 to demo the rejected path
}

function settleTx(res: Response): string | undefined {
  const header = res.headers.get("PAYMENT-RESPONSE") || res.headers.get("X-PAYMENT-RESPONSE");
  if (!header) return undefined;
  try {
    // SettleResponse carries the on-chain tx id in `transaction`.
    const decoded = decodePaymentResponseHeader(header) as any;
    return decoded?.transaction || decoded?.txId;
  } catch {
    return undefined;
  }
}

/**
 * Runs the full consumer journey, emitting a StageEvent at every step.
 * Real x402 payments + a real on-chain refund settle on Algorand TestNet.
 */
export async function runDemo(emit: Emit, opts: DemoOptions = {}): Promise<void> {
  const prompt = opts.prompt ?? "What is the capital of France?";

  // --- consumer signer from private key ---
  const secretKey = Buffer.from(requireEnv("CONSUMER_AVM_KEY"), "base64");
  const address = algosdk.encodeAddress(secretKey.slice(32));
  const signer = {
    address,
    signTransactions: async (txns: Uint8Array[], indexesToSign?: number[]) =>
      txns.map((txn, i) => {
        if (indexesToSign && !indexesToSign.includes(i)) return null;
        const decoded = algosdk.decodeUnsignedTransaction(txn);
        return algosdk.signTransaction(decoded, secretKey).blob;
      }),
  };

  const client = new x402Client();
  registerExactAvmScheme(client, { signer, algodConfig: { algodUrl: ALGOD_URL } });

  // Lifecycle hooks expose the otherwise-hidden 402 -> sign step to the UI.
  client.onBeforePaymentCreation(async (ctx: any) => {
    const req = ctx.selectedRequirements;
    const usdc = (Number(req.amount) / 1e6).toFixed(2);
    const toProducer = req.payTo === PRODUCER_ADDR;
    emit({
      stage: toProducer ? "tool:pay" : "claim:pay",
      status: "active",
      title: toProducer
        ? "402 Payment Required — paying Producer via x402"
        : "402 Payment Required — paying Insurance via x402",
      detail: `Signing ${usdc} USDC transfer to ${req.payTo.slice(0, 8)}… on Algorand TestNet`,
      data: { amount: usdc, payTo: req.payTo },
    });
  });

  const consumerStartUsdc = (await getBalances(address)).usdc;
  emit({
    stage: "start",
    status: "info",
    title: "Consumer agent ready",
    detail: `Wallet ${address.slice(0, 8)}… — balance ${consumerStartUsdc.toFixed(2)} USDC`,
    data: { address, usdc: consumerStartUsdc },
  });

  const fetchPay = wrapFetchWithPayment(fetch, client);

  // --- Step 1: call the producer's paid tool ---
  emit({
    stage: "tool:request",
    status: "active",
    title: "Agent → Producer: POST /tool (HTTP)",
    detail: `Prompt: "${prompt}"`,
  });
  const toolRes = await fetchPay(`${PRODUCER_URL}/tool${opts.forceGood ? "?good=1" : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const tool = (await toolRes.json()) as ToolResponse;
  const payTx = settleTx(toolRes);
  emit({
    stage: "tool:request",
    status: "done",
    title: "Agent → Producer: POST /tool (HTTP)",
    detail: `Prompt: "${prompt}"`,
  });
  emit({
    stage: "tool:pay",
    status: "done",
    title: "x402 payment settled (Consumer → Producer)",
    detail: `${(TOOL_FEE_MICRO / 1e6).toFixed(2)} USDC paid on-chain`,
    txId: payTx,
    txUrl: payTx ? explorerTx(payTx) : undefined,
  });
  emit({
    stage: "tool:result",
    status: "done",
    title: "Tool response received",
    detail: tool.result,
    data: { requestId: tool.requestId, result: tool.result },
  });

  // --- Step 2: the consumer agent judges the answer with an LLM ---
  let unsatisfactory: boolean;
  let judgeReason: string;
  try {
    const verdict = await chat(
      "You are a strict QA judge. Given a question and an assistant's answer, decide if the answer is factually correct and satisfactory. Reply with exactly one word — SATISFACTORY or UNSATISFACTORY — then a dash and a brief reason.",
      `Question: ${prompt}\nAnswer: ${tool.result}`,
      50,
    );
    unsatisfactory = /unsatisf/i.test(verdict);
    judgeReason = verdict;
  } catch (e) {
    unsatisfactory = tool.result.toLowerCase().includes("wrong");
    judgeReason = `LLM judge unavailable — fell back to keyword check`;
  }
  emit({
    stage: "judge",
    status: "done",
    title: unsatisfactory ? "Response judged UNSATISFACTORY" : "Response judged SATISFACTORY",
    detail: judgeReason,
  });
  if (!unsatisfactory) {
    emit({ stage: "complete", status: "done", title: "Demo complete", detail: "No claim filed" });
    return;
  }

  // --- Step 3: file + pay for an insurance claim ---
  emit({
    stage: "claim:request",
    status: "active",
    title: "Agent → Insurance: POST /claim (HTTP)",
    detail: `requestId ${tool.requestId.slice(0, 8)}… · reason: hallucinated output`,
  });
  const claimBody: ClaimRequest = {
    requestId: tool.requestId,
    reason: "hallucinated output",
    refundAddr: address,
  };
  const claimRes = await fetchPay(`${INSURANCE_URL}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(claimBody),
  });
  const claim = (await claimRes.json()) as ClaimResponse;
  const claimTx = settleTx(claimRes);
  emit({
    stage: "claim:request",
    status: "done",
    title: "Agent → Insurance: POST /claim (HTTP)",
    detail: `requestId ${tool.requestId.slice(0, 8)}… · reason: hallucinated output`,
  });
  emit({
    stage: "claim:pay",
    status: "done",
    title: "x402 payment settled (Consumer → Insurance)",
    detail: `${(CLAIM_FEE_MICRO / 1e6).toFixed(2)} USDC claim fee paid on-chain`,
    txId: claimTx,
    txUrl: claimTx ? explorerTx(claimTx) : undefined,
  });

  emit({
    stage: "claim:verify",
    status: "done",
    title:
      claim.status === "approved"
        ? "Insurance adjudicated — claim APPROVED"
        : "Insurance adjudicated — claim REJECTED",
    detail: claim.reason ?? (claim.status === "approved" ? "hallucination confirmed" : "response was valid"),
    data: { status: claim.status },
  });

  if (claim.status === "approved") {
    emit({
      stage: "refund",
      status: "done",
      title: "Refund issued on-chain (Insurance → Consumer)",
      detail: `${claim.refundedAmount} USDC refunded`,
      txId: claim.refundTxId,
      txUrl: claim.refundTxId ? explorerTx(claim.refundTxId) : undefined,
    });
  }

  const consumerEndUsdc = (await getBalances(address)).usdc;
  emit({
    stage: "complete",
    status: "done",
    title: "Demo complete",
    detail:
      `Consumer USDC: ${consumerStartUsdc.toFixed(2)} → ${consumerEndUsdc.toFixed(2)} ` +
      `(paid ${((TOOL_FEE_MICRO + CLAIM_FEE_MICRO) / 1e6).toFixed(2)} in fees, ` +
      `insurance refunded ${((TOOL_FEE_MICRO + CLAIM_FEE_MICRO) / 1e6).toFixed(2)})`,
    data: { startUsdc: consumerStartUsdc, endUsdc: consumerEndUsdc },
  });
}
