import dotenv from "dotenv";
import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from "@x402-avm/avm";

dotenv.config();

// --- x402 / Algorand infra ---
// CAIP-2 id; x402 route types require the `${string}:${string}` literal shape.
export const NETWORK = ALGORAND_TESTNET_CAIP2 as `${string}:${string}`;
export const USDC_ASA_ID = USDC_TESTNET_ASA_ID;
export const FACILITATOR_URL =
  process.env.FACILITATOR_URL || "https://facilitator.goplausible.xyz";
export const ALGOD_URL =
  process.env.ALGOD_URL || "https://testnet-api.algonode.cloud";

// --- ports ---
export const PRODUCER_PORT = Number(process.env.PRODUCER_PORT || 4021);
export const INSURANCE_PORT = Number(process.env.INSURANCE_PORT || 4022);
export const PRODUCER_URL = `http://localhost:${PRODUCER_PORT}`;
export const INSURANCE_URL = `http://localhost:${INSURANCE_PORT}`;

// --- pricing (USDC has 6 decimals) ---
export const TOOL_PRICE_USD = "$1.00"; // Producer tool-call price
export const TOOL_FEE_MICRO = 1_000_000; // $1.00 = 1,000,000 micro-USDC
export const CLAIM_PRICE_USD = "$0.01"; // Insurance claim fee
export const CLAIM_FEE_MICRO = 10_000; // $0.01 = 10,000 micro-USDC
// On an approved claim, refund the tool fee + the claim fee so the consumer is made whole.
export const REFUND_MICRO = TOOL_FEE_MICRO + CLAIM_FEE_MICRO; // $1.01

// --- LLM (Groq, OpenAI-compatible) ---
export const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
export const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

// --- accounts (populated by `npm run gen-accounts`) ---
export const CONSUMER_ADDR = process.env.CONSUMER_ADDR || "";
export const PRODUCER_ADDR = process.env.PRODUCER_ADDR || "";
export const INSURANCE_ADDR = process.env.INSURANCE_ADDR || "";

/** Throw a clear error if a required env value is missing. */
export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing ${name} in .env. Run \`npm run gen-accounts\` first (and fund the accounts).`,
    );
  }
  return v;
}
