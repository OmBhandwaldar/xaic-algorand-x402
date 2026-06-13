import algosdk from "algosdk";
import { ALGOD_URL, USDC_ASA_ID } from "./config.js";

export const algod = new algosdk.Algodv2("", ALGOD_URL, "");

export interface Account {
  addr: string;
  sk: Uint8Array;
}

/** Load an account from a 25-word mnemonic. */
export function accountFromMnemonic(mnemonic: string): Account {
  const { addr, sk } = algosdk.mnemonicToSecretKey(mnemonic.trim());
  return { addr: addr.toString(), sk };
}

/** base64 of the 64-byte secret key — the `*_AVM_KEY` value the x402 signer decodes. */
export function avmKeyB64(sk: Uint8Array): string {
  return Buffer.from(sk).toString("base64");
}

/** Opt an account into the USDC ASA (asset transfer of 0 to self). No-op-safe to re-run. */
export async function optInUSDC(account: Account): Promise<string> {
  const sp = await algod.getTransactionParams().do();
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: account.addr,
    receiver: account.addr,
    amount: 0,
    assetIndex: Number(USDC_ASA_ID),
    suggestedParams: sp,
  });
  const signed = txn.signTxn(account.sk);
  const { txid } = await algod.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algod, txid, 6);
  return txid;
}

/** Send USDC (micro-units) from one account to an address. Used for the on-chain refund. */
export async function sendUSDC(
  from: Account,
  toAddr: string,
  amountMicro: number,
): Promise<string> {
  const sp = await algod.getTransactionParams().do();
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: from.addr,
    receiver: toAddr,
    amount: amountMicro,
    assetIndex: Number(USDC_ASA_ID),
    suggestedParams: sp,
  });
  const signed = txn.signTxn(from.sk);
  const { txid } = await algod.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algod, txid, 6);
  return txid;
}

/** Send ALGO (micro-units) between accounts. Used to seed relay accounts for fees/opt-in. */
export async function sendALGO(
  from: Account,
  toAddr: string,
  amountMicro: number,
): Promise<string> {
  const sp = await algod.getTransactionParams().do();
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: from.addr,
    receiver: toAddr,
    amount: amountMicro,
    suggestedParams: sp,
  });
  const signed = txn.signTxn(from.sk);
  const { txid } = await algod.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algod, txid, 6);
  return txid;
}

/** USDC balance in micro-units (raw), for forwarding an exact amount. */
export async function getUsdcMicro(addr: string): Promise<number> {
  const info = await algod.accountInformation(addr).do();
  const holding = (info.assets ?? []).find(
    (a: any) => Number(a.assetId ?? a["asset-id"]) === Number(USDC_ASA_ID),
  );
  return holding ? Number(holding.amount) : 0;
}

export interface Balances {
  algo: number; // in ALGO
  usdc: number; // in USDC
  optedIn: boolean;
}

/** Read ALGO + USDC balances and USDC opt-in status for an address. */
export async function getBalances(addr: string): Promise<Balances> {
  const info = await algod.accountInformation(addr).do();
  const algo = Number(info.amount) / 1e6;
  const holding = (info.assets ?? []).find(
    (a: any) => Number(a.assetId ?? a["asset-id"]) === Number(USDC_ASA_ID),
  );
  return {
    algo,
    usdc: holding ? Number(holding.amount) / 1e6 : 0,
    optedIn: Boolean(holding),
  };
}

/** TestNet explorer link for a transaction. */
export function explorerTx(txId: string): string {
  return `https://lora.algokit.io/testnet/transaction/${txId}`;
}
