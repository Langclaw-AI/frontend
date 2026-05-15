import {
  buildDiscoverAnswerContent,
  getUIMessageText,
  type LangclawMessageMetadata,
  type LangclawUIMessage,
} from "@/lib/chat-utils";
import {
  getSignalGraphApiUrl,
  type DirectChatPayload,
  type DiscoverPayload,
  type StoredChatMessage,
  type WorkflowProgressEvent,
} from "@/lib/signalgraph-api";
import type { ChatTransport, UIMessageChunk } from "ai";

type BackendChunk =
  | {
      type: "direct_delta";
      delta?: unknown;
    }
  | {
      type: "direct";
      payload?: unknown;
    }
  | {
      type: "mode";
      mode?: unknown;
    }
  | {
      type: "progress";
      event?: unknown;
    }
  | {
      type: "result";
      payload?: unknown;
    }
  | {
      type: "error";
      error?: unknown;
    };

type ChatRequestBody = {
  model?: string;
  researchTrend?: boolean;
  sessionId?: string;
};

const answerPartId = "langclaw-answer";
const reasoningPartId = "langclaw-reasoning";

export function createLangclawChatTransport(): ChatTransport<LangclawUIMessage> {
  return {
    reconnectToStream: async () => null,
    sendMessages: async ({ abortSignal, body, chatId, messages }) => {
      const stream = new ReadableStream<UIMessageChunk<LangclawMessageMetadata>>({
        start(controller) {
          void pipeBackendStreamToUIMessageChunks({
            abortSignal,
            body: readChatRequestBody(body),
            chatId,
            controller,
            messages,
          });
        },
      });

      return stream;
    },
  };
}

async function pipeBackendStreamToUIMessageChunks({
  abortSignal,
  body,
  chatId,
  controller,
  messages,
}: {
  abortSignal?: AbortSignal;
  body: ChatRequestBody;
  chatId: string;
  controller: ReadableStreamDefaultController<
    UIMessageChunk<LangclawMessageMetadata>
  >;
  messages: LangclawUIMessage[];
}) {
  let textStarted = false;
  let text = "";
  let reasoningStarted = false;
  let metadata: LangclawMessageMetadata = {};
  let progressEvents: WorkflowProgressEvent[] = [];

  const closeReasoningPart = () => {
    if (!reasoningStarted) {
      return;
    }

    controller.enqueue({
      id: reasoningPartId,
      type: "reasoning-end",
    });
    reasoningStarted = false;
  };

  const closeTextPart = () => {
    if (!textStarted) {
      return;
    }

    controller.enqueue({
      id: answerPartId,
      type: "text-end",
    });
    textStarted = false;
  };

  const updateMetadata = (patch: LangclawMessageMetadata) => {
    metadata = {
      ...metadata,
      ...patch,
    };
    controller.enqueue({
      messageMetadata: metadata,
      type: "message-metadata",
    });
  };

  const appendReasoning = (delta: string) => {
    if (!delta) {
      return;
    }

    if (!reasoningStarted) {
      controller.enqueue({
        id: reasoningPartId,
        type: "reasoning-start",
      });
      reasoningStarted = true;
    }

    controller.enqueue({
      delta,
      id: reasoningPartId,
      type: "reasoning-delta",
    });
  };

  const appendText = (delta: string) => {
    if (!delta) {
      return;
    }

    if (!textStarted) {
      controller.enqueue({
        id: answerPartId,
        type: "text-start",
      });
      textStarted = true;
    }

    text += delta;
    controller.enqueue({
      delta,
      id: answerPartId,
      type: "text-delta",
    });
  };

  try {
    const latestUserMessage = getLatestUserMessage(messages);
    const message = latestUserMessage
      ? getUIMessageText(latestUserMessage).trim()
      : "";

    if (!message) {
      throw new Error("Message text is required.");
    }

    if (latestUserMessage?.parts.some((part) => part.type === "file")) {
      throw new Error(
        "File attachments are not supported by the current chat backend."
      );
    }

    appendReasoning(
      body.researchTrend
        ? "Preparing SignalGraph research workflow.\n"
        : "Preparing direct answer with the selected model.\n"
    );

    const response = await fetch(getSignalGraphApiUrl("/api/chat/stream"), {
      body: JSON.stringify({
        message,
        messages: toBackendMessages(messages),
        model: body.model,
        researchTrend: Boolean(body.researchTrend),
        sessionId: body.sessionId ?? chatId,
        useAgent: Boolean(body.researchTrend),
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: abortSignal,
    });

    if (!response.ok) {
      throw new Error(await readErrorResponse(response));
    }

    if (!response.body) {
      throw new Error("Streaming response was empty.");
    }

    await readNdjson(response.body, abortSignal, (chunk) => {
      if (chunk.type === "direct_delta") {
        appendText(typeof chunk.delta === "string" ? chunk.delta : "");
        return;
      }

      if (chunk.type === "direct") {
        const payload = chunk.payload as DirectChatPayload;

        if (!text && payload.answer) {
          appendText(payload.answer);
        }

        updateMetadata({ directAnswer: payload });
        return;
      }

      if (chunk.type === "mode") {
        const mode = typeof chunk.mode === "string" ? chunk.mode : "chat";
        appendReasoning(`Route selected: ${mode}.\n`);
        return;
      }

      if (chunk.type === "progress") {
        const event = chunk.event as WorkflowProgressEvent;
        progressEvents = [
          ...progressEvents,
          event,
        ];
        updateMetadata({ progressEvents });
        appendReasoning(formatProgressReasoning(event));
        return;
      }

      if (chunk.type === "result") {
        const payload = chunk.payload as DiscoverPayload;
        appendReasoning("Research complete. Composing final answer.\n");
        closeReasoningPart();
        appendText(buildDiscoverAnswerContent(payload));
        updateMetadata({ progressEvents, result: payload });
        return;
      }

      if (chunk.type === "error") {
        throw new Error(readErrorMessage(chunk.error));
      }
    });

    closeReasoningPart();
    closeTextPart();
    controller.enqueue({ finishReason: "stop", type: "finish" });
    controller.close();
  } catch (error) {
    if (abortSignal?.aborted) {
      closeReasoningPart();
      closeTextPart();
      updateMetadata({ stopped: true });
      controller.close();
      return;
    }

    const message =
      error instanceof Error ? error.message : "SignalGraph request failed.";

    appendText(text ? `\n\n${message}` : message);
    closeReasoningPart();
    closeTextPart();
    updateMetadata({ error: message, progressEvents });
    controller.enqueue({ finishReason: "error", type: "finish" });
    controller.error(error);
  }
}

function readChatRequestBody(body: object | undefined): ChatRequestBody {
  const payload = (body ?? {}) as Record<string, unknown>;

  return {
    model: typeof payload.model === "string" ? payload.model : undefined,
    researchTrend: payload.researchTrend === true,
    sessionId:
      typeof payload.sessionId === "string" ? payload.sessionId : undefined,
  };
}

function getLatestUserMessage(messages: LangclawUIMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user");
}

function toBackendMessages(
  messages: LangclawUIMessage[]
): Array<Pick<StoredChatMessage, "content" | "role">> {
  return messages.flatMap((message) => {
    if (message.role !== "assistant" && message.role !== "user") {
      return [];
    }

    const content = getUIMessageText(message);

    return content.trim()
      ? [
          {
            content,
            role: message.role,
          },
        ]
      : [];
  });
}

async function readNdjson(
  body: ReadableStream<Uint8Array>,
  abortSignal: AbortSignal | undefined,
  onChunk: (chunk: BackendChunk) => void
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    if (abortSignal?.aborted) {
      await reader.cancel();
      throw new DOMException("Request aborted.", "AbortError");
    }

    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      readLine(line, onChunk);
    }
  }

  readLine(buffer, onChunk);
}

function readLine(line: string, onChunk: (chunk: BackendChunk) => void) {
  const trimmed = line.trim();

  if (!trimmed) {
    return;
  }

  onChunk(JSON.parse(trimmed) as BackendChunk);
}

async function readErrorResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  return payload?.error || `Request failed with status ${response.status}.`;
}

function readErrorMessage(value: unknown) {
  return typeof value === "string" ? value : "SignalGraph request failed.";
}

function formatProgressReasoning(event: WorkflowProgressEvent) {
  const agent = event.agent || "SignalGraph";
  const summary = event.summary || "Working on the next step.";
  const status = event.status ? ` [${event.status}]` : "";

  return `${agent}${status}: ${summary}\n`;
}
