import algosdk from "algosdk";
import { writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");

if (existsSync(envPath)) {
  console.error(
    "Refusing to overwrite existing .env (it may hold funded accounts).\n" +
      "Delete it first if you really want fresh accounts: rm .env",
  );
  process.exit(1);
}

const roles = ["CONSUMER", "PRODUCER", "INSURANCE"] as const;
const accounts: Record<string, { addr: string; mnemonic: string; avmKey: string }> = {};

for (const role of roles) {
  const { addr, sk } = algosdk.generateAccount();
  accounts[role] = {
    addr: addr.toString(),
    mnemonic: algosdk.secretKeyToMnemonic(sk),
    avmKey: Buffer.from(sk).toString("base64"),
  };
}

const env =
  roles
    .map((r) => {
      const a = accounts[r];
      return `${r}_MNEMONIC=${a.mnemonic}\n${r}_ADDR=${a.addr}\n${r}_AVM_KEY=${a.avmKey}`;
    })
    .join("\n\n") +
  `\n\nFACILITATOR_URL=https://facilitator.goplausible.xyz\n` +
  `ALGOD_URL=https://testnet-api.algonode.cloud\n` +
  `PRODUCER_PORT=4021\nINSURANCE_PORT=4022\n`;

writeFileSync(envPath, env);
writeFileSync(
  join(root, "accounts.json"),
  JSON.stringify(
    Object.fromEntries(roles.map((r) => [r, { addr: accounts[r].addr }])),
    null,
    2,
  ),
);

console.log("Generated 3 TestNet accounts -> .env (and accounts.json)\n");
for (const r of roles) console.log(`  ${r.padEnd(9)} ${accounts[r].addr}`);

console.log(`
Next steps:
  1. Fund ALGO (all 3 addresses) at a TestNet dispenser:
       https://lora.algokit.io/testnet/fund  (or https://bank.testnet.algorand.network)
       ~1 ALGO each is plenty (covers min-balance + opt-in + fees).
  2. npm run optin          # opt all 3 into USDC (ASA 10458941)
  3. Fund USDC at the Circle faucet (select "Algorand Testnet"):
       https://faucet.circle.com
       Fund CONSUMER (pays 2 fees) and INSURANCE (pays the refund). ~1 USDC each.
  4. npm run balances       # pre-flight check
  5. npm run start          # in one terminal
  6. npm run demo           # in another
`);
