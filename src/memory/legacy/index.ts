/**
 * Legacy Memory Provider
 *
 * Wraps the existing SQLite turns + context.ts logic with zero behavior change.
 * This is the default provider when no --memory flag is specified.
 */

import type {
  AgentTurn,
  ChatMessage,
  AutomatonDatabase,
  AutomatonIdentity,
} from "../../types.js";
import type { MemoryProvider } from "../provider.js";

const MAX_CONTEXT_TURNS = 20;

export class LegacyMemoryProvider implements MemoryProvider {
  readonly name = "legacy";

  constructor(private readonly db: AutomatonDatabase) {}

  async init(): Promise<void> {
    // Nothing to initialize — SQLite tables already exist
  }

  async saveTurn(_turn: AgentTurn): Promise<void> {
    // No-op: the agent loop persists turns to SQLite directly.
    // This provider's recall() reads from SQLite via db.getRecentTurns().
  }

  async recall(_hint?: string): Promise<ChatMessage[]> {
    const recentTurns = trimContext(this.db.getRecentTurns(MAX_CONTEXT_TURNS));
    return buildContextMessages(recentTurns);
  }

  getTurnCount(): number {
    return this.db.getTurnCount();
  }

  getRecentTurns(limit: number): AgentTurn[] {
    return this.db.getRecentTurns(limit);
  }

  async onWake(_identity: AutomatonIdentity): Promise<void> {
    // No-op for legacy provider
  }

  async onSleep(): Promise<void> {
    // No-op for legacy provider
  }

  async close(): Promise<void> {
    // Database lifecycle owned by caller
  }
}

/**
 * Build conversation history messages from recent turns.
 * Moved from src/agent/context.ts — identical logic.
 */
export function buildContextMessages(
  recentTurns: AgentTurn[],
  pendingInput?: { content: string; source: string },
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  for (const turn of recentTurns) {
    // The turn's input (if any) as a user message
    if (turn.input) {
      messages.push({
        role: "user",
        content: `[${turn.inputSource || "system"}] ${turn.input}`,
      });
    }

    // The agent's thinking as assistant message
    if (turn.thinking) {
      const msg: ChatMessage = {
        role: "assistant",
        content: turn.thinking,
      };

      // If there were tool calls, include them
      if (turn.toolCalls.length > 0) {
        msg.tool_calls = turn.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        }));
      }
      messages.push(msg);

      // Add tool results
      for (const tc of turn.toolCalls) {
        messages.push({
          role: "tool",
          content: tc.error ? `Error: ${tc.error}` : tc.result,
          tool_call_id: tc.id,
        });
      }
    }
  }

  // Add pending input if any
  if (pendingInput) {
    messages.push({
      role: "user",
      content: `[${pendingInput.source}] ${pendingInput.content}`,
    });
  }

  return messages;
}

/**
 * Trim turns to fit within limits.
 * Keeps the most recent turns.
 */
export function trimContext(
  turns: AgentTurn[],
  maxTurns: number = MAX_CONTEXT_TURNS,
): AgentTurn[] {
  if (turns.length <= maxTurns) {
    return turns;
  }
  return turns.slice(-maxTurns);
}
