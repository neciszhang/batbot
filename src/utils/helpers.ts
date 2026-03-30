import { join, dirname } from "node:path";
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
