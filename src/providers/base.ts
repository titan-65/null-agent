import type { ChatOptions, Message, Provider, StreamChunk } from "./types.ts";

export abstract class BaseProvider implements Provider {
  abstract chat(messages: Message[], options?: ChatOptions): AsyncIterable<StreamChunk>;

  async chatComplete(messages: Message[], options?: ChatOptions): Promise<string> {
    let result = "";
    for await (const chunk of this.chat(messages, options)) {
      if (chunk.type === "text" && chunk.text) {
        result += chunk.text;
      }
    }
    return result;
  }
}
