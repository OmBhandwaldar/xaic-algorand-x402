import { accountFromMnemonic, optInUSDC, getBalances } from "../shared/chain.js";
import { requireEnv } from "../shared/config.js";

const roles = ["CONSUMER", "PRODUCER", "INSURANCE"] as const;

for (const role of roles) {
  const acct = accountFromMnemonic(requireEnv(`${role}_MNEMONIC`));
  const bal = await getBalances(acct.addr);
  if (bal.optedIn) {
    console.log(`${role.padEnd(9)} already opted in (USDC ${bal.usdc})`);
    continue;
  }
  if (bal.algo === 0) {
    console.log(`${role.padEnd(9)} SKIP - 0 ALGO, fund it first (${acct.addr})`);
    continue;
  }
  process.stdout.write(`${role.padEnd(9)} opting in... `);
  const txid = await optInUSDC(acct);
  console.log(`done (${txid})`);
}
console.log("\nOpt-in complete. Now fund USDC (consumer + insurance) and run `npm run balances`.");
