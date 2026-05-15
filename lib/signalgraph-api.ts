export type SourceType =
  | "x_post"
  | "github_repo"
  | "docs_page"
  | "hackquest_hackathon"
  | "hackquest_project";

export type ProviderName = "X" | "GitHub" | "Tavily" | "HackQuest";

export type SourceCard = {
  id: string;
  type: SourceType;
  title: string;
  url: string;
  author?: string;
  publishedAt?: string;
  excerpt: string;
  metrics?: Record<string, string | number | undefined>;
  provider: ProviderName;
};

export type ProviderError = {
  provider: ProviderName;
  message: string;
};

export type StepExecution =
  | "openclaw-agent"
  | "typescript-tool"
  | "0g-compute"
  | "0g-storage"
  | "0g-chain"
  | "deterministic-fallback";

export type WorkflowProgressEvent = {
  stepId: string;
  agent: string;
  skill: string;
  status: "pending" | "running" | "complete" | "failed";
  summary: string;
  timestamp: string;
  execution?: StepExecution;
  model?: string;
  sessionId?: string;
  error?: string;
};

export type OrchestrationStep = {
  agent: string;
  skill: string;
  status: "complete" | "failed";
  summary: string;
  execution?: StepExecution;
  model?: string;
  sessionId?: string;
  error?: string;
};

export type FinalConclusion = {
  headline: string;
  summary: string;
  keySignals: Array<{
    label: string;
    text: string;
    sourceId?: string;
  }>;
  recommendation: string;
  qualityNote: string;
  generatedBy: "Final Conclusion Agent";
};

export type FinalAnswer = {
  title: string;
  answer: string;
  bullets: string[];
  recommendation: string;
  caveat: string;
  generatedBy: "Final Conclusion Agent";
};

export type ZeroGProof = {
  storage: {
    status: "prepared" | "uploaded" | "skipped" | "failed";
    evidenceUri: string;
    rootHash?: string;
    txHash?: string;
    explorerUrl?: string;
    indexerRpc?: string;
    error?: string;
  };
  chain: {
    status: "prepared" | "anchored" | "skipped" | "failed";
    briefHash: string;
    txHash?: string;
    explorerUrl?: string;
    registryAddress?: string;
    chainId?: number;
    error?: string;
  };
  compute?: {
    status: "used" | "skipped" | "failed";
    model?: string;
    endpoint?: string;
    error?: string;
  };
};

export type DiscoverPayload = {
  topic: string;
  generatedAt: string;
  sources: SourceCard[];
  errors: ProviderError[];
  orchestration: {
    runtime: "openclaw" | "typescript";
    steps: OrchestrationStep[];
  };
  finalConclusion: FinalConclusion;
  finalAnswer: FinalAnswer;
  finalAnswerMeta?: {
    synthesis: "0g-compute" | "openclaw-ai" | "deterministic-fallback";
    execution?: StepExecution;
    model?: string;
    sessionId?: string;
    transport?: string;
    fallbackFrom?: string;
    error?: string;
  };
  agentOutputs?: {
    planner?: {
      summary: string;
      providerPlan: Array<{
        provider: ProviderName;
        query: string;
        purpose: string;
      }>;
      scoringFocus: string[];
    };
    trend?: {
      summary: string;
      topTrend: string;
      score: number;
      rankedTrends: Array<{
        label: string;
        score: number;
        why: string;
        sourceIds: string[];
      }>;
    };
    evidence?: {
      bundleSummary: string;
      storageStatus: "prepared" | "uploaded" | "skipped" | "failed";
      evidenceUri: string;
      rootHash?: string;
      storageTxHash?: string;
      storageExplorerUrl?: string;
      error?: string;
      claimMap: Array<{
        claim: string;
        sourceIds: string[];
      }>;
    };
    verifier?: {
      verificationSummary: string;
      unsupportedClaims: string[];
      briefHashInput: string;
      storageStatus: "prepared" | "uploaded" | "skipped" | "failed";
      chainStatus: "prepared" | "anchored" | "skipped" | "failed";
      chainTxHash?: string;
      chainExplorerUrl?: string;
      registryAddress?: string;
      error?: string;
    };
  };
  zeroG?: ZeroGProof;
};

export type DirectChatPayload = {
  answer: string;
  model?: string;
  source?: "0g-compute" | "fallback";
  title?: string;
};

export type StoredChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  result?: DiscoverPayload;
  directAnswer?: DirectChatPayload;
  progressEvents?: WorkflowProgressEvent[];
  error?: string;
  stopped?: boolean;
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  messages: StoredChatMessage[];
};

export type WalletAuth = {
  address: string;
  message: string;
  signature: string;
};

export type ChatStreamInput = {
  message: string;
  messages?: Array<Pick<StoredChatMessage, "role" | "content">>;
  model?: string;
  researchTrend?: boolean;
  sessionId?: string;
  signal?: AbortSignal;
  onDirectDelta?: (delta: string) => void;
  onDirect?: (payload: DirectChatPayload) => void;
  onMode?: (mode: string) => void;
  onProgress?: (event: WorkflowProgressEvent) => void;
  onResult?: (payload: DiscoverPayload) => void;
  onError?: (message: string) => void;
};

export type DiscoverStreamInput = {
  topic: string;
  signal?: AbortSignal;
  onProgress?: (event: WorkflowProgressEvent) => void;
  onResult?: (payload: DiscoverPayload) => void;
  onError?: (message: string) => void;
};

type ChatSessionsResponse =
  | {
      configured: false;
      error?: string;
    }
  | {
      configured: true;
      error?: string;
      deleted?: boolean;
      session?: ChatSession | null;
      sessions?: ChatSession[];
    };

const DEFAULT_BACKEND_URL = "http://localhost:3001";

export const CHAT_SESSIONS_UPDATED_EVENT = "langclaw-chat-sessions-updated";

export class SignalGraphApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SignalGraphApiError";
    this.status = status;
  }
}

export function getSignalGraphApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SIGNALGRAPH_API_URL?.replace(/\/+$/, "") ||
    DEFAULT_BACKEND_URL
  );
}

export function getSignalGraphApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSignalGraphApiBaseUrl()}${normalizedPath}`;
}

export async function checkBackendHealth() {
  const response = await fetch(getSignalGraphApiUrl("/health"), {
    cache: "no-store",
  });

  return readJsonResponse<{ ok: boolean; service: string }>(response);
}

export async function runDiscover(topic: string) {
  const response = await postJson("/api/discover", { topic });

  return readJsonResponse<DiscoverPayload>(response);
}

export async function streamDiscover(input: DiscoverStreamInput) {
  const response = await postJson(
    "/api/discover/stream",
    { topic: input.topic },
    input.signal
  );

  await readNdjson(response, (chunk) => {
    if (chunk.type === "progress") {
      input.onProgress?.(chunk.event as WorkflowProgressEvent);
      return;
    }

    if (chunk.type === "result") {
      input.onResult?.(chunk.payload as DiscoverPayload);
      return;
    }

    if (chunk.type === "error") {
      input.onError?.(readErrorMessage(chunk.error));
    }
  });
}

export async function streamChat(input: ChatStreamInput) {
  const response = await postJson(
    "/api/chat/stream",
    {
      message: input.message,
      messages: input.messages ?? [],
      model: input.model,
      researchTrend: Boolean(input.researchTrend),
      sessionId: input.sessionId,
      useAgent: Boolean(input.researchTrend),
    },
    input.signal
  );

  await readNdjson(response, (chunk) => {
    if (chunk.type === "direct_delta") {
      input.onDirectDelta?.(typeof chunk.delta === "string" ? chunk.delta : "");
      return;
    }

    if (chunk.type === "direct") {
      input.onDirect?.(chunk.payload as DirectChatPayload);
      return;
    }

    if (chunk.type === "mode") {
      input.onMode?.(typeof chunk.mode === "string" ? chunk.mode : "");
      return;
    }

    if (chunk.type === "progress") {
      input.onProgress?.(chunk.event as WorkflowProgressEvent);
      return;
    }

    if (chunk.type === "result") {
      input.onResult?.(chunk.payload as DiscoverPayload);
      return;
    }

    if (chunk.type === "error") {
      input.onError?.(readErrorMessage(chunk.error));
    }
  });
}

export async function listChatSessions(wallet: WalletAuth) {
  const response = await chatSessionsRequest({ action: "list", wallet });

  return response.sessions ?? [];
}

export async function getChatSession(wallet: WalletAuth, sessionId: string) {
  const response = await chatSessionsRequest({
    action: "get",
    sessionId,
    wallet,
  });

  return response.session ?? null;
}

export async function upsertChatSession(
  wallet: WalletAuth,
  session: ChatSession
) {
  const response = await chatSessionsRequest({
    action: "upsert",
    session,
    wallet,
  });

  return response.session ?? null;
}

export async function deleteChatSession(
  wallet: WalletAuth,
  sessionId: string
) {
  const response = await chatSessionsRequest({
    action: "delete",
    sessionId,
    wallet,
  });

  return Boolean(response.deleted);
}

export function dispatchChatSessionsUpdated() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(CHAT_SESSIONS_UPDATED_EVENT));
}

async function chatSessionsRequest(body: {
  action: "delete" | "get" | "list" | "upsert";
  wallet: WalletAuth;
  sessionId?: string;
  session?: ChatSession;
}) {
  const response = await postJson("/api/chat/sessions", body);
  const payload = await readJsonResponse<ChatSessionsResponse>(response);

  if (!payload.configured) {
    throw new SignalGraphApiError(
      payload.error || "Chat session storage is not configured.",
      503
    );
  }

  if (payload.error) {
    throw new SignalGraphApiError(payload.error, response.status);
  }

  return payload;
}

async function postJson(path: string, body: unknown, signal?: AbortSignal) {
  return fetch(getSignalGraphApiUrl(path), {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    signal,
  });
}

async function readJsonResponse<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new SignalGraphApiError(
      payload?.error || `Request failed with status ${response.status}.`,
      response.status
    );
  }

  return payload as T;
}

async function readNdjson(
  response: Response,
  onChunk: (chunk: Record<string, unknown>) => void
) {
  if (!response.ok) {
    await readJsonResponse(response);
    return;
  }

  if (!response.body) {
    throw new SignalGraphApiError("Streaming response was empty.", response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      onChunk(JSON.parse(trimmed) as Record<string, unknown>);
    }
  }

  const remaining = buffer.trim();

  if (remaining) {
    onChunk(JSON.parse(remaining) as Record<string, unknown>);
  }
}

function readErrorMessage(value: unknown) {
  return typeof value === "string" ? value : "SignalGraph request failed.";
}
