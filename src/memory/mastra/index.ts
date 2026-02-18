/**
 * Mastra Memory Provider
 *
 * Uses @mastra/memory for thread-based storage, semantic recall,
 * and structured working memory.
 *
 * Key capabilities beyond legacy:
 * - Semantic vector search over past turns
 * - Structured working memory injected into system prompt
 * - Thread-per-wake-cycle for natural session boundaries
 */

import os from "os";
import path from "path";
import { Memory } from "@mastra/memory";
import { LibSQLStore, LibSQLVector } from "@mastra/libsql";
import { fastembed } from "@mastra/fastembed";
import { ulid } from "ulid";
import type {
  AgentTurn,
  ChatMessage,
  AutomatonIdentity,
} from "../../types.js";
import type { MemoryProvider } from "../provider.js";
import type { WorkingMemoryProvider } from "../provider.js";

const defaultDbUrl = `file:${path.join(os.homedir(), ".automaton", "memory.db")}`;
const defaultVectorUrl = `file:${path.join(os.homedir(), ".automaton", "vector-memory.db")}`;

interface MastraMessage {
  id: string;
  role: "user" | "assistant";
  content: { format: 2; parts: { type: string; text: string }[] };
  createdAt: Date;
  threadId: string;
  resourceId: string;
}

const DEFAULT_LAST_MESSAGES = 40;
const DEFAULT_SEMANTIC_TOP_K = 5;

export interface MastraMemoryOptions {
  storageUrl?: string;
  vectorUrl?: string;
  /** Set to false to disable semantic recall (and skip fastembed/vector). Default: true. */
  enableSemanticRecall?: boolean;
}

const WORKING_MEMORY_TEMPLATE = `# Automaton Operational State

## Current Goals
- [Goal 1]:
- [Goal 2]:

## Learned Facts
- [Fact]:

## Active Projects
- [Project]:
  - Status:
  - Next Step:

## Important Contacts
- [Address]: [Role/Relationship]

## Session Notes
- [Note]:
`;

export class MastraMemoryProvider implements MemoryProvider, WorkingMemoryProvider {
  readonly name = "mastra";

  private memory!: Memory;
  private currentThreadId: string | null = null;
  private resourceId: string = "automaton";
  private options: MastraMemoryOptions;

  // Local cache (Mastra doesn't expose a direct count API)
  private turnCount = 0;
  private recentTurnsCache: AgentTurn[] = [];

  constructor(config?: unknown, options?: MastraMemoryOptions) {
    // config parameter kept for backward compatibility but is unused
    this.options = options ?? {};
  }

  async init(): Promise<void> {
    const dbUrl = this.options.storageUrl ?? defaultDbUrl;
    const vectorUrl = this.options.vectorUrl ?? defaultVectorUrl;
    const enableSemantic = this.options.enableSemanticRecall !== false;

    this.memory = new Memory({
      storage: new LibSQLStore({
        id: "automaton-storage",
        url: dbUrl,
      }),
      ...(enableSemantic ? {
        vector: new LibSQLVector({
          id: "automaton-vector",
          url: vectorUrl,
        }),
        embedder: fastembed,
      } : {}),
      options: {
        lastMessages: DEFAULT_LAST_MESSAGES,
        semanticRecall: enableSemantic ? {
          topK: DEFAULT_SEMANTIC_TOP_K,
          messageRange: {
            before: 2,
            after: 1,
          },
        } : false,
        workingMemory: {
          enabled: true,
          template: WORKING_MEMORY_TEMPLATE,
        },
      },
    });
  }

  async saveTurn(turn: AgentTurn): Promise<void> {
    if (!this.currentThreadId) return;

    // Build MastraDBMessage-compatible objects.
    // The internal Mastra pipeline normalizes the content format.
    const messages: MastraMessage[] = [];

    if (turn.input) {
      messages.push({
        id: `${turn.id}-input`,
        role: "user",
        content: {
          format: 2,
          parts: [{ type: "text", text: `[${turn.inputSource || "system"}] ${turn.input}` }],
        },
        createdAt: new Date(turn.timestamp),
        threadId: this.currentThreadId,
        resourceId: this.resourceId,
      });
    }

    if (turn.thinking) {
      messages.push({
        id: `${turn.id}-thinking`,
        role: "assistant",
        content: {
          format: 2,
          parts: [{ type: "text", text: turn.thinking }],
        },
        createdAt: new Date(turn.timestamp),
        threadId: this.currentThreadId,
        resourceId: this.resourceId,
      });
    }

    // Tool results as assistant messages (Mastra doesn't have a "tool" role)
    for (let i = 0; i < turn.toolCalls.length; i++) {
      const tc = turn.toolCalls[i];
      messages.push({
        id: `${turn.id}-tool-${i}`,
        role: "assistant",
        content: {
          format: 2,
          parts: [{ type: "text", text: `[tool:${tc.name}] ${tc.error ? `Error: ${tc.error}` : tc.result.slice(0, 500)}` }],
        },
        createdAt: new Date(turn.timestamp),
        threadId: this.currentThreadId,
        resourceId: this.resourceId,
      });
    }

    if (messages.length > 0) {
      try {
        await this.memory.saveMessages({ messages });
      } catch (err) {
        console.warn("[mastra] saveTurn failed:", (err as Error).message);
      }
    }

    // Update local cache
    this.turnCount++;
    this.recentTurnsCache.push(turn);
    if (this.recentTurnsCache.length > 20) {
      this.recentTurnsCache = this.recentTurnsCache.slice(-20);
    }
  }

  async recall(hint?: string): Promise<ChatMessage[]> {
    if (!this.currentThreadId) return [];

    const recallOptions: any = {
      threadId: this.currentThreadId,
      resourceId: this.resourceId,
    };

    if (hint) {
      recallOptions.vectorSearchString = hint;
      recallOptions.threadConfig = {
        semanticRecall: {
          topK: DEFAULT_SEMANTIC_TOP_K,
          messageRange: { before: 2, after: 1 },
        },
      };
    }

    try {
      const { messages: mastraMessages } = await this.memory.recall(recallOptions);

      const chatMessages: ChatMessage[] = [];
      for (const msg of mastraMessages) {
        const role = msg.role as string;
        if (role !== "user" && role !== "assistant") continue;

        // Extract text from content (handles both V1 string and V2 parts format)
        let text: string;
        if (typeof (msg as any).content === "string") {
          text = (msg as any).content;
        } else if ((msg as any).content?.parts) {
          text = (msg as any).content.parts
            .filter((p: any) => p.type === "text")
            .map((p: any) => p.text)
            .join("\n");
        } else {
          text = "[unrecognized content format]";
        }

        chatMessages.push({
          role: role as "user" | "assistant",
          content: text,
        });
      }

      return chatMessages;
    } catch (err) {
      console.warn("[mastra] recall failed:", (err as Error).message);
      return [];
    }
  }

  getTurnCount(): number {
    return this.turnCount;
  }

  getRecentTurns(limit: number): AgentTurn[] {
    return this.recentTurnsCache.slice(-limit);
  }

  async onWake(identity: AutomatonIdentity): Promise<void> {
    if (this.currentThreadId) return; // Already awake
    this.resourceId = identity.address;

    // Create a new thread for this wake cycle
    const threadId = `wake-${ulid()}`;
    try {
      await this.memory.saveThread({
        thread: {
          id: threadId,
          resourceId: this.resourceId,
          title: `Wake cycle ${new Date().toISOString()}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        },
      });
    } catch (err) {
      console.warn("[mastra] thread creation failed:", (err as Error).message);
    }
    this.currentThreadId = threadId;
  }

  async onSleep(): Promise<void> {
    this.currentThreadId = null;
  }

  async getWorkingMemory(): Promise<string | null> {
    if (!this.currentThreadId) return null;

    try {
      return await this.memory.getWorkingMemory({
        threadId: this.currentThreadId,
        resourceId: this.resourceId,
      });
    } catch (_err) {
      /* Non-critical: working memory fetch may fail on first call before any data exists */
      return null;
    }
  }

  async close(): Promise<void> {
    this.currentThreadId = null;
  }
}
