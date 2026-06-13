import { accountFromMnemonic, getBalances } from "../shared/chain.js";
import { requireEnv } from "../shared/config.js";

// Pre-flight: who needs what before the demo can run.
const needs = {
  CONSUMER: { usdc: true }, // pays producer fee + claim fee
  PRODUCER: { usdc: false }, // only receives
  INSURANCE: { usdc: true }, // pays the on-chain refund
} as const;

let ready = true;
console.log("role       ALGO     USDC    opted-in  status");
console.log("--------------------------------------------------");

for (const role of Object.keys(needs) as (keyof typeof needs)[]) {
  const acct = accountFromMnemonic(requireEnv(`${role}_MNEMONIC`));
  const b = await getBalances(acct.addr);

  const problems: string[] = [];
  if (b.algo < 0.2) problems.push("need ALGO");
  if (!b.optedIn) problems.push("need USDC opt-in");
  if (needs[role].usdc && b.usdc <= 0) problems.push("need USDC");
  if (problems.length) ready = false;

  console.log(
    `${role.padEnd(10)} ${b.algo.toFixed(3).padStart(6)} ${b.usdc
      .toFixed(2)
      .padStart(7)}   ${(b.optedIn ? "yes" : "no").padEnd(7)}  ${
      problems.length ? "X " + problems.join(", ") : "OK"
    }`,
  );
}

console.log("--------------------------------------------------");
console.log(ready ? "All set - run `npm run start` then `npm run demo`." : "Not ready yet (see above).");
process.exit(ready ? 0 : 1);
