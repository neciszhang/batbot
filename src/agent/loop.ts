import { MessageBus } from "../bus/queue";
import logger from "../log";
import { LLMProvider } from "../providers/base";

interface AgentLoopConfig {
  bus: MessageBus;
  provider: LLMProvider;
  workspace: string;
  model?: string;
  max_iterations?: number;
}
/**
 * The agent loop is the core processing engine.
 * It:
 * 1. Receives messages from the bus
 * 2. Builds context with history, memory, skills
 * 3. Calls the LLM
 * 4. Executes tool calls
 * 5. Sends responses back
 */
export class AgentLoop {
  private bus: MessageBus;
  private provider: LLMProvider;
  private workspace: string;
  private model: string;
  private max_iterations: number;
  private _running: boolean;

  constructor(config: AgentLoopConfig) {
    this.bus = config.bus;
    this.provider = config.provider;
    this.workspace = config.workspace;
    this.model = config.model ?? config.provider.getDefaultModel();
    this.max_iterations = config.max_iterations ?? 40;

    this._running = false;
  }

  /**
   * Run the agent loop, dispatching messages as tasks to stay responsive to /stop."
   */
  async run() {
    this._running = true;

    logger.info("Agent loop started");

    while (this._running){

    }
  }
}
