export class InboundMessage {
  /** Channel type: telegram, discord, slack, whatsapp, etc. */
  channel: string;
  /** User identifier */
  senderId: string;
  /** Chat/channel identifier */
  chatId: string;
  /** Message text content */
  content: string;
  /** Message timestamp */
  timestamp: Date;
  /** Media URLs (images, files, etc.) */
  media: string[];
  /** Channel-specific metadata */
  metadata: Record<string, unknown>;
  /** Optional override for thread-scoped sessions */
  sessionKeyOverride?: string;

  constructor(data: {
    channel: string;
    senderId: string;
    chatId: string;
    content: string;
    timestamp: Date;
    media: string[];
    metadata: Record<string, unknown>;
    sessionKeyOverride?: string;
  }) {
    this.channel = data.channel;
    this.senderId = data.senderId;
    this.chatId = data.chatId;
    this.content = data.content;
    this.timestamp = data.timestamp ?? new Date();
    this.media = data.media ?? [];
    this.metadata = data.metadata ?? {};
    this.sessionKeyOverride = data.sessionKeyOverride;
  }

  get sessionKey(): string {
    return this.sessionKeyOverride ?? `${this.channel}:${this.chatId}`;
  }
}

export class OutboundMessage {
  /** Channel type */
  channel: string;
  /** Chat/channel identifier */
  chatId: string;
  /** Message text content */
  content: string;
  /** Message ID to reply to */
  replyTo?: string;
  /** Media URLs to send */
  media: string[];
  /** Channel-specific metadata */
  metadata: Record<string, unknown>;

  constructor(data: {
    channel: string;
    chatId: string;
    content: string;
    replyTo?: string;
    media: string[];
    metadata: Record<string, unknown>;
  }) {
    this.channel = data.channel;
    this.chatId = data.chatId;
    this.content = data.content;
    this.replyTo = data.replyTo;
    this.media = data.media ?? [];
    this.metadata = data.metadata ?? {};
  }
}
