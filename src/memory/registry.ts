/**
 * Memory Provider Registry
 *
 * Maps provider names to factory functions.
 * The --memory CLI flag resolves here.
 */

import type { AutomatonConfig, AutomatonDatabase } from "../types.js";
import type { MemoryProvider } from "./provider.js";
import { LegacyMemoryProvider } from "./legacy/index.js";
import { MastraMemoryProvider } from "./mastra/index.js";

const PROVIDERS: Record<
  string,
  (config: AutomatonConfig, db: AutomatonDatabase) => MemoryProvider
> = {
  legacy: (_config, db) => new LegacyMemoryProvider(db),
  mastra: (config, _db) => new MastraMemoryProvider(config),
};

export function createMemoryProvider(
  name: string,
  config: AutomatonConfig,
  db: AutomatonDatabase,
): MemoryProvider {
  const factory = PROVIDERS[name];
  if (!factory) {
    const available = Object.keys(PROVIDERS).join(", ");
    throw new Error(
      `Unknown memory provider: "${name}". Available: ${available}`,
    );
  }
  return factory(config, db);
}

export function getAvailableProviders(): string[] {
  return Object.keys(PROVIDERS);
}
