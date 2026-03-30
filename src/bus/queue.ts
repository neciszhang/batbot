import { AsyncQueue } from "./async-queue";
import { InboundMessage, OutboundMessage } from "./events";

export class MessageBus {
  private inbound: AsyncQueue<InboundMessage>;
  private outbound: AsyncQueue<OutboundMessage>;

  constructor() {
    this.inbound = new AsyncQueue<InboundMessage>();
    this.outbound = new AsyncQueue<OutboundMessage>();
  }

  /**
   * Publish a message from a channel to the agent.
   * @param msg
   */
  async publishInbound(msg: InboundMessage): Promise<void> {
    await this.inbound.put(msg);
  }

  /**
   * "Consume the next inbound message (blocks until available).
   * @param msg
   */
  async consumeInbound(): Promise<InboundMessage> {
    return this.inbound.get();
  }

  /**
   * Publish a response from the agent to channels.
   * @param msg
   */
  async publishOutbound(msg: OutboundMessage): Promise<void> {
    await this.outbound.put(msg);
  }

  /**
   * "Consume the next outbound message (blocks until available).
   * @param msg
   */
  async consumeOutbound(): Promise<OutboundMessage> {
    return this.outbound.get();
  }

  /**
   *  Number of pending inbound messages
   */
  get inboundSize(): number {
    return this.inbound.size;
  }

  /**
   * Number of pending outbound messages
   */
  get outboundSize(): number {
    return this.outbound.size;
  }
}
