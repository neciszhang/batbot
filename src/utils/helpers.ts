import { join, dirname } from "node:path";
import os from "node:os";
import {
  readdirSync,
  existsSync,
  copyFileSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import logger from "../log";

export function syncWorkspaceTemplates(
  workspace: string,
  silent: boolean = false,
) {
  const templatesPath = join(__dirname, "..", "templates");
  const files = readdirSync(templatesPath);
  const added: string[] = [];

  const _write = (src: string | null, path: string) => {
    if (existsSync(path)) return;
    mkdirSync(dirname(path), { recursive: true });
    if (src) {
      copyFileSync(src, path);
    } else {
      writeFileSync(path, "");
    }

    added.push(path.replace(workspace, "").replace(/^\//, ""));
  };

  for (const file of files) {
    if (file.endsWith(".md") && !file.startsWith(".")) {
      _write(join(templatesPath, file), join(workspace, file));
    }
  }

  _write(`${templatesPath}/memory/MEMORY.md`, `${workspace}/memory/MEMORY.md`);
  _write(null, `${workspace}/memory/HISTORY.md`);
  mkdirSync(`${workspace}/skills`, { recursive: true });

  if (!silent) {
    for (const name of added) {
      logger.gray(`Created: ${name}`);
    }
  }
}

/**
 * Ensures that the directory exists, if not it creates it.
 * @param path
 * @returns */
export const ensure_dir = (path: string) => {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
  return path;
};

/**
 * Replaces invalid characters in a filename with underscores.
 * @param name
 * @returns */
export const safe_filename = (name: string) => {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
};


export const expand_home = (p: string) => {
  return p.startsWith("~") ? join(os.homedir(), p.slice(1)) : p;
};

/**
 * Detect image MIME type from magic bytes, ignoring file extension.
 * Returns null for unrecognized formats.
 */
export const detect_image_mime = (data: Buffer): string | null => {
  if (data.length >= 8) {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (data.subarray(0, 8).equals(png)) return "image/png";
  }
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return "image/jpeg";
  }
  if (data.length >= 6) {
    const head = data.subarray(0, 6).toString("ascii");
    if (head === "GIF87a" || head === "GIF89a") return "image/gif";
  }
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
};

export interface AssistantMessage {
  role: "assistant";
  content: string | null;
  tool_calls?: Array<Record<string, unknown>>;
  reasoning_content?: string;
  thinking_blocks?: Array<Record<string, unknown>>;
}

/**
 * Build a provider-safe assistant message with optional reasoning fields.
 */
export const build_assistant_message = (
  content: string | null,
  opts: {
    tool_calls?: Array<Record<string, unknown>>;
    reasoning_content?: string | null;
    thinking_blocks?: Array<Record<string, unknown>>;
  } = {},
): AssistantMessage => {
  const msg: AssistantMessage = { role: "assistant", content };
  if (opts.tool_calls && opts.tool_calls.length > 0) {
    msg.tool_calls = opts.tool_calls;
  }
  if (opts.reasoning_content !== null && opts.reasoning_content !== undefined) {
    msg.reasoning_content = opts.reasoning_content;
  }
  if (opts.thinking_blocks && opts.thinking_blocks.length > 0) {
    msg.thinking_blocks = opts.thinking_blocks;
  }
  return msg;
};
