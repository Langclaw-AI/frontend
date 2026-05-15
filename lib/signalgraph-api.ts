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
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
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
    sourceIds: string[];
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

export type FinalAnswerMeta = {
  synthesis: "0g-compute" | "openclaw-ai" | "deterministic-fallback";
  execution?: StepExecution;
  model?: string;
  requestedModel?: string;
  usedModel?: string;
  modelHonored?: boolean;
  sessionId?: string;
  transport?: string;
  fallbackFrom?: string;
  error?: string;
};

export type ZeroGStorageStatus = "prepared" | "uploaded" | "skipped" | "failed";
export type ZeroGChainStatus = "prepared" | "anchored" | "skipped" | "failed";
export type ZeroGComputeStatus = "used" | "skipped" | "failed";

export type ZeroGTokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  maxTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type ZeroGComputeBilling = {
  inputCostNeuron?: string;
  outputCostNeuron?: string;
  totalCostNeuron?: string;
  source: "router-trace" | "token-estimate" | "reserved-estimate";
};

export type ZeroGTeeVerification = {
  requested: boolean;
  routerVerified?: boolean | null;
  independentVerified?: boolean | null;
  status:
    | "not-requested"
    | "router-verified"
    | "router-unverified"
    | "router-missing"
    | "independent-verified"
    | "independent-failed"
    | "independent-unavailable"
    | "independent-error";
  chatId?: string;
  error?: string;
};

export type ZeroGProof = {
  storage: {
    status: ZeroGStorageStatus;
    evidenceUri: string;
    rootHash?: string;
    txHash?: string;
    explorerUrl?: string;
    indexerRpc?: string;
    error?: string;
  };
  chain: {
    status: ZeroGChainStatus;
    briefHash: string;
    txHash?: string;
    explorerUrl?: string;
    registryAddress?: string;
    chainId?: number;
    error?: string;
  };
  compute?: {
    status: ZeroGComputeStatus;
    model?: string;
    requestedModel?: string;
    usedModel?: string;
    modelHonored?: boolean;
    fallbackFrom?: string;
    endpoint?: string;
    chatId?: string;
    requestId?: string;
    provider?: string;
    teeVerified?: boolean | null;
    teeVerification?: ZeroGTeeVerification;
    usage?: ZeroGTokenUsage;
    billing?: ZeroGComputeBilling;
    error?: string;
  };
};

export type ModelUsageReceipt = {
  wallet: string;
  model: string;
  requestId?: string;
  provider?: string;
  teeVerified?: boolean | null;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  maxTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  promptPriceNeuron: string;
  completionPriceNeuron: string;
  reservedNeuron: string;
  rawCostNeuron: string;
  markupBps: number;
  markupNeuron: string;
  chargedNeuron: string;
  releasedNeuron: string;
  balanceBefore: string;
  balanceAfter: string;
  costSource: "router-trace" | "token-estimate" | "reserved-estimate";
  totalCostNeuron?: string;
  status: "charged" | "estimated" | "refunded" | "failed_after_charge";
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
  finalAnswerMeta?: FinalAnswerMeta;
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
      storageStatus: ZeroGStorageStatus;
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
      storageStatus: ZeroGStorageStatus;
      chainStatus: ZeroGChainStatus;
      chainTxHash?: string;
      chainExplorerUrl?: string;
      registryAddress?: string;
      error?: string;
    };
  };
  zeroG?: ZeroGProof;
  usage?: ModelUsageReceipt;
};

export type DirectChatPayload = {
  answer: string;
  model?: string;
  requestedModel?: string;
  usedModel?: string;
  fallbackFrom?: string;
  modelHonored?: boolean;
  source?: "0g-compute" | "fallback";
  teeVerified?: boolean | null;
  teeVerification?: ZeroGTeeVerification;
  title?: string;
  error?: string;
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
  wallet?: WalletAuth;
  signal?: AbortSignal;
  onDirectDelta?: (delta: string) => void;
  onDirect?: (payload: DirectChatPayload) => void;
  onMode?: (mode: string) => void;
  onProgress?: (event: WorkflowProgressEvent) => void;
  onResult?: (payload: DiscoverPayload) => void;
  onError?: (message: string) => void;
};

export type ChatStreamChunk =
  | {
      type: "direct_delta";
      delta?: string;
    }
  | {
      type: "direct";
      payload?: DirectChatPayload;
    }
  | {
      type: "mode";
      mode?: string;
    }
  | {
      type: "progress";
      event?: WorkflowProgressEvent;
    }
  | {
      type: "result";
      payload?: DiscoverPayload;
    }
  | {
      type: "error";
      error?: string;
    };

export type DiscoverStreamInput = {
  topic: string;
  wallet?: WalletAuth;
  signal?: AbortSignal;
  onProgress?: (event: WorkflowProgressEvent) => void;
  onResult?: (payload: DiscoverPayload) => void;
  onError?: (message: string) => void;
};

export type DiscoverStreamChunk =
  | {
      type: "progress";
      event?: WorkflowProgressEvent;
    }
  | {
      type: "result";
      payload?: DiscoverPayload;
    }
  | {
      type: "error";
      error?: string;
    };

export type UsageBalance = {
  availableNeuron: string;
  available0G: string;
  reservedNeuron: string;
  reserved0G: string;
  lifetimeDepositedNeuron: string;
  lifetimeDeposited0G: string;
  lifetimeChargedNeuron: string;
  lifetimeCharged0G: string;
};

export type UsageQuote = {
  model: string;
  endpoint: string;
  promptPriceNeuron: string;
  completionPriceNeuron: string;
  imagePriceNeuron?: string;
  promptPriceUsd?: string;
  completionPriceUsd?: string;
  imagePriceUsd?: string;
  estimatedPromptTokens: number;
  estimatedCompletionTokens: number;
  estimatedCostNeuron: string;
  estimatedCost0G: string;
  priceFetchedAt: string;
};

export type UsageBalancePayload = {
  configured: true;
  wallet: string;
  balance: UsageBalance;
  quote?: UsageQuote;
};

export type UsageQuotePayload = {
  configured: true;
  quote: UsageQuote;
};

export type UsageDepositVerifyPayload = {
  configured: true;
  wallet: string;
  txHash: string;
  amountNeuron: string;
  amount0G: string;
  credited: boolean;
  balanceBefore: string;
  balanceAfter: string;
};

export type UsageWithdrawRequestPayload = {
  configured: true;
  wallet: string;
  vaultAddress: string;
  functionName: "withdraw";
  balance: UsageBalance;
  note: string;
};

export type RouterPricing = {
  prompt?: string;
  completion?: string;
  image?: string;
  [key: string]: string | undefined;
};

export type RouterModel = {
  id: string;
  name?: string;
  type?: string;
  context_length?: number;
  max_completion_tokens?: number;
  supported_parameters?: string[];
  supported_formats?: string[];
  pricing?: RouterPricing;
  pricing_usd?: RouterPricing;
  provider_count?: number;
  [key: string]: unknown;
};

export type RouterModelsPayload = {
  object: "list";
  data: RouterModel[];
};

export type RouterProviderSelection = Record<string, unknown>;
export type RouterProvidersPayload = unknown;

export type RouterTrace = {
  requestId?: string;
  provider?: string;
  billing?: {
    inputCostNeuron?: string;
    outputCostNeuron?: string;
    totalCostNeuron?: string;
    [key: string]: unknown;
  };
  chatId?: string;
  teeVerified?: boolean | null;
  [key: string]: unknown;
};

export type ZeroGChatMessage = {
  role: "system" | "user" | "assistant" | "tool" | (string & {});
  content: unknown;
  [key: string]: unknown;
};

export type ZeroGChatCompletionInput = Record<string, unknown> & {
  messages: ZeroGChatMessage[];
  model?: string;
  provider?: RouterProviderSelection;
  stream?: boolean;
  verify_tee?: boolean | string;
  wallet?: WalletAuth;
};

export type ZeroGChatCompletionPayload = Record<string, unknown> & {
  usage?: ModelUsageReceipt;
};

export type ZeroGChatStreamResult = {
  answer: string;
  model?: string;
  trace?: RouterTrace;
  usage?: ModelUsageReceipt;
};

export type ZeroGChatStreamChunk =
  | {
      type: "delta";
      delta?: string;
    }
  | {
      type: "result";
      payload?: ZeroGChatStreamResult;
    }
  | {
      type: "error";
      error?: string;
    };

export type ZeroGImageInput = Record<string, unknown> & {
  model?: string;
  prompt: string;
  n?: number;
  provider?: RouterProviderSelection;
  response_format?: "b64_json";
  size?: string;
  verify_tee?: boolean | string;
  wallet?: WalletAuth;
};

export type ZeroGImagePayload = Record<string, unknown> & {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
    [key: string]: unknown;
  }>;
  usage?: ModelUsageReceipt;
};

export type ZeroGAsyncImagePayload = Record<string, unknown> & {
  id?: string;
  job_id?: string;
  status?: string;
  billing?: {
    reservationId: string;
    reservedNeuron: string;
    status: "reserved";
  };
};

export type ZeroGAsyncJobInput = {
  jobId: string;
  reservationId: string;
  model?: string;
  providerAddress?: string;
  verifyTee?: boolean;
  wallet: WalletAuth;
  signal?: AbortSignal;
};

export type ZeroGAsyncJobPayload = Record<string, unknown> & {
  status?: string;
  data?: unknown;
  billing?: ZeroGAsyncImagePayload["billing"];
  usage?: ModelUsageReceipt;
};

export type ZeroGAudioTranscriptionInput = {
  file: File;
  wallet: WalletAuth;
  model?: string;
  language?: string;
  prompt?: string;
  response_format?: string;
  temperature?: number;
  verifyTee?: boolean;
  signal?: AbortSignal;
};

export type ZeroGAudioTranscriptionPayload = Record<string, unknown> & {
  text?: string;
  usage?: ModelUsageReceipt;
};

export type ZeroGAdminQuery = Record<
  string,
  string | number | boolean | undefined
>;

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
  const response = await getRequest("/health");

  return readJsonResponse<{ ok: boolean; service: string }>(response);
}

export async function runDiscover(input: {
  topic: string;
  wallet?: WalletAuth;
  signal?: AbortSignal;
}) {
  const response = await postJson(
    "/api/discover",
    { topic: input.topic, wallet: input.wallet },
    input.signal,
  );

  return readJsonResponse<DiscoverPayload>(response);
}

export async function streamDiscover(input: DiscoverStreamInput) {
  const response = await postJson(
    "/api/discover/stream",
    { topic: input.topic, wallet: input.wallet },
    input.signal,
  );

  await readNdjson<DiscoverStreamChunk>(response, (chunk) => {
    if (chunk.type === "progress") {
      if (chunk.event) {
        input.onProgress?.(chunk.event);
      }
      return;
    }

    if (chunk.type === "result") {
      if (chunk.payload) {
        input.onResult?.(chunk.payload);
      }
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
      wallet: input.wallet,
    },
    input.signal,
  );

  await readNdjson<ChatStreamChunk>(response, (chunk) => {
    if (chunk.type === "direct_delta") {
      input.onDirectDelta?.(typeof chunk.delta === "string" ? chunk.delta : "");
      return;
    }

    if (chunk.type === "direct") {
      if (chunk.payload) {
        input.onDirect?.(chunk.payload);
      }
      return;
    }

    if (chunk.type === "mode") {
      input.onMode?.(typeof chunk.mode === "string" ? chunk.mode : "");
      return;
    }

    if (chunk.type === "progress") {
      if (chunk.event) {
        input.onProgress?.(chunk.event);
      }
      return;
    }

    if (chunk.type === "result") {
      if (chunk.payload) {
        input.onResult?.(chunk.payload);
      }
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
  session: ChatSession,
) {
  const response = await chatSessionsRequest({
    action: "upsert",
    session,
    wallet,
  });

  return response.session ?? null;
}

export async function deleteChatSession(wallet: WalletAuth, sessionId: string) {
  const response = await chatSessionsRequest({
    action: "delete",
    sessionId,
    wallet,
  });

  return Boolean(response.deleted);
}

export async function getUsageBalance(wallet: WalletAuth) {
  const response = await postJson("/api/usage/balance", { wallet });

  return readJsonResponse<UsageBalancePayload>(response);
}

export async function getUsageQuote() {
  const response = await postJson("/api/usage/quote", {});

  return readJsonResponse<UsageQuotePayload>(response);
}

export async function verifyUsageDeposit(input: {
  reference?: string;
  txHash: string;
  wallet: WalletAuth;
}) {
  const response = await postJson("/api/usage/deposit/verify", input);

  return readJsonResponse<UsageDepositVerifyPayload>(response);
}

export async function requestUsageWithdraw(wallet: WalletAuth) {
  const response = await postJson("/api/usage/withdraw/request", { wallet });

  return readJsonResponse<UsageWithdrawRequestPayload>(response);
}

export async function listZeroGModels() {
  const response = await getRequest("/api/0g/models");

  return readJsonResponse<RouterModelsPayload>(response);
}

export async function listZeroGProviders(
  params: {
    model?: string;
    model_id?: string;
    service_type?: string;
  } = {},
) {
  const response = await getRequest(
    `/api/0g/providers${toQueryString(params)}`,
  );

  return readJsonResponse<RouterProvidersPayload>(response);
}

export async function createZeroGChatCompletion(
  input: ZeroGChatCompletionInput,
  signal?: AbortSignal,
) {
  const response = await postJson(
    "/api/0g/chat/completions",
    { ...input, stream: false },
    signal,
  );

  return readJsonResponse<ZeroGChatCompletionPayload>(response);
}

export async function streamZeroGChatCompletion(input: {
  request: ZeroGChatCompletionInput;
  signal?: AbortSignal;
  onDelta?: (delta: string) => void;
  onResult?: (payload: ZeroGChatStreamResult) => void;
  onError?: (message: string) => void;
}) {
  const response = await postJson(
    "/api/0g/chat/completions",
    { ...input.request, stream: true },
    input.signal,
  );

  await readNdjson<ZeroGChatStreamChunk>(response, (chunk) => {
    if (chunk.type === "delta") {
      input.onDelta?.(typeof chunk.delta === "string" ? chunk.delta : "");
      return;
    }

    if (chunk.type === "result") {
      if (chunk.payload) {
        input.onResult?.(chunk.payload);
      }
      return;
    }

    if (chunk.type === "error") {
      input.onError?.(readErrorMessage(chunk.error));
    }
  });
}

export async function generateZeroGImage(
  input: ZeroGImageInput,
  signal?: AbortSignal,
) {
  const response = await postJson(
    "/api/0g/images/generations",
    { ...input, response_format: "b64_json" },
    signal,
  );

  return readJsonResponse<ZeroGImagePayload>(response);
}

export async function submitZeroGAsyncImage(
  input: ZeroGImageInput,
  signal?: AbortSignal,
) {
  const response = await postJson(
    "/api/0g/async/images/generations",
    { ...input, response_format: "b64_json" },
    signal,
  );

  return readJsonResponse<ZeroGAsyncImagePayload>(response);
}

export async function getZeroGAsyncJob({
  jobId,
  model,
  providerAddress,
  reservationId,
  signal,
  verifyTee,
  wallet,
}: ZeroGAsyncJobInput) {
  const response = await getRequest(
    `/api/0g/async/jobs/${encodeURIComponent(jobId)}${toQueryString({
      model,
      provider_address: providerAddress,
      reservation_id: reservationId,
      verify_tee: verifyTee ? "true" : undefined,
    })}`,
    {
      "X-Langclaw-Wallet-Address": wallet.address,
      "X-Langclaw-Wallet-Message": wallet.message,
      "X-Langclaw-Wallet-Signature": wallet.signature,
    },
    signal,
  );

  return readJsonResponse<ZeroGAsyncJobPayload>(response);
}

export async function transcribeZeroGAudio({
  file,
  language,
  model,
  prompt,
  response_format,
  signal,
  temperature,
  verifyTee,
  wallet,
}: ZeroGAudioTranscriptionInput) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("wallet", JSON.stringify(wallet));

  if (model) {
    formData.set("model", model);
  }

  if (language) {
    formData.set("language", language);
  }

  if (prompt) {
    formData.set("prompt", prompt);
  }

  if (response_format) {
    formData.set("response_format", response_format);
  }

  if (temperature !== undefined) {
    formData.set("temperature", String(temperature));
  }

  if (verifyTee !== undefined) {
    formData.set("verify_tee", verifyTee ? "true" : "false");
  }

  const response = await fetch(
    getSignalGraphApiUrl("/api/0g/audio/transcriptions"),
    {
      body: formData,
      method: "POST",
      signal,
    },
  );

  return readJsonResponse<ZeroGAudioTranscriptionPayload>(response);
}

export async function getZeroGAdminAccountBalance(adminKey: string) {
  const response = await getAdminRequest(
    "/api/0g/admin/account/balance",
    adminKey,
  );

  return readJsonResponse<Record<string, unknown>>(response);
}

export async function getZeroGAdminUsageStats(
  adminKey: string,
  query: ZeroGAdminQuery = {},
) {
  const response = await getAdminRequest(
    `/api/0g/admin/account/usage/stats${toQueryString(query)}`,
    adminKey,
  );

  return readJsonResponse<Record<string, unknown>>(response);
}

export async function getZeroGAdminUsageHistory(
  adminKey: string,
  query: ZeroGAdminQuery = {},
) {
  const response = await getAdminRequest(
    `/api/0g/admin/account/usage/history${toQueryString(query)}`,
    adminKey,
  );

  return readJsonResponse<Record<string, unknown>>(response);
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
      503,
    );
  }

  if (payload.error) {
    throw new SignalGraphApiError(payload.error, response.status);
  }

  return payload;
}

async function getRequest(
  path: string,
  headers?: Record<string, string>,
  signal?: AbortSignal,
) {
  return fetch(getSignalGraphApiUrl(path), {
    cache: "no-store",
    headers,
    signal,
  });
}

async function getAdminRequest(path: string, adminKey: string) {
  return getRequest(path, {
    "X-Langclaw-Admin-Key": adminKey,
  });
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
  const payload = (await response.json().catch(() => null)) as {
    error?: unknown;
  } | null;

  if (!response.ok) {
    throw new SignalGraphApiError(
      normalizeError(payload?.error) ||
        `Request failed with status ${response.status}.`,
      response.status,
    );
  }

  return payload as T;
}

async function readNdjson<TChunk>(
  response: Response,
  onChunk: (chunk: TChunk) => void,
) {
  if (!response.ok) {
    await readJsonResponse(response);
    return;
  }

  if (!response.body) {
    throw new SignalGraphApiError(
      "Streaming response was empty.",
      response.status,
    );
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

      onChunk(JSON.parse(trimmed) as TChunk);
    }
  }

  const remaining = buffer.trim();

  if (remaining) {
    onChunk(JSON.parse(remaining) as TChunk);
  }
}

function readErrorMessage(value: unknown) {
  return normalizeError(value) || "SignalGraph request failed.";
}

function normalizeError(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (typeof record.message === "string") {
      return record.message;
    }

    if (typeof record.error === "string") {
      return record.error;
    }
  }

  return "";
}

function toQueryString(params: Record<string, unknown>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    search.set(key, String(value));
  }

  const value = search.toString();

  return value ? `?${value}` : "";
}
