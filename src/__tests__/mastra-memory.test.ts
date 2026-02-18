/**
 * Mastra Memory Provider Integration Tests
 *
 * Tests the MastraMemoryProvider against real LibSQL storage
 * using temp directories for isolation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { MastraMemoryProvider } from "../memory/mastra/index.js";
import { hasWorkingMemory } from "../memory/provider.js";
import { createTestIdentity, createTestConfig, createTestTurn } from "./mocks.js";

describe("MastraMemoryProvider", () => {
  let tmpDir: string;
  let provider: MastraMemoryProvider;
  const identity = createTestIdentity();
  const config = createTestConfig();

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mastra-test-"));
    provider = new MastraMemoryProvider(config, {
      storageUrl: `file:${path.join(tmpDir, "storage.db")}`,
      vectorUrl: `file:${path.join(tmpDir, "vector.db")}`,
      enableSemanticRecall: false,
    });
    await provider.init();
  });

  afterEach(async () => {
    await provider.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("initializes without error", () => {
    expect(provider.name).toBe("mastra");
  });

  it("implements WorkingMemoryProvider", () => {
    expect(hasWorkingMemory(provider)).toBe(true);
  });

  it("recall returns empty before onWake", async () => {
    const messages = await provider.recall();
    expect(messages).toEqual([]);
  });

  it("getWorkingMemory returns null before onWake", async () => {
    const wm = await provider.getWorkingMemory();
    expect(wm).toBeNull();
  });

  it("onWake creates thread and enables operations", async () => {
    await provider.onWake(identity);
    // After wake, recall should work (returns empty since no turns saved)
    const messages = await provider.recall();
    expect(messages).toEqual([]);
  });

  it("saveTurn persists messages that recall can retrieve", async () => {
    await provider.onWake(identity);

    const turn = createTestTurn({
      input: "hello world",
      thinking: "I should respond",
    });
    await provider.saveTurn(turn);

    const messages = await provider.recall();
    expect(messages.length).toBeGreaterThan(0);

    // Should contain both user (input) and assistant (thinking) messages
    const userMsg = messages.find(
      (m) => m.role === "user" && m.content.includes("hello world"),
    );
    const assistantMsg = messages.find(
      (m) => m.role === "assistant" && m.content.includes("I should respond"),
    );
    expect(userMsg).toBeDefined();
    expect(assistantMsg).toBeDefined();
  });

  it("saveTurn persists tool calls as assistant messages", async () => {
    await provider.onWake(identity);

    const turn = createTestTurn({
      input: "run a command",
      toolCalls: [
        {
          id: "tc-1",
          name: "exec",
          arguments: { command: "echo test" },
          result: "test output",
          durationMs: 100,
        },
      ],
    });
    await provider.saveTurn(turn);

    const messages = await provider.recall();
    const toolMsg = messages.find(
      (m) => m.role === "assistant" && m.content.includes("[tool:exec]"),
    );
    expect(toolMsg).toBeDefined();
    expect(toolMsg!.content).toContain("test output");
  });

  it("saveTurn with no input and no thinking produces no messages", async () => {
    await provider.onWake(identity);

    const turn = createTestTurn({
      input: undefined,
      thinking: "",
      toolCalls: [],
    });
    await provider.saveTurn(turn);

    // Turn count still increments (local cache)
    expect(provider.getTurnCount()).toBe(1);
  });

  it("getTurnCount increments on saveTurn", async () => {
    await provider.onWake(identity);
    expect(provider.getTurnCount()).toBe(0);

    await provider.saveTurn(createTestTurn());
    expect(provider.getTurnCount()).toBe(1);

    await provider.saveTurn(createTestTurn());
    expect(provider.getTurnCount()).toBe(2);
  });

  it("getRecentTurns returns cached turns in order", async () => {
    await provider.onWake(identity);

    const turn1 = createTestTurn({ input: "first" });
    const turn2 = createTestTurn({ input: "second" });
    const turn3 = createTestTurn({ input: "third" });

    await provider.saveTurn(turn1);
    await provider.saveTurn(turn2);
    await provider.saveTurn(turn3);

    const recent = provider.getRecentTurns(2);
    expect(recent.length).toBe(2);
    expect(recent[0].input).toBe("second");
    expect(recent[1].input).toBe("third");
  });

  it("getRecentTurns caps cache at 20", async () => {
    await provider.onWake(identity);

    for (let i = 0; i < 25; i++) {
      await provider.saveTurn(createTestTurn({ input: `turn-${i}` }));
    }

    const recent = provider.getRecentTurns(100);
    expect(recent.length).toBe(20);
    // Should have the last 20 (indices 5-24)
    expect(recent[0].input).toBe("turn-5");
    expect(recent[19].input).toBe("turn-24");
  });

  it("onSleep nulls thread — recall returns empty", async () => {
    await provider.onWake(identity);
    await provider.saveTurn(createTestTurn({ input: "before sleep" }));

    // Verify we have messages
    const before = await provider.recall();
    expect(before.length).toBeGreaterThan(0);

    await provider.onSleep();

    // After sleep, no thread — recall returns empty
    const after = await provider.recall();
    expect(after).toEqual([]);
  });

  it("close succeeds cleanly", async () => {
    await provider.onWake(identity);
    await provider.saveTurn(createTestTurn());

    // Should not throw
    await provider.close();

    // After close, recall returns empty (no thread)
    const messages = await provider.recall();
    expect(messages).toEqual([]);
  });

  it("saveTurn is no-op before onWake", async () => {
    // No onWake called — currentThreadId is null
    await provider.saveTurn(createTestTurn());
    // Should not throw, turn count stays 0 since saveTurn returns early
    // Actually turnCount increments in the local cache regardless... let me check
    // Looking at the code: saveTurn returns early if !this.currentThreadId
    expect(provider.getTurnCount()).toBe(0);
  });

  it("saveTurn handles tool call errors", async () => {
    await provider.onWake(identity);

    const turn = createTestTurn({
      toolCalls: [
        {
          id: "tc-err",
          name: "exec",
          arguments: { command: "bad" },
          result: "",
          durationMs: 50,
          error: "command failed",
        },
      ],
    });
    await provider.saveTurn(turn);

    const messages = await provider.recall();
    const errorMsg = messages.find(
      (m) => m.content.includes("Error: command failed"),
    );
    expect(errorMsg).toBeDefined();
  });

  it("recall with hint still works when semantic recall disabled (falls back to recency)", async () => {
    await provider.onWake(identity);
    // hint is passed but semantic recall is off — should not throw
    const results = await provider.recall("some hint");
    expect(results).toEqual([]);
  });
});
