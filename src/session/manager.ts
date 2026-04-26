import path from "node:path";
import fs from "node:fs";
import { ensure_dir, safe_filename } from "../utils";

export interface SessionConfig {
  key: string;
  messages?: Array<Record<string, any>>;
  created_at?: Date;
  updated_at?: Date;
  metadata?: Record<string, unknown>;
  last_consolidated?: number;
}

export interface SessionListItem {
  key: string;
  created_at: string;
  updated_at: string;
  path: string;
}

/**
 * A conversation session.
 *
 * Stores messages in JSONL format for easy reading and persistence
 *
 * Important: Messages are append-only for LLM cache efficiency.
 * The consolidation process writes summaries to MEMORY.md/HISTORY.md
 * but does NOT modify the messages list or get_history() output.
 */
export class Session {
  key: string;
  messages: Array<Record<string, any>>;
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, unknown>;
  last_consolidated: number;

  constructor(config: SessionConfig) {
    this.key = config.key;
    this.messages = config.messages || [];
    this.created_at = config.created_at || new Date();
    this.updated_at = config.updated_at || new Date();
    this.metadata = config.metadata || {};
    this.last_consolidated = config.last_consolidated || 0;
  }

  /**
   * Add a message to the session.
   * @param message
   */
  add_message(role: string, content: string | null, extra: any) {
    const msg = {
      role,
      content,
      timestamp: new Date().toISOString(),
      ...extra,
    };
    this.messages.push(msg);
    this.updated_at = new Date();
  }

  /**
   * @param max_messages
   * @returns Return unconsolidated messages for LLM input, aligned to a user turn.
   */
  get_history(max_messages: number = 500): string {
    const unconsolidated = this.messages.slice(this.last_consolidated);
    let sliced = unconsolidated.slice(-max_messages);

    // Drop leading non-user messages to avoid orphaned tool_result blocks
    const firstUserIdx = sliced.findIndex((m) => m.role === "user");
    if (firstUserIdx >= 0) {
      sliced = sliced.slice(firstUserIdx);
    }

    return this.messages.map((m) => JSON.stringify(m)).join("\n");
  }

  clear() {
    this.messages = [];
    this.updated_at = new Date();
  }
}

/**
 *  Manages conversation sessions.
 *  Sessions are stored as JSONL files in the sessions directory.
 */
export class SessionManager {
  workspace: string;
  sessions_dir: string;
  _cache: Map<string, Session>;
  constructor(workspace: string) {
    this.workspace = workspace || "";
    this.sessions_dir = ensure_dir(path.join(this.workspace, "sessions"));
    this._cache = new Map();
  }

  _get_session_path(key: string): string {
    const safe_key = safe_filename(key);
    return path.join(this.sessions_dir, `${safe_key}.jsonl`);
  }

  /**
   * Get an existing session or create a new one.
   * @param key
   * @returns
   */
  get_or_create(key: string): Session {
    if (this._cache.has(key)) {
      return this._cache.get(key)!;
    }

    const session = this._load(key) ?? new Session({ key });
    this._cache.set(key, session);
    return session;
  }

  /**
   * Load a session from disk.
   * @param key
   * @returns
   */
  _load(key: string) {
    const filePath = this._get_session_path(key);
    if (!fs.existsSync(filePath)) return null;

    try {
      const messages = [];
      let metadata = {};
      let created_at = new Date();
      let last_consolidated = 0;

      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n").filter((line) => line.trim());

      for (const line of lines) {
        const data = JSON.parse(line);
        if (data._type === "metadata") {
          metadata = data.metadata ?? {};
          created_at = data.created_at ? new Date(data.created_at) : new Date();
          last_consolidated = data.last_consolidated ?? 0;
        } else {
          messages.push(data);
        }
      }

      const session = new Session({
        key,
        messages,
        metadata,
        created_at,
        last_consolidated,
      });
      return session;
    } catch (e) {
      console.error(`Failed to load session ${key}: ${e}`);
      return null;
    }
  }

  /**
   * Save a session to disk.
   * @param session
   */
  save(session: Session) {
    const filePath = this._get_session_path(session.key);

    try {
      const lines = [];

      const metadataLine = {
        _type: "metadata",
        key: session.key,
        created_at: session.created_at.toISOString(),
        updated_at: session.updated_at.toISOString(),
        metadata: session.metadata,
        last_consolidated: session.last_consolidated,
      };
      lines.push(JSON.stringify(metadataLine));

      for (const msg of session.messages) {
        lines.push(JSON.stringify(msg));
      }

      fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf-8");
      this._cache.set(session.key, session);
    } catch (e) {
      console.error(`Failed to save session ${session.key}: ${e}`);
    }
  }

  /**
   * Remove a session from the in-memory cache.
   * @param key
   */
  invalidate(key: string) {
    this._cache.delete(key);
  }

  /**
   * List all sessions.
   * @returns
   */
  list_sessions(): SessionListItem[] {
    const sessions: SessionListItem[] = [];
    if (!fs.existsSync(this.sessions_dir)) return sessions;
    const files = fs.readdirSync(this.sessions_dir);

    for (const file of files) {
      if (!file.endsWith(".jsonl")) continue;

      const filePath = path.join(this.sessions_dir, file);

      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const firstLine = content.split("\n")[0];
        if (!firstLine) continue;

        const data = JSON.parse(firstLine);
        if (data._type === "metadata") {
          sessions.push({
            key: data.key ?? file.replace(".jsonl", "").replace("_", ":"),
            created_at: data.created_at,
            updated_at: data.updated_at,
            path: filePath,
          });
        }
      } catch (e) {
        console.error(`Failed to load session ${file}: ${e}`);
      }
    }

    return sessions.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}
