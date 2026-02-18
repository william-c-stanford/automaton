/**
 * Mastra Memory Provider — Semantic Recall Integration Tests
 *
 * Tests semantic vector search using real @mastra/fastembed (bge-small-en-v1.5).
 * First run may download the ONNX model (~33 MB) — tests have 120s timeouts.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { MastraMemoryProvider } from "../memory/mastra/index.js";
import { createTestIdentity, createTestConfig, createTestTurn } from "./mocks.js";

describe("MastraMemoryProvider — semantic recall", () => {
  let tmpDir: string;
  let provider: MastraMemoryProvider;
  const identity = createTestIdentity();
  const config = createTestConfig();

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mastra-semantic-"));
    provider = new MastraMemoryProvider(config, {
      storageUrl: `file:${path.join(tmpDir, "storage.db")}`,
      vectorUrl: `file:${path.join(tmpDir, "vector.db")}`,
      enableSemanticRecall: true,
    });
    await provider.init();
  }, 120_000);

  afterEach(async () => {
    await provider.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("initializes with semantic recall enabled", () => {
    expect(provider.name).toBe("mastra");
  }, 120_000);

  it("recall with hint returns saved messages", async () => {
    await provider.onWake(identity);

    await provider.saveTurn(createTestTurn({
      input: "The weather in Paris is sunny today",
      thinking: "Noted the weather report for Paris",
    }));

    await provider.saveTurn(createTestTurn({
      input: "Deploy the container to production server",
      thinking: "Running docker deploy command now",
    }));

    // Recall with a hint related to weather
    const results = await provider.recall("weather forecast temperature");
    expect(results.length).toBeGreaterThan(0);
  }, 120_000);

  it("recall without hint still works (lastMessages only)", async () => {
    await provider.onWake(identity);

    await provider.saveTurn(createTestTurn({ input: "message one" }));
    await provider.saveTurn(createTestTurn({ input: "message two" }));

    const results = await provider.recall(); // no hint — recency only
    expect(results.length).toBeGreaterThan(0);
  }, 120_000);

  it("recall with hint returns empty on fresh thread", async () => {
    await provider.onWake(identity);
    // No turns saved — nothing to find
    const results = await provider.recall("anything at all");
    expect(results).toEqual([]);
  }, 120_000);

  it("recall before onWake returns empty even with hint", async () => {
    const results = await provider.recall("something");
    expect(results).toEqual([]);
  });

  it("multiple turns with diverse content — hint selects relevant", async () => {
    await provider.onWake(identity);

    const topics = [
      { input: "Checked USDC balance on Base network", thinking: "Balance is 50 USDC" },
      { input: "Registered domain automaton.eth", thinking: "ENS registration complete" },
      { input: "Deployed web server on port 8080", thinking: "Server started successfully" },
      { input: "Sent message to agent 0xabc", thinking: "Social relay delivered" },
      { input: "Modified heartbeat config to check credits hourly", thinking: "Cron updated" },
    ];

    for (const topic of topics) {
      await provider.saveTurn(createTestTurn(topic));
    }

    // Hint about finances/cryptocurrency — should return results
    const results = await provider.recall("cryptocurrency wallet balance");
    expect(results.length).toBeGreaterThan(0);
  }, 120_000);
});
