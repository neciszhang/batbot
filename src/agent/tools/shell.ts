import { spawn } from "node:child_process";
import { z } from "zod";
import { Tool } from "./base";

const DEFAULT_DENY_PATTERNS: RegExp[] = [
  /\brm\s+-[rf]{1,2}\b/, // rm -r, rm -rf, rm -fr
  /\bdel\s+\/[fq]\b/, // del /f, del /q
  /\brmdir\s+\/s\b/, // rmdir /s
  /(?:^|[;&|]\s*)format\b/, // format (as standalone command only)
  /\b(mkfs|diskpart)\b/, // disk operations
  /\bdd\s+if=/, // dd
  />\s*\/dev\/sd/, // write to disk
  /\b(shutdown|reboot|poweroff)\b/, // system power
  /:\(\)\s*\{.*\};\s*:/, // fork bomb
];

const ExecSchema = z.object({
  command: z.string().describe("The shell command to execute"),
  working_dir: z
    .string()
    .optional()
    .describe("Optional working directory for the command"),
  timeout: z
    .number()
    .int()
    .min(1)
    .max(600)
    .optional()
    .describe(
      "Timeout in seconds. Increase for long-running commands like compilation or installation (default 60, max 600).",
    ),
});

interface ExecToolOptions {
  timeout?: number;
  workingDir?: string;
  denyPatterns?: RegExp[];
}

export class ExecTool extends Tool<typeof ExecSchema> {
  private static readonly _MAX_TIMEOUT = 600;
  private static readonly _MAX_OUTPUT = 10_000;

  private timeout: number;
  private workingDir?: string;
  private denyPatterns: RegExp[];

  constructor({ timeout = 60, workingDir, denyPatterns }: ExecToolOptions) {
    super();
    this.timeout = timeout;
    this.workingDir = workingDir;
    this.denyPatterns = denyPatterns ?? DEFAULT_DENY_PATTERNS;
  }

  get name() {
    return "exec";
  }

  get schema() {
    return ExecSchema;
  }
  get description() {
    return "Execute a shell command and return its output. Use with caution.";
  }

  async execute(params: z.infer<typeof ExecSchema>): Promise<string> {
    const cwd = params.working_dir ?? this.workingDir ?? process.cwd();

    const guardError = this._guardCommand(params.command, cwd);
    if (guardError) return guardError;

    const effectiveTimeout = Math.min(
      params.timeout ?? this.timeout,
      ExecTool._MAX_TIMEOUT,
    );

    try {
      const { stdout, stderr, exitCode, timedOut } = await this._spawn(
        params.command,
        cwd,
        process.env,
        effectiveTimeout,
      );
      if (timedOut) {
        return `Error: Command timed out after ${effectiveTimeout} seconds`;
      }

      const parts: string[] = [];
      if (stdout) parts.push(stdout);
      if (stderr) parts.push(`STDERR:\n${stderr}`);
      parts.push(`\nExit code: ${exitCode}`);

      let result = parts.join("\n");
      const max = ExecTool._MAX_OUTPUT;
      if (result.length > max) {
        const half = Math.floor(max / 2);
        const truncated = result.length - max;

        result =
          result.slice(0, half) +
          `\n\n... (${truncated.toLocaleString("en-US")} chars truncated) ...\n\n` +
          result.slice(result.length - half);
      }

      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return `Error executing command: ${msg}`;
    }
  }

  _guardCommand(command: string, cwd: string) {
    const lower = command.trim().toLowerCase();
    if (this.denyPatterns.some((p) => p.test(lower))) {
      return "Error: Command blocked by safety guard (dangerous pattern detected)";
    }

    return null;
  }

  private _spawn(
    command: string,
    cwd: string,
    env: NodeJS.ProcessEnv,
    timeoutSec: number,
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number | null;
    timedOut: boolean;
  }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, { shell: true, cwd, env });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let timedOut = false;
      let settled = false;

      child.stdout?.on("data", (c: Buffer) => stdoutChunks.push(c));
      child.stderr?.on("data", (c: Buffer) => stderrChunks.push(c));

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, timeoutSec * 1000);

      const done = (exitCode: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        resolve({
          stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
          stderr: Buffer.concat(stderrChunks).toString("utf-8"),
          exitCode,
          timedOut,
        });
      };

      child.on("error", (err) => {
        stderrChunks.push(Buffer.from(String(err.message)));
        done(null);
      });

      child.on("close", (code) => done(code));
    });
  }
}
