/**
 * Provider Registry — single source of truth for LLM provider metadata.
 * Adding a new provider:
 * 1. Add a ProviderSpec to PROVIDERS below.
 * 2. Add a field to ProvidersConfig in config/schema.ts.
  Done. Env vars, prefixing, config matching, status display all derive from here.
  Order matters — it controls match priority and fallback. Gateways first.
  Every entry writes out all fields so you can copy-paste as a template.
 */
export interface ProviderSpec {
  // Identity
  // Config field name, e.g. "dashscope"
  name: string;
  // model-name keywords for matching (lowercase)
  keywords: string[];
  // LiteLLM env var, e.g. "DASHSCOPE_API_KEY"
  env_key: string;
  // shown in `batbot status`
  display_name: string;

  // model prefixing
  // "dashscope" → model becomes "dashscope/{model}"
  litellm_prefix?: string;
  // Don't prefix if model already starts with these
  skip_prefixes?: string[];

  // Extra env vars, e.g. [["ZHIPUAI_API_KEY", "{api_key}"]]
  env_extras?: Array<[string, string]>;

  // gateway / local detection
  // routes any model (OpenRouter, AiHubMix)
  is_gateway?: boolean;
  // local deployment (vLLM, Ollama)
  is_local?: boolean;
  // match api_key prefix, e.g. "sk-or-"
  detect_by_key_prefix?: string;
  // match substring in api_base URL
  detect_by_base_keyword?: string;
  // fallback base URL
  default_api_base?: string;

  // gateway behavior
  // strip "provider/" before re-prefixing
  strip_model_prefix?: boolean;

  // Per-model param overrides, e.g. [["kimi-k2.5", { temperature: 1.0 }]]
  model_overrides?: Array<[string, Record<string, unknown>]>;

  // Direct providers bypass LiteLLM entirely (e.g., CustomProvider)
  is_direct?: boolean;
}

export const PROVIDER_SPECS: ProviderSpec[] = [
  {
    name: "custom",
    keywords: [],
    env_key: "",
    display_name: "Custom",
    litellm_prefix: "",
    is_direct: true,
  },
  {
    name: "bailian",
    keywords: ["bailian"],
    env_key: "BAILIAN_API_KEY",
    display_name: "bailian",
    litellm_prefix: "",
    skip_prefixes: [],
    env_extras: [],
    is_gateway: false,
    is_local: false,
    detect_by_key_prefix: "",
    detect_by_base_keyword: "",
    default_api_base: "",
    strip_model_prefix: false,
    model_overrides: [],
  },
];
