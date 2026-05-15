import type {
  ChatSession,
  DirectChatPayload,
  DiscoverPayload,
  StoredChatMessage,
  WorkflowProgressEvent,
} from "@/lib/signalgraph-api";

export const CHAT_MODELS = [
  {
    chef: "0G Compute",
    chefSlug: "openai",
    id: "qwen/qwen-2.5-7b-instruct",
    name: "0G Qwen 2.5 7B",
    providers: ["openai"],
  },
  {
    chef: "OpenAI",
    chefSlug: "openai",
    id: "gpt-4o",
    name: "GPT-4o",
    providers: ["openai", "azure"],
  },
  {
    chef: "OpenAI",
    chefSlug: "openai",
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    providers: ["openai", "azure"],
  },
  {
    chef: "Anthropic",
    chefSlug: "anthropic",
    id: "claude-sonnet-4-20250514",
    name: "Claude 4 Sonnet",
    providers: ["anthropic", "azure", "google", "amazon-bedrock"],
  },
  {
    chef: "Google",
    chefSlug: "google",
    id: "gemini-2.0-flash-exp",
    name: "Gemini 2.0 Flash",
    providers: ["google"],
  },
] as const;

export type PendingPrompt = {
  text: string;
  model: string;
  researchTrend: boolean;
};

const PENDING_PROMPT_STORAGE_PREFIX = "langclaw.pendingPrompt.v1";

export function createChatSession(
  message: string,
  sessionId = createId()
): ChatSession {
  const now = new Date().toISOString();

  return {
    createdAt: now,
    id: sessionId,
    messages: [],
    pinned: false,
    title: createSessionTitle(message),
    updatedAt: now,
  };
}

export function createUserMessage(content: string): StoredChatMessage {
  return {
    content,
    id: createId(),
    role: "user",
  };
}

export function createAssistantMessage(content = ""): StoredChatMessage {
  return {
    content,
    id: createId(),
    progressEvents: [],
    role: "assistant",
  };
}

export function updateSessionMessages(
  session: ChatSession,
  messages: StoredChatMessage[]
): ChatSession {
  return {
    ...session,
    messages,
    title: session.title || createSessionTitle(messages[0]?.content || "Chat"),
    updatedAt: new Date().toISOString(),
  };
}

export function createSessionTitle(message: string) {
  const normalized = message.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return "New Chat";
  }

  return normalized.length > 54 ? `${normalized.slice(0, 51)}...` : normalized;
}

export function buildDirectAnswerContent(payload: DirectChatPayload) {
  return payload.answer;
}

export function buildDiscoverAnswerContent(payload: DiscoverPayload) {
  const finalAnswer = payload.finalAnswer;
  const lines = [
    `## ${finalAnswer.title}`,
    "",
    finalAnswer.answer,
    "",
    ...finalAnswer.bullets.map((bullet) => `- ${bullet}`),
    "",
    `**Recommendation:** ${finalAnswer.recommendation}`,
    "",
    `**Caveat:** ${finalAnswer.caveat}`,
  ];

  return lines.filter(Boolean).join("\n");
}

export function appendProgressSummary(events: WorkflowProgressEvent[]) {
  const latest = events.at(-1);

  if (!latest) {
    return "Starting SignalGraph workflow...";
  }

  return `${latest.agent}: ${latest.summary}`;
}

export function savePendingPrompt(sessionId: string, prompt: PendingPrompt) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    getPendingPromptStorageKey(sessionId),
    JSON.stringify(prompt)
  );
}

export function consumePendingPrompt(sessionId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const key = getPendingPromptStorageKey(sessionId);
  const raw = window.sessionStorage.getItem(key);

  if (!raw) {
    return null;
  }

  window.sessionStorage.removeItem(key);

  try {
    const parsed = JSON.parse(raw) as Partial<PendingPrompt>;

    if (
      typeof parsed.text !== "string" ||
      typeof parsed.model !== "string" ||
      typeof parsed.researchTrend !== "boolean"
    ) {
      return null;
    }

    return parsed as PendingPrompt;
  } catch {
    return null;
  }
}

function getPendingPromptStorageKey(sessionId: string) {
  return `${PENDING_PROMPT_STORAGE_PREFIX}:${sessionId}`;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
