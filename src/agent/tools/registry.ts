import { Tool, ToolSchema } from "./base";

const _HINT = "\n\n[Analyze the error above and try a different approach.]";

/**
 * Registry for agent tools.
 *
 * Allows dynamic registration and execution of tools.
 */
export class ToolRegistry {
  private _tools: Map<string, Tool> = new Map();

  /** Register a tool. */
  register(tool: Tool): void {
    this._tools.set(tool.name, tool);
  }

  /** Unregister a tool by name. */
  unregister(name: string): void {
    this._tools.delete(name);
  }

  /** Get a tool by name. */
  get(name: string): Tool | undefined {
    return this._tools.get(name);
  }

  /** Check if a tool exists by name. */
  has(name: string): boolean {
    return this._tools.has(name);
  }

  /** Get the list of registered tool definitions. */
  getDefinitions(): ToolSchema[] {
    return Array.from(this._tools.values(), (t) => t.toSchema());
  }

  /** Execute a tool by name with given parameters. */
  async execute(name: string, params: unknown): Promise<string> {
    const tool = this._tools.get(name);
    if (!tool) {
      throw new Error(
        `Tool ${name} not found. Available: ${this.toolNames.join(", ")}`,
      );
    }

    try {
      const casted = tool.castParams(params);

      const errors = tool.validateParams(casted);
      if (errors.length > 0) {
        return (
          `Error:Invalid parameters for tool '${name}': ${errors.join("; ")}` +
          _HINT
        );
      }
      const result = await tool.execute(casted);
      if (typeof result === "string" && result.startsWith("Error")) {
        return result + _HINT;
      }
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return `Error executing ${name}: ${msg}` + _HINT;
    }
  }

  /** Get the list of registered tool names. */
  get toolNames(): string[] {
    return Array.from(this._tools.keys());
  }

  /** Get the number of registered tools. */
  get size(): number {
    return this._tools.size;
  }
}
