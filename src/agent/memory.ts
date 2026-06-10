import fs from "node:fs";
import path from "node:path";

import { ensure_dir } from "../utils";

/**
 * Two-layer memory: MEMORY.md (long-term facts) + HISTORY.md (grep-searchable log).
 *
 * Note: The Python version also ships a `MemoryStore.consolidate()` async method
 * and a `MemoryConsolidator` class that drive LLM-based summarisation. Those
 * depend on `LLMProvider.chat_with_retry` and token-counting helpers that the
 * Node port hasn't reached yet, so they're deferred until the agent loop needs
 * them.
 */
export class MemoryStore {
  memory_dir: string;
  memory_file: string;
  history_file: string;

  constructor(workspace: string) {
    this.memory_dir = ensure_dir(path.join(workspace, "memory"));
    this.memory_file = path.join(this.memory_dir, "MEMORY.md");
    this.history_file = path.join(this.memory_dir, "HISTORY.md");
  }

  read_long_term(): string {
    if (fs.existsSync(this.memory_file)) {
      return fs.readFileSync(this.memory_file, "utf-8");
    }
    return "";
  }

  write_long_term(content: string): void {
    fs.writeFileSync(this.memory_file, content, "utf-8");
  }

  append_history(entry: string): void {
    fs.appendFileSync(this.history_file, entry.trimEnd() + "\n\n", "utf-8");
  }

  /** System-prompt section for current long-term memory, or "" if empty. */
  get_memory_context(): string {
    const long_term = this.read_long_term();
    return long_term ? `## Long-term Memory\n${long_term}` : "";
  }
}
