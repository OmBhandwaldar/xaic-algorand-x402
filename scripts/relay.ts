import algosdk from "algosdk";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  accountFromMnemonic,
  optInUSDC,
  sendALGO,
  sendUSDC,
  getBalances,
  getUsdcMicro,
  explorerTx,
} from "../shared/chain.js";
import { CONSUMER_ADDR, INSURANCE_ADDR, requireEnv } from "../shared/config.js";

// Relay accounts: you fund USDC on these (fresh => not rate-limited), then we forward
// it to the real Consumer / Insurance accounts.
//   RELAY_CONSUMER  -> CONSUMER
//   RELAY_INSURANCE -> INSURANCE

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const relayPath = join(root, "relay.json");
const SEED_ALGO_MICRO = 500_000; // 0.5 ALGO to cover min-balance + opt-in + fees

type RelayFile = Record<"RELAY_CONSUMER" | "RELAY_INSURANCE", { addr: string; mnemonic: string }>;
const targets = { RELAY_CONSUMER: CONSUMER_ADDR, RELAY_INSURANCE: INSURANCE_ADDR } as const;

function loadOrCreate(): RelayFile {
  if (existsSync(relayPath)) return JSON.parse(readFileSync(relayPath, "utf8"));
  const make = () => {
    const { addr, sk } = algosdk.generateAccount();
    return { addr: addr.toString(), mnemonic: algosdk.secretKeyToMnemonic(sk) };
  };
  const file: RelayFile = { RELAY_CONSUMER: make(), RELAY_INSURANCE: make() };
  writeFileSync(relayPath, JSON.stringify(file, null, 2));
  console.log("Created relay.json with 2 fresh accounts.");
  return file;
}

async function setup() {
  const relay = loadOrCreate();
  const funder = accountFromMnemonic(requireEnv("PRODUCER_MNEMONIC")); // has spare ALGO

  for (const role of ["RELAY_CONSUMER", "RELAY_INSURANCE"] as const) {
    const acct = accountFromMnemonic(relay[role].mnemonic);
    const bal = await getBalances(acct.addr);

    if (bal.algo < 0.3) {
      process.stdout.write(`${role}: seeding 0.5 ALGO... `);
      const tx = await sendALGO(funder, acct.addr, SEED_ALGO_MICRO);
      console.log(`ok (${tx})`);
    } else {
      console.log(`${role}: has ${bal.algo.toFixed(3)} ALGO`);
    }

    if (!bal.optedIn) {
      process.stdout.write(`${role}: opting into USDC... `);
      const tx = await optInUSDC(acct);
      console.log(`ok (${tx})`);
    } else {
      console.log(`${role}: already opted in`);
    }
  }

  console.log(`
Fund USDC on these two relay accounts at https://faucet.circle.com (Algorand Testnet):

  RELAY_CONSUMER   ${relay.RELAY_CONSUMER.addr}   (-> Consumer)
  RELAY_INSURANCE  ${relay.RELAY_INSURANCE.addr}   (-> Insurance)

Then run:  npm run relay send
`);
}

async function send() {
  if (!existsSync(relayPath)) {
    console.error("No relay.json. Run `npm run relay setup` first.");
    process.exit(1);
  }
  const relay: RelayFile = JSON.parse(readFileSync(relayPath, "utf8"));

  for (const role of ["RELAY_CONSUMER", "RELAY_INSURANCE"] as const) {
    const acct = accountFromMnemonic(relay[role].mnemonic);
    const micro = await getUsdcMicro(acct.addr);
    const target = targets[role];
    if (micro <= 0) {
      console.log(`${role}: 0 USDC — fund it at the Circle faucet first, then re-run.`);
      continue;
    }
    process.stdout.write(`${role}: forwarding ${(micro / 1e6).toFixed(2)} USDC -> ${target.slice(0, 8)}… `);
    const tx = await sendUSDC(acct, target, micro);
    console.log(`ok\n  ${explorerTx(tx)}`);
  }
  console.log("\nDone. Run `npm run balances` to confirm Consumer + Insurance hold USDC.");
}

const cmd = process.argv[2] || "setup";
(cmd === "send" ? send() : setup()).catch((err) => {
  console.error("relay failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
