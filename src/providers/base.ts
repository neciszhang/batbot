/**
 * Default generation parameters for LLM calls.
 */
export interface GenerationSettings {
  temperature: number;
  max_completion_tokens: number;
  reasoning_effort: string | null;
}

const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  temperature: 0.7,
  max_completion_tokens: 4096,
  reasoning_effort: null,
};

export interface ChatOptions {
  //  Optional list of tool definitions.
  tools?: unknown[];
  // Model identifier (provider-specific)
  model?: string;
  // An upper bound for the number of tokens that can be generated for a completion, including visible output tokens and reasoning tokens.
  max_completion_tokens?: number;
  // Sampling temperature
  temperature?: number;
  // Reasoning effort for supported models */
  reasoning_effort?: string | null;
  //  Tool selection strategy ("auto", "required", or specific tool dict).
  tool_choice?: string | Record<string, unknown> | null;
}

export class ToolCallRequest {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly args: Record<string, unknown>,
    public readonly provider_specific_fields: Record<string, unknown> | null,
    public readonly function_provider_specific_fields: Record<
      string,
      unknown
    > | null,
  ) {}

  // TODO
  toOpenAIToolCall() {}
}

export interface LLMResponseParams {
  content: string | null;
  toolCalls?: ToolCallRequest[];
  finish_reason?: string;
  usage?: Record<string, number>;
  reasoning_content?: string | null;
  // thinkingBlocks?: Array<Record<string, unknown>> | null;
}

export class LLMResponse {
  public readonly content: string | null;
  public readonly toolCalls: ToolCallRequest[];
  public readonly finish_reason: string;
  public readonly usage: Record<string, number>;
  public readonly reasoning_content: string | null;
  // public readonly thinkingBlocks: Array<Record<string, unknown>> | null;

  constructor(params: LLMResponseParams) {
    this.content = params.content;
    this.toolCalls = params.toolCalls ?? [];
    this.finish_reason = params.finish_reason ?? "stop";
    this.usage = params.usage ?? {};
    this.reasoning_content = params.reasoning_content ?? null;
    // this.thinkingBlocks = params.thinkingBlocks ?? null;
  }

  /**
   * Check if response contains tool calls.
   */
  get hasToolCalls(): boolean {
    return this.toolCalls.length > 0;
  }
}

/**
 * Abstract base class for LLM providers.
 *
 * Implementations should handle the specifics of each provider's API
 * while maintaining a consistent interface.
 */
export abstract class LLMProvider {
  protected static readonly _CHAT_RETRY_DELAYS = [1, 2, 4] as const;
  protected static readonly _TRANSIENT_ERROR_MARKERS = [
    "429",
    "rate limit",
    "500",
    "502",
    "503",
    "504",
    "overloaded",
    "timeout",
    "timed out",
    "connection",
    "server error",
    "temporarily unavailable",
  ] as const;

  public readonly apiKey: string | undefined;
  public readonly apiBase: string | null;
  public generation: GenerationSettings;

  constructor(apiKey: string | undefined, apiBase: string | null) {
    this.apiKey = apiKey;
    this.apiBase = apiBase;
    this.generation = { ...DEFAULT_GENERATION_SETTINGS };
  }

  /**
   * Replace empty text content that causes provider 400 errors.
   * Empty content can appear when MCP tools return nothing.
   * Most providers reject empty-string content or empty text blocks in list content.
   */
  public static sanitizeEmptyContent(
    messages: Record<string, unknown>[],
  ): Record<string, unknown>[] {
    return messages.map((msg) => {
      if (msg.content === "") {
        msg.content = " ";
      }
      return msg;
    });
  }

  /**
   * Keep only provider-safe message keys and normalize assistant content.
   */
  public static sanitizeRequestMessages() {}

  /**
   * Send a chat completion request.
   *
   * @param messages - List of message dicts with 'role' and 'content'.
   * @param options - The chat options.
   */
  abstract chat(
    messages: Record<string, unknown>[],
    options: ChatOptions,
  ): Promise<LLMResponse>;

  /**
   * Get the default model for this provider.
   */
  abstract getDefaultModel(): string;
}
