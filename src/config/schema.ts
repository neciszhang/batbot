import path from "node:path";
import os from "node:os";
import { z } from "zod";
import { PROVIDER_SPECS } from "../providers";

export const DingTalkConfigSchema = z.object({
  enabled: z.boolean().default(false),
  clientId: z.string().default(""),
  clientSecret: z.string().default(""),
  allowFrom: z.array(z.string()).default([]),
});

export type DingTalkConfig = z.infer<typeof DingTalkConfigSchema>;

export const ChannelsConfigSchema = z
  .object({
    dingtalk: DingTalkConfigSchema.prefault({}),
  })
  .prefault({});

export const AgentDefaultSchema = z.object({
  workspace: z.string().default("~/.batbot/workspace"),
  model: z.string().default("bailian/qwen3.5-plus"),
  provider: z.string().default("auto"),
  max_completion_tokens: z.number().int().positive().default(8192),
  contextWindowTokens: z.number().int().positive().default(65536),
  temperature: z.number().min(0).max(2).default(0.1),
  maxToolIterations: z.number().int().positive().default(40),
  // Deprecated: memoryWindow is ignored at runtime
  memoryWindow: z.number().nullable().optional(),
  reasoning_effort: z
    .enum(["none", "minimal", "low", "medium", "high", "xhigh"])
    .nullable()
    .default(null),
});

export type AgentDefault = z.infer<typeof AgentDefaultSchema>;

export const AgentsConfigSchema = z.object({
  defaults: AgentDefaultSchema.prefault({}),
});

export type AgentsConfig = z.infer<typeof AgentsConfigSchema>;

export const ProviderConfigSchema = z.object({
  apiKey: z.string().default(""),
  apiBase: z.string().nullable().default(null),
  extraHeaders: z.record(z.string(), z.string()).nullable().default(null),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export const ProvidersConfigSchema = z
  .object({
    // Any OpenAI-compatible endpoint
    custom: ProviderConfigSchema.prefault({}),
    // bailian
    bailian: ProviderConfigSchema.prefault({}),
  })
  .catchall(ProviderConfigSchema);

export type ProvidersConfig = z.infer<typeof ProvidersConfigSchema>;

export const HeartbeatConfigSchema = z.object({
  enabled: z.boolean().default(false),
  intervalS: z
    .number()
    .int()
    .positive()
    // 30 minutes
    .default(30 * 60),
});

export type HeartbeatConfig = z.infer<typeof HeartbeatConfigSchema>;

export const GatewayConfigSchema = z.object({
  host: z.string().default("127.0.0.1"),
  port: z.number().int().positive().default(18790),
  heartbeat: HeartbeatConfigSchema.prefault({}),
});

export type GatewayConfig = z.infer<typeof GatewayConfigSchema>;

export const WebSearchConfigSchema = z.object({
  apiKey: z.string().default(""),
  maxResults: z.number().int().positive().default(5),
});

export type WebSearchConfig = z.infer<typeof WebSearchConfigSchema>;

export const WebToolsConfigSchema = z.object({
  proxy: z.string().nullable().default(null),
  search: WebSearchConfigSchema.prefault({}),
});

export type WebToolsConfig = z.infer<typeof WebToolsConfigSchema>;

export const ExecToolConfigSchema = z.object({
  timeout: z.number().int().positive().default(60),
  pathAppend: z.string().default(""),
});

export type ExecToolConfig = z.infer<typeof ExecToolConfigSchema>;

export const MCPServerConfigSchema = z.object({
  type: z.enum(["stdio", "sse", "streamableHttp"]).nullable().default(null),
  command: z.string().default(""),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).nullable().default(null),
  url: z.string().nullable().default(""),
  headers: z.record(z.string(), z.string()).nullable().default(null),
  toolTimeout: z.number().int().positive().default(30),
});

export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;

export const ToolsConfigSchema = z.object({
  web: WebToolsConfigSchema.prefault({}),
  exec: ExecToolConfigSchema.prefault({}),
  // If true, restrict all tool access to workspace directory
  restrictToWorkspace: z.boolean().default(false),
  mcpServers: z.record(z.string(), MCPServerConfigSchema).default({}),
});

export type ToolsConfig = z.infer<typeof ToolsConfigSchema>;

export const ConfigSchema = z
  .object({
    agents: AgentsConfigSchema.prefault({}),
    channels: ChannelsConfigSchema.prefault({}),
    providers: ProvidersConfigSchema.prefault({}),
    gateway: GatewayConfigSchema.prefault({}),
    tools: ToolsConfigSchema.prefault({}),
  })
  .prefault({});

export type Config = z.infer<typeof ConfigSchema>;

export class ConfigManger {
  private _config: Config;

  constructor(config: Config) {
    this._config = config;
  }

  get agents() {
    return this._config.agents;
  }
  get channels() {
    return this._config.channels;
  }
  get providers(): ProvidersConfig {
    return this._config.providers;
  }
  get gateway() {
    return this._config.gateway;
  }
  get tools() {
    return this._config.tools;
  }

  get workspacePath(): string {
    const workspace =
      this._config.agents.defaults?.workspace ?? "~/.batbot/workspace";
    if (workspace.startsWith("~")) {
      return path.join(os.homedir(), workspace.slice(1));
    }
    return path.resolve(workspace);
  }

  /**
   * Match provider config and its registry name.
   * @param model
   * @returns [config, specName] or [undefined, undefined].
   */
  private _matchProvider(model: string) {
    const forced = this.agents.defaults?.provider;

    if (forced !== "auto") {
      const p = this.providers[forced];
      return p ? [p, forced] : [undefined, undefined];
    }

    const modelStr = model ?? this.agents.defaults.model;
    const modelLower = modelStr.toLowerCase();
    const modelNormalized = modelLower.replace(/-/g, "");
    const modelPrefix = modelLower.includes("/")
      ? modelLower.split("/")[0]
      : "";
    const normalizedPrefix = modelPrefix.replace(/-/g, "");

    const kwMatches = (kw: string): boolean => {
      const kwLower = kw.toLowerCase();
      return (
        modelLower.includes(kwLower) ||
        modelNormalized.includes(kwLower.replace(/-/g, "_"))
      );
    };

    // Explicit provider prefix wins — prevents `github-copilot/...codex` matching openai_codex.
    for (const spec of PROVIDER_SPECS) {
      const p = this.providers[spec.name];
      if (p && modelPrefix && normalizedPrefix === spec.name) {
        if (spec.is_oauth || spec.is_local || p.apiKey) {
          return [p, spec.name];
        }
      }
    }

    // Match by keyword (order follows PROVIDER_SPECS registry)
    for (const spec of PROVIDER_SPECS) {
      const p = this.providers[spec.name];
      if (p && spec.keywords.some(kwMatches)) {
        if (spec.is_oauth || spec.is_local || p.apiKey) {
          return [p, spec.name];
        }
      }
    }

    // Fallback: configured local providers can route models without
    // provider-specific keywords (for example plain "llama3.2" on Ollama).
    for (const spec of PROVIDER_SPECS) {
      if (!spec.is_local) continue;
      const p = this.providers[spec.name];
      if (p?.apiBase) {
        return [p, spec.name];
      }
    }

    // Fallback: gateways first, then others (follows registry order)
    // OAuth providers are NOT valid fallbacks — they require explicit model selection

    for (const spec of PROVIDER_SPECS) {
      if (spec.is_oauth) continue;
      const p = this.providers[spec.name];
      if (p?.apiBase) {
        return [p, spec.name];
      }
    }

    return [undefined, undefined];
  }

  /**
   * GGet matched provider config (apiKey, apiBase, extraHeaders).
   * Falls back to first available.
   * @param model
   * @returns
   */
  getProvider(model: string): ProviderConfig | undefined {
    const [p] = this._matchProvider(model);
    return p as ProviderConfig | undefined;
  }

  /**
   * Get the registry name of the matched provider (e.g. "deepseek", "openrouter").
   * @param model
   * @returns provider name or undefined.
   */
  getProviderName(model: string) {
    const [, name] = this._matchProvider(model);
    return name;
  }
}
