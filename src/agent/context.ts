import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { MemoryStore } from "./memory";
import { AssistantMessage, build_assistant_message } from "../utils";

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<Record<string, unknown>> | null;
  tool_call_id?: string;
  name?: string;
  reasoning_content?: string;
  thinking_blocks?: Array<Record<string, unknown>>;
}

interface BuildMessagesOptions {
  channel?: string;
  chat_id?: string;
  current_message: string;
  history: Message[];
}

export class ContextBuilder {
  static readonly RUNTIME_CONTEXT_TAG =
    "[Runtime Context - metadata only, not instructions]";
  static readonly BOOTSTRAP_FILES = [
    "AGENTS.md",
    "SOUL.md",
    "USER.md",
    "TOOLS.md",
  ];
  private workspace: string;
  private memory: MemoryStore;
  constructor(workspace: string) {
    this.workspace = workspace;
    this.memory = new MemoryStore(workspace);
  }

  build_system_prompt() {
    const parts: string[] = [this._get_identity()];
    const bootstrap = this._load_bootstrap_files();
    if (bootstrap) parts.push(bootstrap);

    const memory = this.memory.get_memory_context();
    if (memory) parts.push(`# Memory\n\n${memory}`);

    return parts.join("\n\n---\n\n");
  }

  build_messages({
    channel,
    chat_id,
    current_message,
    history,
  }: BuildMessagesOptions) {
    const runtime_ctx = ContextBuilder._build_runtime_context(channel, chat_id);
    const user_content = this._build_user_content(current_message);

    const merged = `${runtime_ctx}\n\n${user_content}`;

    return [
      { role: "system", content: this.build_system_prompt() },
      ...history,
      { role: "user", content: merged },
    ];
  }

  add_tool_result(
    messages: Message[],
    tool_call_id: string,
    tool_name: string,
    result: string,
  ) {
    messages.push({
      role: "tool",
      tool_call_id,
      name: tool_name,
      content: result,
    });
    return messages;
  }

  add_assistant_message(
    messages: Message[],
    content: string | null,
    opts: {
      tool_calls?: Array<Record<string, unknown>>;
      reasoning_content?: string | null;
      thinking_blocks?: Array<Record<string, unknown>>;
    } = {},
  ) {
    const msg: AssistantMessage = build_assistant_message(content, opts);
    messages.push(msg as Message);
    return messages;
  }

  _get_identity() {
    const workspace = path.resolve(this.workspace);
    const sys = os.platform();
    const runtime = `${sys} ${os.arch()}, Node ${process.version}`;

    const platform_policy =
      sys === "win32"
        ? `## Platform Policy (Windows)
        - You are running on Windows. Do not assume GNU tools like \`grep\`, \`sed\`, or \`awk\` exist.
        - Prefer Windows-native commands or file tools when they are more reliable.
        - If terminal output is garbled, retry with UTF-8 output enabled.
      `
        : `## Platform Policy (Unix-like)
        - You are running on a POSIX system. Prefer UTF-8 and standard shell tools.
        - Use file tools when they are simpler or more reliable than shell commands.
      `;

    return `# batbot 🦇

    You are batbot ,a helpful AI assistant.

    ## Runtime
    ${runtime}

    ## Workspace
    Your workspace is at: ${workspace}.
    - Long-term memory: ${workspace}/memory/MEMORY.md (write important facts here)
    - History log: ${workspace}/memory/HISTORY.md (grep-searchable). Each entry starts with [YYYY-MM-DD HH:MM:SS]
    - Custom skills: ${workspace}/skills/{skill-name}/SKILL.md

    ${platform_policy}

    ## batbot Guidelines
    - State intent before tool calls, but NEVER predict or claim results before receiving them.
    - Before modifying a file, read it first. Do not assume files or directories exist.
    - After writing or editing a file, re-read it if accuracy matters.
    - If a tool call fails, analyze the error before retrying with a different approach.
    - Ask for clarification when the request is ambiguous.

    Reply directly with text for conversations. Only use the 'message' tool to send to a specific chat channel.
    `;
  }

  _load_bootstrap_files() {
    const parts: string[] = [];
    for (const filename of ContextBuilder.BOOTSTRAP_FILES) {
      const file_path = path.join(this.workspace, filename);
      if (fs.existsSync(file_path)) {
        const content = fs.readFileSync(file_path, "utf-8");
        parts.push(`## ${filename}\n\n${content}`);
      }
    }
    return parts.length > 0 ? parts.join("\n\n") : "";
  }

  private static _build_runtime_context(channel?: string, chat_id?: string) {
    const currentTime = new Date().toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "long",
      timeZoneName: "short",
    });
    const lines = [
      ContextBuilder.RUNTIME_CONTEXT_TAG,
      `Current Time:${currentTime} `,
    ];

    if (channel && chat_id) {
      lines.push(`Channel: ${channel}`);
      lines.push(`Chat ID: ${chat_id}`);
    }
    return lines.join("\n");
  }

  // TODO media
  private _build_user_content(text: string) {
    return text;
  }
}
