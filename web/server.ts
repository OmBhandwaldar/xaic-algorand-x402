import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runDemo, type StageEvent } from "../consumer/flow.js";
import { PRODUCER_URL, INSURANCE_URL } from "../shared/config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Railway (and most hosts) inject PORT for the public service.
const WEB_PORT = Number(process.env.PORT || process.env.WEB_PORT || 4023);

const app = express();
app.use(express.static(join(__dirname, "public")));

let running = false;

// Server-Sent Events: streams every StageEvent of one demo run to the browser.
app.get("/api/run", async (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  const send = (e: StageEvent) => res.write(`data: ${JSON.stringify(e)}\n\n`);

  if (running) {
    send({ stage: "error", status: "error", title: "A demo run is already in progress" });
    return res.end();
  }
  running = true;

  const forceGood = req.query.good === "1";
  const prompt = typeof req.query.prompt === "string" && req.query.prompt.trim()
    ? req.query.prompt.trim()
    : undefined;
  try {
    await runDemo(send, { forceGood, prompt });
  } catch (err) {
    send({
      stage: "error",
      status: "error",
      title: "Demo failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  } finally {
    running = false;
    res.write("event: end\ndata: {}\n\n");
    res.end();
  }
});

app.get("/api/info", (_req, res) => {
  res.json({ producer: PRODUCER_URL, insurance: INSURANCE_URL });
});

app.listen(WEB_PORT, () => {
  console.log(`[web] AIShield demo UI on http://localhost:${WEB_PORT}`);
});
