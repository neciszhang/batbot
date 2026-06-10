import path from "node:path";
import { promises as fs } from "node:fs";
import { Tool } from "./base";
import { expand_home } from "../../utils";
import z from "zod";

interface FsToolOptions {
  workspace: string;
  allowedDir: string;
}

const resolvePath = (raw: string, workspace: string, allowedDir: string) => {
  let p = expand_home(raw);
  if (!path.isAbsolute(p) && workspace) {
    p = path.join(workspace, p);
  }
  const resolved = path.resolve(p);

  if (allowedDir) {
    const root = path.resolve(allowedDir);
    const rel = path.relative(root, resolved);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      const err = new Error(
        `Path ${raw} is outside allowed directory ${allowedDir}`,
      );
      (err as NodeJS.ErrnoException).code = "EACCES";
      throw err;
    }
  }

  return resolved;
};

abstract class FsTool<S extends z.ZodType> extends Tool<S> {
  protected _workspace: string;
  protected _allowedDir: string;

  constructor({ workspace, allowedDir }: FsToolOptions) {
    super();
    this._workspace = workspace;
    this._allowedDir = allowedDir;
  }

  _resolve(p: string): string {
    return resolvePath(p, this._workspace, this._allowedDir);
  }
}

const formatFsError = (e: unknown, action: string): string =>
  `Error ${action}: ${e instanceof Error ? e.message : String(e)}`;

const ReadFileSchema = z.object({
  path: z.string().describe("The file path to read"),
  offset: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("The offset into the file to start reading"),
  limit: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("The maximum number of lines to read (default 2000)"),
});

export class ReadFileTool extends FsTool<typeof ReadFileSchema> {
  private static readonly _DEFAULT_LIMIT = 2000;
  private static readonly _MAX_CHARS = 128_000;

  get name(): string {
    return "read_file";
  }

  get description(): string {
    return (
      "Read the contents of a file. Returns numbered lines." +
      "Use offset and limit to paginate through large files."
    );
  }

  get schema() {
    return ReadFileSchema;
  }

  async execute(params: z.infer<typeof ReadFileSchema>): Promise<string> {
    const { path: filePath, limit } = params;
    let offset = params.offset ?? 1;
    let stats;

    try {
      const fp = this._resolve(filePath);
      try {
        stats = await fs.stat(fp);
      } catch (error) {
        return `Error: File not found: ${filePath}`;
      }
      if (!stats.isFile()) return `Error: Not a file: ${filePath}`;

      const allLines = (await fs.readFile(fp, "utf-8")).split("\n");

      // Trailing newline produces a final empty string; drop it to match line count semantics.
      if (allLines.length > 0 && allLines[allLines.length - 1] === "") {
        allLines.pop();
      }

      const total = allLines.length;

      if (offset < 1) offset = 1;
      if (total === 0) return `(Empty file: ${filePath})`;

      if (offset > total) {
        return `Error: offset ${offset} is beyond end of file (${total} lines)`;
      }

      const start = offset - 1;
      let end = Math.min(start + (limit ?? ReadFileTool._DEFAULT_LIMIT), total);

      let numbered = allLines
        .slice(start, end)
        .map((line, i) => `${start + i + 1}| ${line}`);
      let result = numbered.join("\n");
      if (result.length > ReadFileTool._MAX_CHARS) {
        const trimmed: string[] = [];
        let chars = 0;
        for (const line of numbered) {
          chars += line.length + 1;
          if (chars > ReadFileTool._MAX_CHARS) break;
          trimmed.push(line);
        }
        end = start + trimmed.length;
        numbered = trimmed;
        result = numbered.join("\n");
      }

      if (end < total) {
        result += `\n\n(Showing lines ${offset}-${end} of ${total}. Use offset=${end + 1} to continue.)`;
      } else {
        result += `\n\n(End of file — ${total} lines total)`;
      }

      return result;
    } catch (err) {
      return formatFsError(err, "reading file");
    }
  }
}

const WriteFileSchema = z.object({
  path: z.string().describe("The file path to write"),
  content: z.string().describe("The content to write"),
});
export class WriteFileTool extends FsTool<typeof WriteFileSchema> {
  get name(): string {
    return "write_file";
  }

  get description(): string {
    return "Write content to a file at the given path. Creates parent directories if needed.";
  }

  get schema() {
    return WriteFileSchema;
  }

  async execute(params: z.infer<typeof WriteFileSchema>): Promise<string> {
    const { path: filePath, content } = params;
    try {
      const fp = this._resolve(filePath);
      await fs.mkdir(path.dirname(fp), { recursive: true });
      await fs.writeFile(fp, content, "utf-8");
      return `Successfully wrote ${Buffer.byteLength(content, "utf-8")} bytes to ${fp}`;
    } catch (err) {
      return formatFsError(err, "writing file");
    }
  }
}

const findMatch = (
  content: string,
  oldText: string,
): { match: string | null; count: number } => {
  // 精准匹配
  if (content.includes(oldText)) {
    let count = 0;
    let i = 0;
    while ((i = content.indexOf(oldText, i)) !== -1) {
      count++;
      i += oldText.length;
    }

    return { match: oldText, count };
  }

  const oldLines = oldText.split("\n");
  if (oldLines.length === 0) return { match: null, count: 0 };

  // 模糊匹配
  const strippedOld = oldLines.map((l) => l.trim());
  const contentLines = content.split("\n");
  const candidates: string[] = [];

  for (let i = 0; i < contentLines.length - strippedOld.length; i++) {
    const window = contentLines.slice(i, i + strippedOld.length);
    const stripped = window.map((l) => l.trim());

    if (
      stripped.length === strippedOld.length &&
      stripped.every((s, j) => s === strippedOld[j])
    ) {
      candidates.push(window.join("\n"));
    }
  }

  if (candidates.length > 0) {
    return { match: candidates[0], count: candidates.length };
  }

  return { match: null, count: 0 };
};

const EditFileSchema = z.object({
  path: z.string().describe("The file path to edit"),
  old_text: z.string().describe("The text to find and replace"),
  new_text: z.string().describe("The text to replace with"),
  replace_all: z
    .boolean()
    .optional()
    .describe("Replace all occurrences (default false)"),
});

export class EditFileTool extends FsTool<typeof EditFileSchema> {
  get name(): string {
    return "edit_file";
  }

  get description(): string {
    return (
      "Edit a file by replacing old_text with new_text. " +
      "Supports minor whitespace/line-ending differences. " +
      "Set replace_all=true to replace every occurrence."
    );
  }

  get schema() {
    return EditFileSchema;
  }
  async execute(params: z.infer<typeof EditFileSchema>): Promise<string> {
    const { path: filePath, old_text, new_text, replace_all = false } = params;

    try {
      const fp = this._resolve(filePath);
      let raw: Buffer;
      try {
        raw = await fs.readFile(fp);
      } catch (error) {
        return `Error: File not found: ${filePath}`;
      }

      const usesCrlf = raw.includes("\r\n");
      const content = raw.toString("utf-8").replace(/\r\n/g, "\n");
      const normOld = old_text.replace(/\r\n/g, "\n");

      const { match, count } = findMatch(content, normOld);

      if (match === null) {
        return `Error: Old text not found: ${old_text}`;
      }

      if (count > 1 && !replace_all) {
        return (
          `Warning: Old text appears ${count} times.` +
          "Provide more context to make it unique, or set replace_all=true."
        );
      }

      const normNew = new_text.replace(/\r\n/g, "\n");
      let newContent = replace_all
        ? content.replaceAll(match, normNew)
        : content.replace(match, normNew);

      if (usesCrlf) newContent = newContent.replace(/\n/g, "\r\n");
      await fs.writeFile(fp, newContent, "utf-8");
      return `Successfully edited ${fp}`;
    } catch (e) {
      return formatFsError(e, "editing file");
    }
  }
}

const ListDirSchema = z.object({
  path: z.string().describe("The directory path to list"),
  recursive: z
    .boolean()
    .optional()
    .describe("Set to true to list recursively (default false)"),
  max_entries: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("The maximum number of entries to return (default 200)"),
});

export class ListDirTool extends FsTool<typeof ListDirSchema> {
  private static readonly _DEFAULT_MAX_ENTRIES = 200;
  private static readonly _IGNORE_DIRS = new Set([
    ".git",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    "dist",
    "build",
    ".tox",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".coverage",
    "htmlcov",
  ]);

  get name(): string {
    return "list_dir";
  }

  get description(): string {
    return (
      "List the contents of a directory. " +
      "Set recursive=true to explore nested structure. " +
      "Common noise directories (.git, node_modules, __pycache__, etc.) are auto-ignored."
    );
  }

  get schema() {
    return ListDirSchema;
  }

  async execute(params: z.infer<typeof ListDirSchema>): Promise<string> {
    const { path: dirPath, recursive = false, max_entries = 200 } = params;
    try {
      const dp = this._resolve(dirPath);
      let stat;
      try {
        stat = await fs.stat(dp);
      } catch {
        return `Error: Directory not found: ${dirPath}`;
      }
      if (!stat.isDirectory()) return `Error: Not a directory: ${dirPath}`;

      const cap = max_entries ?? ListDirTool._DEFAULT_MAX_ENTRIES;
      const items: string[] = [];
      let total = 0;
      if (recursive) {
        const collected: { rel: string; isDir: boolean }[] = [];
        await ListDirTool._walk(dp, dp, collected);
        collected.sort((a, b) => a.rel.localeCompare(b.rel));
        for (const entry of collected) {
          total++;
          if (items.length < cap) {
            items.push(entry.isDir ? `${entry.rel}/` : entry.rel);
          }
        }
      } else {
        const entries = await fs.readdir(dp, { withFileTypes: true });

        entries.sort((a, b) => a.name.localeCompare(b.name));
        for (const entry of entries) {
          if (ListDirTool._IGNORE_DIRS.has(entry.name)) continue;
          total++;
          if (items.length < cap) {
            const pfx = entry.isDirectory() ? "📁 " : "📄 ";
            items.push(`${pfx}${entry.name}`);
          }
        }
      }

      if (items.length === 0 && total === 0) {
        return `Directory ${dirPath} is empty`;
      }

      let result = items.join("\n");
      if (total > cap) {
        result += `\n\n(truncated, showing first ${cap} of ${total} entries)`;
      }
      return result;
    } catch (e) {
      return formatFsError(e, "listing directory");
    }
  }

  private static async _walk(
    dp: string,
    root: string,
    collected: { rel: string; isDir: boolean }[],
  ): Promise<void> {
    let entries;

    try {
      entries = await fs.readdir(dp, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (ListDirTool._IGNORE_DIRS.has(entry.name)) continue;
      const full = path.join(dp, entry.name);
      const rel = path.relative(root, full);
      const isDir = entry.isDirectory();
      collected.push({ rel, isDir });
      if (isDir) await ListDirTool._walk(full, root, collected);
    }
  } 
}
