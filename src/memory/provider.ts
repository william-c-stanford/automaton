/**
 * Memory Provider Interface
 *
 * The contract every memory backend must satisfy.
 * The agent loop interacts with memory exclusively through this interface.
 */

import type {
  AgentTurn,
  ChatMessage,
  AutomatonIdentity,
} from "../types.js";

export interface MemoryProvider {
  /** Provider name (e.g., "legacy", "mastra") */
  readonly name: string;

  /** Initialize the provider (create tables, connections, etc.) */
  init(): Promise<void>;

  /**
   * Save a completed turn (thinking, tool calls, token usage).
   * The provider decides how to persist this.
   */
  saveTurn(turn: AgentTurn): Promise<void>;

  /**
   * Build the context messages for the next inference call.
   * Returns ChatMessage[] ready to send (WITHOUT the system prompt).
   *
   * `hint` is optional text the provider can use for semantic search
   * (e.g., the pending input content).
   */
  recall(hint?: string): Promise<ChatMessage[]>;

  /**
   * Total number of turns persisted.
   * Used for status display and first-run detection.
   */
  getTurnCount(): number;

  /**
   * Recent turns in raw form (for CLI, status display, wakeup prompt).
   * Read-only view — not used for inference context.
   */
  getRecentTurns(limit: number): AgentTurn[];

  /**
   * Signal that a new wake cycle is starting.
   * Providers that use threads/sessions can create a new one here.
   */
  onWake(identity: AutomatonIdentity): Promise<void>;

  /**
   * Signal that the agent is going to sleep.
   * Providers can flush, compress, or finalize here.
   */
  onSleep(): Promise<void>;

  /** Clean shutdown. */
  close(): Promise<void>;
}

/**
 * Optional extension for providers that support structured working memory.
 * Working memory is injected into the system prompt each turn.
 */
export interface WorkingMemoryProvider {
  getWorkingMemory(): Promise<string | null>;
}

export function hasWorkingMemory(
  p: MemoryProvider,
): p is MemoryProvider & WorkingMemoryProvider {
  return "getWorkingMemory" in p;
}
