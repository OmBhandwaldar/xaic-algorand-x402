// Shared request/response shapes for the AIShield demo.

/** What the Producer stores in memory for every paid tool call. */
export interface StoredRequest {
  prompt: string;
  response: string;
  bad: boolean; // true = intentionally hallucinated (insurable)
}

/** Producer's /tool response. */
export interface ToolResponse {
  requestId: string;
  result: string;
}

/** Consumer -> Insurance /claim body. */
export interface ClaimRequest {
  requestId: string;
  reason: string;
  refundAddr: string; // where the on-chain refund should be sent
}

/** Insurance /claim response. */
export interface ClaimResponse {
  status: "approved" | "rejected";
  refundedAmount?: string; // e.g. "0.02" USDC
  refundTxId?: string; // on-chain refund transaction id
  reason?: string;
}
