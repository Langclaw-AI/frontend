import {
  buildOnChainAnswerContent,
  buildDiscoverAnswerContent,
  getUIMessageText,
  type LangclawMessageMetadata,
  type LangclawUIMessage,
} from "@/lib/chat-utils";
import {
  getLangclawApiUrl,
  readFriendlyError,
  LangclawApiError,
  type ChatMode,
  type ChatStreamChunk,
  type DirectChatPayload,
  type DiscoverPayload,
  type OnChainPlanSummary,
  type OnChainToolCallEvent,
  type OnChainToolFinalPayload,
  type OnChainToolResult,
  type StoredChatMessage,
  type WalletAuth,
  type WorkflowProgressEvent,
} from "@/lib/langclaw-api";
import type { ChatTransport, UIMessageChunk } from "ai";

type ChatRequestBody = {
  model?: string;
  researchTrend?: boolean;
  sessionId?: string;
  toolMode?: ChatMode;
  wallet?: WalletAuth;
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
  const toolMode = body.toolMode ?? (body.researchTrend ? "research" : "chat");
  let metadata: LangclawMessageMetadata = {
    mode: toolMode,
    model: body.model,
  };
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

    updateMetadata(metadata);

    const response = await fetch(getLangclawApiUrl("/api/chat/stream"), {
      body: JSON.stringify({
        message,
        messages: toBackendMessages(messages),
        model: body.model,
        researchTrend: toolMode === "research",
        sessionId: body.sessionId ?? chatId,
        toolMode,
        useAgent: toolMode === "research",
        wallet: body.wallet,
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
        const payload = readDirectPayload(chunk.payload);

        if (!text && payload.answer) {
          appendText(payload.answer);
        }

        updateMetadata({
          directAnswer: payload,
          mode: "chat",
          model: payload.usedModel ?? payload.model ?? body.model,
        });
        return;
      }

      if (chunk.type === "mode") {
        const mode = typeof chunk.mode === "string" ? chunk.mode : "chat";
        appendReasoning(`Route selected: ${mode}.\n`);
        return;
      }

      if (chunk.type === "tool_plan") {
        const plan = readOnChainPlan(chunk.plan);
        updateMetadata({ mode: "onchain" });
        appendReasoning(formatOnChainPlanReasoning(plan));
        return;
      }

      if (chunk.type === "tool_call") {
        const event = readOnChainToolCall(chunk.event);
        updateMetadata({ mode: "onchain" });
        appendReasoning(
          `${event.provider}: running ${event.title} (${event.domain}).\n`
        );
        return;
      }

      if (chunk.type === "tool_result") {
        const event = readOnChainToolResult(chunk.event);
        updateMetadata({ mode: "onchain" });
        appendReasoning(
          `${event.provider}: ${event.title} ${event.status} - ${event.summary}\n`
        );
        return;
      }

      if (chunk.type === "tool_final") {
        const payload = readOnChainPayload(chunk.payload);
        appendReasoning("On-chain tools complete. Composing final answer.\n");
        closeReasoningPart();
        appendText(buildOnChainAnswerContent(payload));
        updateMetadata({ mode: "onchain", onChain: payload });
        return;
      }

      if (chunk.type === "progress") {
        const event = readProgressEvent(chunk.event);
        progressEvents = [
          ...progressEvents,
          event,
        ];
        updateMetadata({ progressEvents });
        appendReasoning(formatProgressReasoning(event));
        return;
      }

      if (chunk.type === "result") {
        const payload = readDiscoverPayload(chunk.payload);
        appendReasoning("Research complete. Composing final answer.\n");
        closeReasoningPart();
        appendText(buildDiscoverAnswerContent(payload));
        updateMetadata({
          mode: "research",
          model:
            payload.finalAnswerMeta?.usedModel ??
            payload.finalAnswerMeta?.model ??
            body.model,
          progressEvents,
          result: payload,
        });
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
      error instanceof Error ? error.message : "Langclaw request failed.";

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
    toolMode: readChatMode(payload.toolMode, payload.researchTrend),
    wallet: readWalletAuth(payload.wallet),
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
  onChunk: (chunk: ChatStreamChunk) => void
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

function readLine(line: string, onChunk: (chunk: ChatStreamChunk) => void) {
  const trimmed = line.trim();

  if (!trimmed) {
    return;
  }

  onChunk(JSON.parse(trimmed) as ChatStreamChunk);
}

async function readErrorResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  const message = payload?.error || `Request failed with status ${response.status}.`;

  return readFriendlyError(
    new LangclawApiError(message, response.status),
    message,
  );
}

function readErrorMessage(value: unknown) {
  return typeof value === "string" ? value : "Langclaw request failed.";
}

function readDirectPayload(value: unknown): DirectChatPayload {
  if (!value || typeof value !== "object") {
    throw new Error("Malformed direct chat payload.");
  }

  const payload = value as Partial<DirectChatPayload>;

  if (typeof payload.answer !== "string") {
    throw new Error("Malformed direct chat payload.");
  }

  return {
    answer: payload.answer,
    error: typeof payload.error === "string" ? payload.error : undefined,
    fallbackFrom:
      typeof payload.fallbackFrom === "string" ? payload.fallbackFrom : undefined,
    model: typeof payload.model === "string" ? payload.model : undefined,
    modelHonored:
      typeof payload.modelHonored === "boolean" ? payload.modelHonored : undefined,
    requestedModel:
      typeof payload.requestedModel === "string"
        ? payload.requestedModel
        : undefined,
    source:
      payload.source === "0g-compute" || payload.source === "fallback"
        ? payload.source
        : undefined,
    teeVerification:
      payload.teeVerification && typeof payload.teeVerification === "object"
        ? payload.teeVerification
        : undefined,
    teeVerified:
      typeof payload.teeVerified === "boolean" || payload.teeVerified === null
        ? payload.teeVerified
        : undefined,
    title: typeof payload.title === "string" ? payload.title : undefined,
    usage:
      payload.usage && typeof payload.usage === "object"
        ? payload.usage
        : undefined,
    usedModel:
      typeof payload.usedModel === "string" ? payload.usedModel : undefined,
  };
}

function readOnChainPlan(value: unknown): OnChainPlanSummary {
  if (!value || typeof value !== "object") {
    throw new Error("Malformed on-chain plan.");
  }

  const plan = value as Partial<OnChainPlanSummary>;

  if (
    typeof plan.intent !== "string" ||
    typeof plan.chain !== "string" ||
    typeof plan.chainId !== "number" ||
    !Array.isArray(plan.commands)
  ) {
    throw new Error("Malformed on-chain plan.");
  }

  return plan as OnChainPlanSummary;
}

function readOnChainToolCall(value: unknown): OnChainToolCallEvent {
  if (!value || typeof value !== "object") {
    throw new Error("Malformed on-chain tool call.");
  }

  const event = value as Partial<OnChainToolCallEvent>;

  if (
    typeof event.commandId !== "string" ||
    typeof event.domain !== "string" ||
    typeof event.provider !== "string" ||
    typeof event.reason !== "string" ||
    typeof event.title !== "string"
  ) {
    throw new Error("Malformed on-chain tool call.");
  }

  return event as OnChainToolCallEvent;
}

function readOnChainToolResult(value: unknown): OnChainToolResult {
  if (!value || typeof value !== "object") {
    throw new Error("Malformed on-chain tool result.");
  }

  const event = value as Partial<OnChainToolResult>;

  if (
    typeof event.commandId !== "string" ||
    typeof event.domain !== "string" ||
    typeof event.provider !== "string" ||
    typeof event.summary !== "string" ||
    typeof event.title !== "string" ||
    !(
      event.status === "failed" ||
      event.status === "skipped" ||
      event.status === "success"
    )
  ) {
    throw new Error("Malformed on-chain tool result.");
  }

  return {
    ...event,
    latencyMs: typeof event.latencyMs === "number" ? event.latencyMs : 0,
  } as OnChainToolResult;
}

function readOnChainPayload(value: unknown): OnChainToolFinalPayload {
  if (!value || typeof value !== "object") {
    throw new Error("Malformed on-chain final payload.");
  }

  const payload = value as Partial<OnChainToolFinalPayload>;

  if (
    typeof payload.answer !== "string" ||
    !Array.isArray(payload.bullets) ||
    typeof payload.caveat !== "string" ||
    typeof payload.generatedAt !== "string" ||
    !payload.plan ||
    typeof payload.recommendation !== "string" ||
    typeof payload.title !== "string" ||
    !Array.isArray(payload.tools)
  ) {
    throw new Error("Malformed on-chain final payload.");
  }

  return payload as OnChainToolFinalPayload;
}

function readProgressEvent(value: unknown): WorkflowProgressEvent {
  if (!value || typeof value !== "object") {
    throw new Error("Malformed workflow progress event.");
  }

  const event = value as Partial<WorkflowProgressEvent>;

  if (
    typeof event.stepId !== "string" ||
    typeof event.agent !== "string" ||
    typeof event.skill !== "string" ||
    !isWorkflowStatus(event.status) ||
    typeof event.summary !== "string" ||
    typeof event.timestamp !== "string"
  ) {
    throw new Error("Malformed workflow progress event.");
  }

  return {
    agent: event.agent,
    completedAt:
      typeof event.completedAt === "string" ? event.completedAt : undefined,
    durationMs:
      typeof event.durationMs === "number" ? event.durationMs : undefined,
    error: typeof event.error === "string" ? event.error : undefined,
    execution: event.execution,
    model: typeof event.model === "string" ? event.model : undefined,
    sessionId: typeof event.sessionId === "string" ? event.sessionId : undefined,
    skill: event.skill,
    startedAt: typeof event.startedAt === "string" ? event.startedAt : undefined,
    status: event.status,
    stepId: event.stepId,
    summary: event.summary,
    timestamp: event.timestamp,
  };
}

function readWalletAuth(value: unknown): WalletAuth | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Partial<WalletAuth>;

  if (typeof record.address !== "string") {
    return undefined;
  }

  if (typeof record.sessionToken === "string") {
    return {
      address: record.address,
      sessionExpiresAt:
        typeof record.sessionExpiresAt === "string"
          ? record.sessionExpiresAt
          : undefined,
      sessionToken: record.sessionToken,
    };
  }

  if (typeof record.message !== "string" || typeof record.signature !== "string") {
    return undefined;
  }

  return {
    address: record.address,
    message: record.message,
    signature: record.signature,
  };
}

function readChatMode(
  toolMode: unknown,
  researchTrend: unknown
): ChatMode | undefined {
  if (
    toolMode === "chat" ||
    toolMode === "onchain" ||
    toolMode === "research"
  ) {
    return toolMode;
  }

  return researchTrend === true ? "research" : undefined;
}

function readDiscoverPayload(value: unknown): DiscoverPayload {
  if (!value || typeof value !== "object") {
    throw new Error("Malformed discovery result payload.");
  }

  const payload = value as Partial<DiscoverPayload>;

  if (
    typeof payload.topic !== "string" ||
    typeof payload.generatedAt !== "string" ||
    !Array.isArray(payload.sources) ||
    !Array.isArray(payload.errors) ||
    !payload.orchestration ||
    !payload.finalConclusion ||
    !payload.finalAnswer
  ) {
    throw new Error("Malformed discovery result payload.");
  }

  return payload as DiscoverPayload;
}

function isWorkflowStatus(value: unknown): value is WorkflowProgressEvent["status"] {
  return (
    value === "pending" ||
    value === "running" ||
    value === "complete" ||
    value === "failed"
  );
}

function formatProgressReasoning(event: WorkflowProgressEvent) {
  const agent = event.agent || "Langclaw";
  const summary = event.summary || "Working on the next step.";
  const status = event.status ? ` [${event.status}]` : "";

  return `${agent}${status}: ${summary}\n`;
}

function formatOnChainPlanReasoning(plan: OnChainPlanSummary) {
  const commands = plan.commands
    .map((command) => `${command.provider}:${command.commandId}`)
    .join(", ");

  return `On-chain plan: ${plan.intent} on ${plan.chain}. Tools: ${commands || "none"}.\n`;
}
