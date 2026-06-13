import { runDemo, type StageEvent } from "./flow.js";

// CLI: print each stage as it happens.
function log(e: StageEvent) {
  if (e.stage === "start" || e.status === "info") {
    console.log(`\n• ${e.title}${e.detail ? `\n  ${e.detail}` : ""}`);
    return;
  }
  const mark = e.status === "active" ? "→" : e.status === "error" ? "✗" : "✓";
  console.log(`\n${mark} ${e.title}`);
  if (e.detail) console.log(`  ${e.detail}`);
  if (e.txUrl) console.log(`  ${e.txUrl}`);
}

runDemo(log)
  .then(() => console.log("\nDone."))
  .catch((err) => {
    console.error("\nDemo failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
