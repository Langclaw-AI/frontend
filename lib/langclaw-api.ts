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

export type ChatMode = "chat" | "onchain" | "research";

export type DirectChatUsage = ZeroGTokenUsage & {
  meter?: Record<string, unknown>;
  model: string;
  totalCostNeuron?: string;
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
  usage?: DirectChatUsage;
  error?: string;
};

export type OnChainDomain =
  | "token_discovery"
  | "market_data"
  | "pair_liquidity"
  | "wallet_portfolio"
  | "wallet_pnl"
  | "smart_money"
  | "defi_tvl"
  | "yield_pools"
  | "token_security"
  | "honeypot_detection"
  | "address_approval_risk"
  | "social_sentiment"
  | "raw_onchain_query"
  | "trading_signal_analysis";

export type OnChainProvider =
  | "alchemy"
  | "defillama"
  | "dexscreener"
  | "dune"
  | "etherscan"
  | "goplus"
  | "local";

export type OnChainPlanSummary = {
  intent: string;
  chain: string;
  chainId: number;
  commands: Array<{
    commandId: string;
    domain: OnChainDomain;
    provider: OnChainProvider;
    reason: string;
    title: string;
  }>;
  domainCount: number;
  query?: string;
  registryCommandCount: number;
  tokenAddress?: string;
  walletAddress?: string;
};

export type OnChainToolCallEvent = {
  commandId: string;
  domain: OnChainDomain;
  provider: OnChainProvider;
  reason: string;
  title: string;
};

export type OnChainToolResult = {
  commandId: string;
  data?: unknown;
  domain: OnChainDomain;
  error?: string;
  latencyMs: number;
  provider: OnChainProvider;
  sourceUrl?: string;
  status: "failed" | "skipped" | "success";
  summary: string;
  title: string;
};

export type OnChainToolFinalPayload = {
  answer: string;
  bullets: string[];
  caveat: string;
  generatedAt: string;
  plan: OnChainPlanSummary;
  recommendation: string;
  title: string;
  tools: OnChainToolResult[];
};

export type StoredChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  mode?: ChatMode;
  model?: string;
  result?: DiscoverPayload;
  directAnswer?: DirectChatPayload;
  onChain?: OnChainToolFinalPayload;
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
  message?: string;
  sessionExpiresAt?: string;
  sessionToken?: string;
  signature?: string;
};

export type WalletAuthPurpose = "api-key:create" | "session";

export type WalletChallenge = {
  address: string;
  chainId: number;
  domain: string;
  expiresAt: string;
  issuedAt: string;
  message: string;
  nonce: string;
  purpose: WalletAuthPurpose;
  uri: string;
};

export type ApiKeyRecord = {
  id: string;
  name: string;
  prefix?: string;
  suffix?: string;
  maskedKey: string;
  status: "active" | "revoked" | (string & {});
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
};

export type ApiKeyCreatePayload = {
  configured: true;
  key: ApiKeyRecord;
  secret: string;
};

export type AutomationTriggerType = "schedule" | "event" | "webhook";
export type AutomationFrequency = "daily" | "weekly" | "monthly";
export type AutomationTaskStatus = "draft" | "active" | "paused" | "archived";
export type AutomationRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "canceled";
export type AutomationTriggeredBy =
  | "schedule"
  | "event"
  | "webhook"
  | "manual"
  | "system";
export type AutomationNotificationChannel = "email" | "telegram" | "in-app";
export type AutomationInAppNotificationStatus = "unread" | "read";

export type AutomationSettings = {
  retryPolicy: "none" | "3-attempts" | "5-attempts";
  failureNotification: "email" | "in-app" | "none";
  notificationChannels: AutomationNotificationChannel[];
  notificationEmail?: string;
  notificationEmailLinkedAt?: string;
  notificationEmailPending?: string;
  notificationEmailVerified: boolean;
  telegramChatId?: string;
  telegramLinkedAt?: string;
  telegramUsername?: string;
  telegramVerified: boolean;
  autoPauseRepeatedFailures: boolean;
  writeRunLogsToMemory: boolean;
  dailyLimit0G: string;
  monthlyCap0G: string;
  limitBehavior: "pause" | "alert" | "allow";
  lowBalanceThreshold0G: string;
  thresholdAction: "notify" | "pause" | "continue";
};

export type AutomationTask = {
  id: string;
  name: string;
  project: string;
  prompt?: string;
  model?: string;
  triggerType: AutomationTriggerType;
  scheduleFrequency?: AutomationFrequency;
  scheduleTime: string;
  scheduleWeekday?: number;
  scheduleMonthDay?: number;
  timezone: string;
  eventName?: string;
  webhookSlug?: string;
  status: AutomationTaskStatus;
  displayStatus: "Draft" | "Active" | "Paused" | "Running";
  triggerLabel: string;
  lastRunAt?: string;
  lastRunStatus?: AutomationRunStatus;
  nextRunAt?: string;
  consecutiveFailures: number;
  maxRetries: number;
  failureThreshold: number;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
};

export type AutomationRun = {
  id: string;
  taskId: string;
  taskName?: string;
  status: AutomationRunStatus;
  triggeredBy: AutomationTriggeredBy;
  attempt: number;
  scheduledFor?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
  result?: unknown;
  usage?: unknown;
  createdAt: string;
};

export type AutomationInAppNotification = {
  id: string;
  title: string;
  body: string;
  status: AutomationInAppNotificationStatus;
  taskId?: string;
  runId?: string;
  metadata: unknown;
  readAt?: string;
  createdAt: string;
};

export type AutomationStats = {
  activeTasks: number;
  scheduledTasks: number;
  eventTasks: number;
  runningNow: number;
  successRate: number;
  nextRunAt?: string;
  nextRunTaskName?: string;
  pendingRuns: number;
  completedThisWeek: number;
};

export type MemoryStatus = "active" | "disabled";
export type MemoryCategory =
  | "Preference"
  | "Project"
  | "Workflow"
  | "Personal"
  | "API";

export type MemoryItem = {
  id: string;
  memory: string;
  category: MemoryCategory;
  scope: string;
  status: MemoryStatus;
  source: string;
  lastUsed: string;
  updatedAt: string;
  confidence: number;
};

export type MemoryStats = {
  active: number;
  disabled: number;
  projectScoped: number;
  total: number;
};

export type MemorySettings = {
  autoDisableLowConfidence: boolean;
  captureEnabled: boolean;
  crossChatRecall: boolean;
  projectScopedRecall: boolean;
  retentionDays: number;
  updatedAt: string;
};

export type MemoryDashboard = {
  configured: true;
  memories: MemoryItem[];
  settings: MemorySettings;
  stats: MemoryStats;
};

export type MemorySettingsInput = Partial<
  Pick<
    MemorySettings,
    | "autoDisableLowConfidence"
    | "captureEnabled"
    | "crossChatRecall"
    | "projectScopedRecall"
    | "retentionDays"
  >
>;

export type AutomationDashboard = {
  configured: true;
  notifications: AutomationInAppNotification[];
  tasks: AutomationTask[];
  recentRuns: AutomationRun[];
  settings: AutomationSettings;
  stats: AutomationStats;
};

export type AutomationTaskInput = {
  name?: string;
  project?: string;
  prompt?: string;
  model?: string;
  triggerType?: AutomationTriggerType;
  scheduleFrequency?: AutomationFrequency;
  scheduleTime?: string;
  scheduleWeekday?: number;
  scheduleMonthDay?: number;
  timezone?: string;
  eventName?: string;
  status?: Extract<AutomationTaskStatus, "draft" | "active" | "paused">;
};

export type AutomationSettingsInput = Partial<
  Pick<
    AutomationSettings,
    | "autoPauseRepeatedFailures"
    | "dailyLimit0G"
    | "failureNotification"
    | "limitBehavior"
    | "lowBalanceThreshold0G"
    | "monthlyCap0G"
    | "notificationChannels"
    | "notificationEmail"
    | "retryPolicy"
    | "telegramChatId"
    | "thresholdAction"
    | "writeRunLogsToMemory"
  >
>;

export type ChatStreamInput = {
  message: string;
  messages?: Array<Pick<StoredChatMessage, "role" | "content">>;
  model?: string;
  researchTrend?: boolean;
  sessionId?: string;
  toolMode?: ChatMode;
  wallet?: WalletAuth;
  signal?: AbortSignal;
  onDirectDelta?: (delta: string) => void;
  onDirect?: (payload: DirectChatPayload) => void;
  onMode?: (mode: string) => void;
  onToolCall?: (event: OnChainToolCallEvent) => void;
  onToolFinal?: (payload: OnChainToolFinalPayload) => void;
  onToolPlan?: (plan: OnChainPlanSummary) => void;
  onToolResult?: (event: OnChainToolResult) => void;
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
      type: "tool_plan";
      plan?: OnChainPlanSummary;
    }
  | {
      type: "tool_call";
      event?: OnChainToolCallEvent;
    }
  | {
      type: "tool_result";
      event?: OnChainToolResult;
    }
  | {
      type: "tool_final";
      payload?: OnChainToolFinalPayload;
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

type ApiKeysResponse =
  | {
      configured: false;
      error?: string;
    }
  | {
      configured: true;
      error?: string;
      key?: ApiKeyRecord;
      keys?: ApiKeyRecord[];
      secret?: string;
    };

type AutomationResponse<T> = T & {
  configured?: boolean;
  error?: string;
};

type MemoryResponse =
  | {
      configured: false;
      error?: string;
    }
  | {
      configured: true;
      deleted?: boolean;
      deletedIds?: string[];
      error?: string;
      memories?: MemoryItem[];
      memory?: MemoryItem;
      settings?: MemorySettings;
      stats?: MemoryStats;
    };

const DEFAULT_BACKEND_URL =
  process.env.NODE_ENV === "production"
    ? "https://nanta.tech:3002"
    : "http://localhost:3001";

export const CHAT_SESSIONS_UPDATED_EVENT = "langclaw-chat-sessions-updated";

export class LangclawApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "LangclawApiError";
    this.status = status;
  }
}

export function getLangclawApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_LANGCLAW_API_URL?.replace(/\/+$/, "") ||
    DEFAULT_BACKEND_URL
  );
}

export function getLangclawApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getLangclawApiBaseUrl()}${normalizedPath}`;
}

export async function checkBackendHealth() {
  const response = await getRequest("/health");

  return readJsonResponse<{ ok: boolean; service: string }>(response);
}

export async function requestWalletChallenge(input: {
  address: string;
  chainId?: number;
  purpose?: WalletAuthPurpose;
}) {
  const response = await postJson("/api/wallet/challenge", input);
  const payload = await readJsonResponse<{
    challenge?: WalletChallenge;
    configured: true;
    error?: string;
  }>(response);

  if (payload.error) {
    throw new LangclawApiError(payload.error, response.status);
  }

  if (!payload.challenge) {
    throw new LangclawApiError("Wallet challenge was not returned.", 500);
  }

  return payload.challenge;
}

export async function createWalletSession(wallet: WalletAuth) {
  const response = await postJson("/api/wallet/session", { wallet });
  const payload = await readJsonResponse<{
    configured: true;
    error?: string;
    wallet?: WalletAuth;
  }>(response);

  if (payload.error) {
    throw new LangclawApiError(payload.error, response.status);
  }

  if (!payload.wallet?.sessionToken) {
    throw new LangclawApiError("Wallet session was not returned.", 500);
  }

  return payload.wallet;
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
  const toolMode = input.toolMode ?? (input.researchTrend ? "research" : "chat");
  const response = await postJson(
    "/api/chat/stream",
    {
      message: input.message,
      messages: input.messages ?? [],
      model: input.model,
      researchTrend: toolMode === "research",
      sessionId: input.sessionId,
      toolMode,
      useAgent: toolMode === "research",
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

    if (chunk.type === "tool_plan") {
      if (chunk.plan) {
        input.onToolPlan?.(chunk.plan);
      }
      return;
    }

    if (chunk.type === "tool_call") {
      if (chunk.event) {
        input.onToolCall?.(chunk.event);
      }
      return;
    }

    if (chunk.type === "tool_result") {
      if (chunk.event) {
        input.onToolResult?.(chunk.event);
      }
      return;
    }

    if (chunk.type === "tool_final") {
      if (chunk.payload) {
        input.onToolFinal?.(chunk.payload);
      }
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

export async function updateChatSessionMetadata(
  wallet: WalletAuth,
  input: {
    pinned?: boolean;
    sessionId: string;
    title?: string;
  },
) {
  const response = await chatSessionsRequest({
    action: "update",
    pinned: input.pinned,
    sessionId: input.sessionId,
    title: input.title,
    wallet,
  });

  return response.session ?? null;
}

export async function listApiKeys(wallet: WalletAuth) {
  const response = await apiKeysRequest({ action: "list", wallet });

  return response.keys ?? [];
}

export async function createApiKey(wallet: WalletAuth, name: string) {
  const response = await apiKeysRequest({ action: "create", name, wallet });

  if (!response.key || !response.secret) {
    throw new LangclawApiError("API key was not returned.", 500);
  }

  return {
    configured: true,
    key: response.key,
    secret: response.secret,
  } satisfies ApiKeyCreatePayload;
}

export async function revokeApiKey(wallet: WalletAuth, keyId: string) {
  const response = await apiKeysRequest({ action: "revoke", keyId, wallet });

  if (!response.key) {
    throw new LangclawApiError("API key was not returned.", 500);
  }

  return response.key;
}

export async function getMemoryDashboard(wallet: WalletAuth) {
  const response = await memoryRequest({ action: "list", wallet });

  return {
    configured: true,
    memories: response.memories ?? [],
    settings: requireMemorySettings(response.settings),
    stats: response.stats ?? buildMemoryStats(response.memories ?? []),
  } satisfies MemoryDashboard;
}

export async function setMemoryStatus(
  wallet: WalletAuth,
  memoryId: string,
  status: MemoryStatus,
) {
  const response = await memoryRequest({
    action: "status",
    memoryId,
    status,
    wallet,
  });

  if (!response.memory) {
    throw new LangclawApiError("Memory was not returned.", 500);
  }

  return response.memory;
}

export async function setManyMemoryStatuses(
  wallet: WalletAuth,
  memoryIds: string[],
  status: MemoryStatus,
) {
  const response = await memoryRequest({
    action: "bulk-status",
    memoryIds,
    status,
    wallet,
  });

  return response.memories ?? [];
}

export async function deleteMemoryRecord(
  wallet: WalletAuth,
  memoryId: string,
) {
  const response = await memoryRequest({
    action: "delete",
    memoryId,
    wallet,
  });

  return response.deletedIds ?? (response.deleted ? [memoryId] : []);
}

export async function deleteManyMemoryRecords(
  wallet: WalletAuth,
  memoryIds: string[],
) {
  const response = await memoryRequest({
    action: "bulk-delete",
    memoryIds,
    wallet,
  });

  return response.deletedIds ?? [];
}

export async function getMemorySettings(wallet: WalletAuth) {
  const response = await memorySettingsRequest({ action: "get", wallet });

  return requireMemorySettings(response.settings);
}

export async function updateMemorySettings(
  wallet: WalletAuth,
  settings: MemorySettingsInput,
) {
  const response = await memorySettingsRequest({
    action: "update",
    settings,
    wallet,
  });

  return requireMemorySettings(response.settings);
}

export async function getAutomationDashboard(wallet: WalletAuth) {
  const response = await postJson("/api/automation/tasks", {
    action: "list",
    wallet,
  });

  return readAutomationResponse<AutomationDashboard>(response);
}

export async function createAutomationTask(
  wallet: WalletAuth,
  task: AutomationTaskInput,
) {
  const response = await postJson("/api/automation/tasks", {
    action: "create",
    task,
    wallet,
  });
  const payload = await readAutomationResponse<{ task: AutomationTask }>(
    response,
  );

  return payload.task;
}

export async function updateAutomationTask(
  wallet: WalletAuth,
  taskId: string,
  task: AutomationTaskInput,
) {
  const response = await postJson("/api/automation/tasks", {
    action: "update",
    task,
    taskId,
    wallet,
  });
  const payload = await readAutomationResponse<{ task: AutomationTask }>(
    response,
  );

  return payload.task;
}

export async function setAutomationTaskStatus(
  wallet: WalletAuth,
  taskId: string,
  status: Extract<AutomationTaskStatus, "active" | "paused">,
) {
  const response = await postJson("/api/automation/tasks", {
    action: status === "active" ? "resume" : "pause",
    taskId,
    wallet,
  });
  const payload = await readAutomationResponse<{ task: AutomationTask }>(
    response,
  );

  return payload.task;
}

export async function deleteAutomationTask(
  wallet: WalletAuth,
  taskId: string,
) {
  const response = await postJson("/api/automation/tasks", {
    action: "delete",
    taskId,
    wallet,
  });
  const payload = await readAutomationResponse<{ deleted?: boolean }>(response);

  return Boolean(payload.deleted);
}

export async function setAllAutomationTasksStatus(
  wallet: WalletAuth,
  status: Extract<AutomationTaskStatus, "active" | "paused">,
) {
  const response = await postJson("/api/automation/tasks", {
    action: status === "active" ? "resume-all" : "pause-all",
    wallet,
  });
  const payload = await readAutomationResponse<{ tasks: AutomationTask[] }>(
    response,
  );

  return payload.tasks ?? [];
}

export async function runAutomationTask(wallet: WalletAuth, taskId: string) {
  const response = await postJson("/api/automation/runs", {
    action: "run",
    taskId,
    triggeredBy: "manual",
    wallet,
  });
  const payload = await readAutomationResponse<{ run: AutomationRun }>(
    response,
  );

  return payload.run;
}

export async function listAutomationRuns(wallet: WalletAuth, taskId?: string) {
  const response = await postJson("/api/automation/runs", {
    action: "list",
    taskId,
    wallet,
  });
  const payload = await readAutomationResponse<{ runs: AutomationRun[] }>(
    response,
  );

  return payload.runs ?? [];
}

export async function getAutomationSettings(wallet: WalletAuth) {
  const response = await postJson("/api/automation/settings", {
    action: "get",
    wallet,
  });
  const payload = await readAutomationResponse<{
    settings: AutomationSettings;
  }>(response);

  return payload.settings;
}

export async function updateAutomationSettings(
  wallet: WalletAuth,
  settings: AutomationSettingsInput,
) {
  const response = await postJson("/api/automation/settings", {
    action: "update",
    settings,
    wallet,
  });
  const payload = await readAutomationResponse<{
    settings: AutomationSettings;
  }>(response);

  return payload.settings;
}

export async function listInAppAutomationNotifications(
  wallet: WalletAuth,
  limit = 20,
) {
  const response = await postJson("/api/automation/notifications", {
    action: "list-in-app",
    limit,
    wallet,
  });
  const payload = await readAutomationResponse<{
    notifications: AutomationInAppNotification[];
  }>(response);

  return payload.notifications ?? [];
}

export async function markAutomationNotificationRead(
  wallet: WalletAuth,
  notificationId: string,
) {
  const response = await postJson("/api/automation/notifications", {
    action: "mark-in-app-read",
    notificationId,
    wallet,
  });
  const payload = await readAutomationResponse<{
    notification: AutomationInAppNotification;
  }>(response);

  return payload.notification;
}

export async function markAllAutomationNotificationsRead(wallet: WalletAuth) {
  const response = await postJson("/api/automation/notifications", {
    action: "mark-all-in-app-read",
    wallet,
  });
  const payload = await readAutomationResponse<{ read?: boolean }>(response);

  return Boolean(payload.read);
}

export async function requestAutomationEmailLink(
  wallet: WalletAuth,
  email: string,
) {
  const response = await postJson("/api/automation/notifications", {
    action: "request-email-link",
    email,
    wallet,
  });

  return readAutomationResponse<{
    link: { email: string; expiresAt: string; sent: boolean };
  }>(response);
}

export async function verifyAutomationEmailLink(
  wallet: WalletAuth,
  code: string,
) {
  const response = await postJson("/api/automation/notifications", {
    action: "verify-email-link",
    code,
    wallet,
  });
  const payload = await readAutomationResponse<{
    settings: AutomationSettings;
  }>(response);

  return payload.settings;
}

export async function createAutomationTelegramLink(wallet: WalletAuth) {
  const response = await postJson("/api/automation/notifications", {
    action: "create-telegram-link",
    wallet,
  });
  const payload = await readAutomationResponse<{
    link: { code: string; command: string; expiresAt: string };
  }>(response);

  return payload.link;
}

export async function pollAutomationTelegramLink(wallet: WalletAuth) {
  const response = await postJson("/api/automation/notifications", {
    action: "poll-telegram-link",
    wallet,
  });

  return readAutomationResponse<{
    linked: boolean;
    settings?: AutomationSettings;
    status: string;
  }>(response);
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
    walletAuthHeaders(wallet),
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
    getLangclawApiUrl("/api/0g/audio/transcriptions"),
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
  action: "delete" | "get" | "list" | "update" | "upsert";
  pinned?: boolean;
  wallet: WalletAuth;
  sessionId?: string;
  session?: ChatSession;
  title?: string;
}) {
  const response = await postJson("/api/chat/sessions", body);
  const payload = await readJsonResponse<ChatSessionsResponse>(response);

  if (!payload.configured) {
    throw new LangclawApiError(
      payload.error || "Chat session storage is not configured.",
      503,
    );
  }

  if (payload.error) {
    throw new LangclawApiError(payload.error, response.status);
  }

  return payload;
}

async function apiKeysRequest(body: {
  action: "create" | "list" | "revoke";
  keyId?: string;
  name?: string;
  wallet: WalletAuth;
}) {
  const response = await postJson("/api/api-keys", body);
  const payload = await readJsonResponse<ApiKeysResponse>(response);

  if (!payload.configured) {
    throw new LangclawApiError(
      payload.error || "API keys are not configured.",
      503,
    );
  }

  if (payload.error) {
    throw new LangclawApiError(payload.error, response.status);
  }

  return payload;
}

async function memoryRequest(body: {
  action: "bulk-delete" | "bulk-status" | "delete" | "list" | "status";
  memoryId?: string;
  memoryIds?: string[];
  status?: MemoryStatus;
  wallet: WalletAuth;
}) {
  const response = await postJson("/api/memory", body);
  const payload = await readJsonResponse<MemoryResponse>(response);

  if (!payload.configured) {
    throw new LangclawApiError(
      payload.error || "Memory storage is not configured.",
      503,
    );
  }

  if (payload.error) {
    throw new LangclawApiError(payload.error, response.status);
  }

  return payload;
}

async function memorySettingsRequest(body: {
  action: "get" | "update";
  settings?: MemorySettingsInput;
  wallet: WalletAuth;
}) {
  const response = await postJson("/api/memory/settings", body);
  const payload = await readJsonResponse<MemoryResponse>(response);

  if (!payload.configured) {
    throw new LangclawApiError(
      payload.error || "Memory settings are not configured.",
      503,
    );
  }

  if (payload.error) {
    throw new LangclawApiError(payload.error, response.status);
  }

  return payload;
}

async function readAutomationResponse<T>(response: Response) {
  const payload = await readJsonResponse<AutomationResponse<T>>(response);

  if (payload.error) {
    throw new LangclawApiError(payload.error, response.status);
  }

  return payload as T;
}

function requireMemorySettings(settings?: MemorySettings) {
  if (!settings) {
    throw new LangclawApiError("Memory settings were not returned.", 500);
  }

  return settings;
}

function buildMemoryStats(memories: MemoryItem[]): MemoryStats {
  return {
    active: memories.filter((memory) => memory.status === "active").length,
    disabled: memories.filter((memory) => memory.status === "disabled").length,
    projectScoped: memories.filter((memory) => memory.scope !== "Global").length,
    total: memories.length,
  };
}

export function readFriendlyError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof LangclawApiError ? error.status : 0;

  if (status === 402 || /insufficient\s+0g\s+balance/i.test(message)) {
    return "Insufficient 0G balance. Add 0G credits before running this request.";
  }

  if (/wallet signature or api key is required/i.test(message)) {
    return "Connect and approve your wallet to continue.";
  }

  if (/wallet signature is required/i.test(message)) {
    return "Approve the wallet prompt to continue.";
  }

  if (/supabase/i.test(message)) {
    return "Account storage is not ready yet. Check backend configuration.";
  }

  return message || fallback;
}

async function getRequest(
  path: string,
  headers?: Record<string, string>,
  signal?: AbortSignal,
) {
  return fetch(getLangclawApiUrl(path), {
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

function walletAuthHeaders(wallet: WalletAuth) {
  const headers: Record<string, string> = {
    "X-Langclaw-Wallet-Address": wallet.address,
  };

  if (wallet.sessionToken) {
    headers["X-Langclaw-Wallet-Session"] = wallet.sessionToken;
  }

  if (wallet.message) {
    headers["X-Langclaw-Wallet-Message"] = wallet.message;
  }

  if (wallet.signature) {
    headers["X-Langclaw-Wallet-Signature"] = wallet.signature;
  }

  return headers;
}

async function postJson(path: string, body: unknown, signal?: AbortSignal) {
  return fetch(getLangclawApiUrl(path), {
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
    throw new LangclawApiError(
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
    throw new LangclawApiError(
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
  return normalizeError(value) || "Langclaw request failed.";
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
