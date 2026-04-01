import path from "node:path";
import os from "node:os";
import { z } from "zod";

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
  default: AgentDefaultSchema.prefault({}),
});

export type AgentsConfig = z.infer<typeof AgentsConfigSchema>;

export const ProviderConfigSchema = z.object({
  apiKey: z.string().default(""),
  apiBase: z.string().nullable().default(null),
  extraHeaders: z.record(z.string(), z.string()).nullable().default(null),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export const ProvidersConfigSchema = z.object({
  bailian: ProviderConfigSchema.prefault({}),
});

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
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  get workspacePath(): string {
    const workspace =
      this.config.agents.default?.workspace ?? "~/.batbot/workspace";
    if (workspace.startsWith("~")) {
      return path.join(os.homedir(), workspace.slice(1));
    }
    return path.resolve(workspace);
  }
}
