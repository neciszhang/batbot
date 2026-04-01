import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";
import { ChatOptions, LLMProvider, LLMResponse } from "./base";
import logger from "../log";

export class CustomProvider extends LLMProvider {
  public default_model: string;
  public _client: OpenAI;

  constructor(
    apiKey: string = "no-key",
    apiBase: string = "http://localhost:8000/v1",
    default_model: string = "default",
  ) {
    super(apiKey, apiBase);
    this.default_model = default_model;

    this._client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.apiBase,
      defaultHeaders: { "x-session-affinity": uuidv4() },
    });
  }

  async chat(
    messages: Record<string, unknown>[],
    options: ChatOptions,
  ): Promise<LLMResponse> {
    const {
      tools = [],
      model,
      max_completion_tokens = 4096,
      temperature = 0.7,
      reasoning_effort,
      tool_choice,
    } = options || {};

    const params: any = {
      model: model || this.default_model,
      messages: LLMProvider.sanitizeEmptyContent(messages),
      max_completion_tokens: Math.max(1, max_completion_tokens),
      temperature: temperature,
    };

    if (reasoning_effort) {
      params.reasoning_effort = reasoning_effort;
    }
    if (tools.length > 0) {
      params.tools = tools;
      params.tool_choice = tool_choice ?? "auto";
    }
    try {
      const response = await this._client.chat.completions.create(params);
      return this._parse(response);
    } catch (error) {
      logger.error(String(error));
      return new LLMResponse({
        content: String(error),
        finish_reason: "error",
      });
    }
  }

  private _parse(response: any): LLMResponse {
    const { choices = [], usage } = response;
    const choice = choices[0];
    const { message, finish_reason = "stop" } = choice;

    // TODO calls
    const { tool_calls = [], reasoning_content, content } = message;
    console.log({
      content,
      // tool_calls: tool_calls,
      finish_reason,
      usage,
      reasoning_content,
    });

    return new LLMResponse({
      content,
      // tool_calls: tool_calls,
      finish_reason,
      usage,
      reasoning_content,
    });
  }

  getDefaultModel() {
    return this.default_model;
  }
}
