"use client";

import { useChat } from "@ai-sdk/react";
import {
  ActivityIcon,
  CopyIcon,
  InfoIcon,
  MessageSquareIcon,
  RefreshCcwIcon,
  SearchIcon,
} from "lucide-react";
import {
  Fragment,
  type ComponentType,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Confirmation,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRequest,
  ConfirmationTitle,
} from "@/components/ai-elements/confirmation";
import {
  Context,
  ContextContent,
  ContextContentBody,
  ContextContentHeader,
  ContextTrigger,
} from "@/components/ai-elements/context";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { SpeechInput } from "@/components/ai-elements/speech-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolOutput,
  type ToolPart,
} from "@/components/ai-elements/tool";
import {
  Transcription,
  TranscriptionSegment,
} from "@/components/ai-elements/transcription";
import {
  DiscoverDetails,
  isWorkflowStreaming,
  StatusPill,
  WorkflowPlan,
} from "@/components/LangclawResult";
import { ButtonGroup } from "@/components/ui/button-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  consumePendingPrompt,
  createChatSession,
  getUIMessageText,
  type LangclawUIMessage,
  markLatestAssistantStopped,
  storedMessagesToUIMessages,
  updateSessionMessages,
  uiMessagesToStoredMessages,
} from "@/lib/chat-utils";
import { createLangclawChatTransport } from "@/lib/langclaw-chat-transport";
import type { Experimental_TranscriptionResult } from "ai";
import {
  dispatchChatSessionsUpdated,
  getChatSession,
  readFriendlyError,
  type ChatMode,
  type DirectChatUsage,
  type ModelUsageReceipt,
  type OnChainToolFinalPayload,
  type OnChainToolResult,
  type RouterModel,
  type ChatSession,
  type StoredChatMessage,
  upsertChatSession,
} from "@/lib/langclaw-api";
import { useWalletSession } from "@/hooks/use-wallet-session";
import {
  DEFAULT_CHAT_MODEL_ID,
  getModelLabel,
  useRouterModels,
} from "@/hooks/use-router-models";
import { cn } from "@/lib/utils";

type ChatProps = {
  sessionId?: string;
};

type SubmitOptions = {
  model?: string;
  toolMode?: ChatMode;
};

type TranscriptionSegments = Experimental_TranscriptionResult["segments"];

const CHAT_SUGGESTIONS = [
  "Find the strongest AI x Web3 product trends this week",
  "Compare 0G Compute and OpenClaw for an agent demo",
  "What product angle should a builder team pursue next?",
];

const BACKEND_CONTEXT_WINDOW = 32_000;

const Chat = ({ sessionId }: ChatProps) => {
  const { getWalletAuth, isConnected, isSigning, openWalletModal } =
    useWalletSession();
  const { chatModels, error: modelsError } = useRouterModels();
  const transport = useMemo(() => createLangclawChatTransport(), []);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(DEFAULT_CHAT_MODEL_ID);
  const [toolMode, setToolMode] = useState<ChatMode>("chat");
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [speechSegments, setSpeechSegments] = useState<TranscriptionSegments>(
    [],
  );
  const [pendingRetryMessageId, setPendingRetryMessageId] = useState<
    string | null
  >(null);
  const sessionRef = useRef<ChatSession | null>(null);
  const pendingStartedRef = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (!chatModels.length) {
      return;
    }

    if (!chatModels.some((model) => model.id === selectedModel)) {
      const timeoutId = window.setTimeout(() => {
        setSelectedModel(chatModels[0].id);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [chatModels, selectedModel]);

  const persistSession = useCallback(
    async (nextSession: ChatSession) => {
      if (!isConnected) {
        openWalletModal();
        const message = "Choose a wallet to save this chat.";
        setSaveError(message);
        toast.error(message);
        return;
      }

      const wallet = await getWalletAuth();
      await upsertChatSession(wallet, nextSession);
      dispatchChatSessionsUpdated();
      setSaveError("");
    },
    [getWalletAuth, isConnected, openWalletModal],
  );

  const {
    error: chatError,
    messages,
    regenerate,
    sendMessage,
    setMessages,
    status,
    stop,
  } = useChat<LangclawUIMessage>({
    id: sessionId,
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
    onFinish: ({ isAbort, messages: finishedMessages }) => {
      const finalMessages = isAbort
        ? markLatestAssistantStopped(finishedMessages)
        : finishedMessages;
      const storedMessages = uiMessagesToStoredMessages(finalMessages);
      const firstMessage = storedMessages[0]?.content || "New Chat";
      const baseSession =
        sessionRef.current ?? createChatSession(firstMessage, sessionId);
      const nextSession = updateSessionMessages(baseSession, storedMessages);

      sessionRef.current = nextSession;
      setSession(nextSession);

      void persistSession(nextSession).catch((saveErr) => {
        const message =
          saveErr instanceof Error ? saveErr.message : "Unable to save chat.";
        setSaveError(message);
        toast.error(message);
      });
    },
    transport,
  });

  const storedMessages = useMemo(
    () => uiMessagesToStoredMessages(messages),
    [messages],
  );
  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (
          message,
        ): message is LangclawUIMessage & { role: "assistant" | "user" } =>
          message.role === "assistant" || message.role === "user",
      ),
    [messages],
  );
  const estimatedContextTokens = useMemo(
    () =>
      estimateTokens(
        [input, ...storedMessages.map((message) => message.content)].join("\n"),
      ),
    [input, storedMessages],
  );
  const maxContextTokens = BACKEND_CONTEXT_WINDOW;
  const selectedChatModel = useMemo(
    () => chatModels.find((model) => model.id === selectedModel),
    [chatModels, selectedModel],
  );

  const submitMessage = useCallback(
    async (text: string, options: SubmitOptions = {}) => {
      const content = text.trim();

      if (!content || status === "submitted" || status === "streaming") {
        return;
      }

      if (!isConnected) {
        openWalletModal();
        showError(
          setError,
          "Choose a wallet to send your message.",
        );
        return;
      }

      const selectedToolMode = options.toolMode ?? toolMode;
      const modelForRequest = options.model ?? selectedModel;
      const baseSession =
        sessionRef.current ??
        createChatSession(content, sessionId ?? undefined);

      setError("");
      setSaveError("");
      setSpeechSegments([]);
      sessionRef.current = baseSession;
      setSession(baseSession);

      try {
        const wallet = await getWalletAuth();
        await sendMessage(
          { text: content },
          {
            body: {
              model: modelForRequest,
              researchTrend: selectedToolMode === "research",
              sessionId: baseSession.id,
              toolMode: selectedToolMode,
              wallet,
            },
          },
        );
      } catch (err) {
        showError(
          setError,
          readFriendlyError(err, "Unable to start the chat."),
        );
      }
    },
    [
      getWalletAuth,
      isConnected,
      openWalletModal,
      selectedModel,
      sendMessage,
      sessionId,
      status,
      toolMode,
    ],
  );

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let active = true;

    const loadSession = async () => {
      if (!isConnected) {
        openWalletModal();
        showError(setError, "Choose a wallet to load saved chats.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const wallet = await getWalletAuth();
        const loadedSession = await getChatSession(wallet, sessionId);
        const nextSession =
          loadedSession ?? createChatSession("New Chat", sessionId);

        if (!active) {
          return;
        }

        sessionRef.current = nextSession;
        setSession(nextSession);
        setMessages(storedMessagesToUIMessages(nextSession.messages));
      } catch (err) {
        if (!active) {
          return;
        }

        showError(
          setError,
          readFriendlyError(err, "Unable to load chat session."),
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadSession();

    return () => {
      active = false;
    };
  }, [getWalletAuth, isConnected, openWalletModal, sessionId, setMessages]);

  useEffect(() => {
    if (!sessionId || loading || pendingStartedRef.current) {
      return;
    }

    const pending = consumePendingPrompt(sessionId);

    if (!pending) {
      return;
    }

    pendingStartedRef.current = true;
    const timeoutId = window.setTimeout(() => {
      void submitMessage(pending.text, {
        model: pending.model,
        toolMode: pending.toolMode ?? (pending.researchTrend ? "research" : "chat"),
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loading, sessionId, submitMessage]);

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      const text = message.text.trim();

      if (message.files?.length) {
        showError(
          setError,
          "File attachments are not supported by the current chat backend.",
        );
        return;
      }

      if (!text) {
        return;
      }

      if (!isConnected) {
        openWalletModal();
        showError(setError, "Choose a wallet to send your message.");
        return;
      }

      setInput("");
      setSpeechSegments([]);
      await submitMessage(text);
    },
    [isConnected, openWalletModal, submitMessage],
  );

  const handleSuggestion = useCallback((suggestion: string) => {
    setInput(suggestion);
  }, []);

  const handleSpeechTranscript = useCallback((text: string) => {
    setInput((currentInput) => appendSpeechText(currentInput, text));
    setSpeechSegments((segments) => appendTranscriptionSegment(segments, text));
  }, []);

  const handleStop = useCallback(() => {
    stop();
    setMessages((currentMessages) =>
      markLatestAssistantStopped(currentMessages),
    );
    toast.info("Generation stopped");
  }, [setMessages, stop]);

  const handleRetry = useCallback(
    async (messageId: string) => {
      if (!isConnected) {
        openWalletModal();
        showError(
          setError,
          "Choose a wallet to retry this response.",
        );
        return;
      }

      try {
        setError("");
        setSaveError("");
        setPendingRetryMessageId(null);
        const wallet = await getWalletAuth();
        const originalMessage = uiMessagesToStoredMessages(messages).find(
          (message) => message.id === messageId,
        );
        const retryMode = originalMessage?.mode ?? toolMode;
        const retryModel = originalMessage?.model ?? selectedModel;
        await regenerate({
          body: {
            model: retryModel,
            researchTrend: retryMode === "research",
            sessionId: sessionRef.current?.id ?? sessionId,
            toolMode: retryMode,
            wallet,
          },
          messageId,
        });
        toast.info("Retry started", {
          description:
            retryMode === "research"
              ? "Search mode"
              : retryMode === "onchain"
                ? "On-chain mode"
                : retryModel,
        });
      } catch (err) {
        showError(
          setError,
          readFriendlyError(err, "Unable to retry chat."),
        );
      }
    },
    [
      getWalletAuth,
      isConnected,
      openWalletModal,
      messages,
      regenerate,
      selectedModel,
      sessionId,
      toolMode,
    ],
  );

  return (
    <div className="relative mx-auto flex h-[calc(100dvh-4rem)] min-h-0 w-full  flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col">
        <Conversation className="min-h-0">
          <ConversationContent className="pb-4">
            {loading ? (
              <LoadingMessages />
            ) : visibleMessages.length === 0 ? (
              <ConversationEmptyState>
                <SearchIcon className="size-5 text-muted-foreground" />
                <div className="space-y-1">
                  <h3 className="font-medium text-sm">Start a Langclaw chat</h3>
                  <p className="text-muted-foreground text-sm">
                    {isConnected
                      ? "Ask directly, run Langclaw research, or use on-chain tools."
                      : "Connect wallet from the sidebar to chat and load saved sessions."}
                  </p>
                </div>
                <Suggestions className="justify-start sm:justify-center">
                  {CHAT_SUGGESTIONS.map((suggestion) => (
                    <Suggestion
                      key={suggestion}
                      onClick={handleSuggestion}
                      suggestion={suggestion}
                    />
                  ))}
                </Suggestions>
              </ConversationEmptyState>
            ) : (
              visibleMessages.map((message) => {
                const content = getUIMessageText(message);
                const reasoningText = getUIMessageReasoning(message);
                const storedMessage = uiMessagesToStoredMessages([message])[0];
                const isAssistantStreaming =
                  message.role === "assistant" &&
                  (status === "submitted" || status === "streaming") &&
                  getLatestAssistantMessageId(visibleMessages) === message.id;
                const isWaitingForFirstUpdate =
                  isAssistantStreaming && !content && !reasoningText;

                return (
                  <Fragment key={message.id}>
                    <Message from={message.role}>
                      <MessageContent>
                        {reasoningText && (
                          <StreamingReasoning
                            isStreaming={isAssistantStreaming}
                            text={reasoningText}
                          />
                        )}
                        {isWaitingForFirstUpdate && <PendingReasoning />}
                        {content && (
                          <MessageResponse>{content}</MessageResponse>
                        )}
                        {storedMessage && (
                          <MessageTokenUsage message={storedMessage} />
                        )}
                        {storedMessage && (
                          <MessageDetails
                            message={storedMessage}
                            showReasoning={!reasoningText}
                          />
                        )}
                      </MessageContent>
                    </Message>
                    {message.role === "assistant" && content && (
                      <MessageActions>
                        <MessageAction
                          disabled={
                            status === "submitted" || status === "streaming"
                          }
                          label="Retry"
                          onClick={() => setPendingRetryMessageId(message.id)}
                          tooltip="Retry response"
                        >
                          <RefreshCcwIcon className="size-3" />
                        </MessageAction>
                        <MessageAction
                          label="Copy"
                          onClick={() => navigator.clipboard.writeText(content)}
                          tooltip="Copy response"
                        >
                          <CopyIcon className="size-3" />
                        </MessageAction>
                      </MessageActions>
                    )}
                    {pendingRetryMessageId === message.id && (
                      <Confirmation
                        approval={{ id: message.id }}
                        className="ml-0 max-w-2xl"
                        state="approval-requested"
                      >
                        <ConfirmationRequest>
                          <ConfirmationTitle>
                            Run this assistant response again with the current
                            backend route and research mode?
                          </ConfirmationTitle>
                          <ConfirmationActions>
                            <ConfirmationAction
                              onClick={() => setPendingRetryMessageId(null)}
                              variant="outline"
                            >
                              Cancel
                            </ConfirmationAction>
                            <ConfirmationAction
                              onClick={() => void handleRetry(message.id)}
                            >
                              Retry
                            </ConfirmationAction>
                          </ConfirmationActions>
                        </ConfirmationRequest>
                      </Confirmation>
                    )}
                  </Fragment>
                );
              })
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {(error || saveError || chatError || modelsError) && (
          <div className="mx-auto mt-3 w-full shrink-0 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error || saveError || chatError?.message || modelsError}
          </div>
        )}

        <PromptInput
          className="sticky bottom-0 z-20 mx-auto mt-3 w-full shrink-0 bg-background pb-1 pt-2"
          onSubmit={handleSubmit}
        >
          <SpeechTranscriptionPreview segments={speechSegments} />
          <PromptInputBody>
            <PromptInputTextarea
              className="pr-12"
              onChange={(event) => setInput(event.currentTarget.value)}
              placeholder="Ask Langclaw..."
              value={input}
            />
          </PromptInputBody>
          <PromptInputFooter className="flex-wrap items-end gap-2">
            <PromptInputTools className="flex-1 flex-wrap gap-1.5">
              <SpeechInput
                aria-label="Dictate prompt"
                lang="en-US"
                onTranscriptionChange={handleSpeechTranscript}
                size="icon-sm"
                variant="ghost"
              />
              <ChatModeControl onChange={setToolMode} value={toolMode} />
              <ModelSelect
                models={chatModels}
                onChange={setSelectedModel}
                value={selectedModel}
              />
              <Context
                maxTokens={
                  selectedChatModel?.context_length ?? maxContextTokens
                }
                modelId={selectedModel}
                usedTokens={estimatedContextTokens}
              >
                <ContextTrigger />
                <ContextContent>
                  <ContextContentHeader />
                  <ContextContentBody className="space-y-1 text-xs text-muted-foreground">
                    <p>Estimated from this conversation.</p>
                    <p>Final usage appears after the answer finishes.</p>
                  </ContextContentBody>
                </ContextContent>
              </Context>
            </PromptInputTools>
            <PromptInputSubmit
              disabled={
                isSigning ||
                !isConnected ||
                (!input.trim() &&
                  status !== "submitted" &&
                  status !== "streaming")
              }
              onStop={handleStop}
              status={status}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
};

function showError(setError: (message: string) => void, message: string) {
  setError(message);
  toast.error(message);
}

function PendingReasoning() {
  return (
    <Reasoning defaultOpen isStreaming>
      <ReasoningTrigger
        getThinkingMessage={() => "Waiting for live updates..."}
      />
    </Reasoning>
  );
}

function StreamingReasoning({
  isStreaming,
  text,
}: {
  isStreaming: boolean;
  text: string;
}) {
  return (
    <Reasoning defaultOpen={isStreaming} isStreaming={isStreaming}>
      <ReasoningTrigger
        getThinkingMessage={(isThinking, duration) =>
          isThinking
            ? "Thinking through the request..."
            : `Thinking${duration ? ` (${duration}s)` : ""}`
        }
      />
      <ReasoningContent>{text}</ReasoningContent>
    </Reasoning>
  );
}

function ChatModeControl({
  onChange,
  value,
}: {
  onChange: (value: ChatMode) => void;
  value: ChatMode;
}) {
  const modes: Array<{
    icon: ComponentType<{ className?: string; size?: number }>;
    label: string;
    value: ChatMode;
  }> = [
      { icon: MessageSquareIcon, label: "Chat", value: "chat" },
      { icon: SearchIcon, label: "Search", value: "research" },
      { icon: ActivityIcon, label: "On-chain", value: "onchain" },
    ];

  return (
    <ButtonGroup className="max-w-full shrink-0">
      {modes.map((mode) => {
        const Icon = mode.icon;

        return (
          <PromptInputButton
            aria-pressed={value === mode.value}
            key={mode.value}
            onClick={() => onChange(mode.value)}
            type="button"
            variant={value === mode.value ? "default" : "ghost"}
          >
            <Icon className="size-4" />
            <span>{mode.label}</span>
          </PromptInputButton>
        );
      })}
    </ButtonGroup>
  );
}

function ModelSelect({
  models,
  onChange,
  value,
}: {
  models: RouterModel[];
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <Select onValueChange={onChange} value={value}>
      <SelectTrigger
        aria-label="Chat model"
        className="h-8 min-w-0 flex-1 basis-40 text-xs sm:w-[min(15rem,42vw)] sm:flex-none"
        size="sm"
      >
        <SelectValue placeholder="Model" />
      </SelectTrigger>
      <SelectContent align="start" className="max-w-80">
        {models.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            {getModelLabel(model)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MessageTokenUsage({ message }: { message: StoredChatMessage }) {
  const usage = getMessageTokenUsage(message);
  const routerUsage = getRouterUsage(message);
  const costNeuron = routerUsage ? getRouterUsageCostNeuron(routerUsage) : undefined;

  if (!usage) {
    return null;
  }

  const inputLabel = usage.source === "estimated" ? "Input est." : "Input";
  const outputLabel = usage.source === "estimated" ? "Output est." : "Output";

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1.5 text-xs text-muted-foreground",
        message.role === "assistant" ? "mt-3" : "mt-2"
      )}
    >
      {typeof usage.inputTokens === "number" && (
        <StatusPill
          label={inputLabel}
          value={`${formatNumber(usage.inputTokens)} tokens`}
        />
      )}
      {typeof usage.outputTokens === "number" && (
        <StatusPill
          label={outputLabel}
          value={`${formatNumber(usage.outputTokens)} tokens`}
        />
      )}
      {usage.source === "actual" && typeof usage.totalTokens === "number" && (
        <StatusPill
          label="Total"
          value={`${formatNumber(usage.totalTokens)} tokens`}
        />
      )}
      {costNeuron && (
        <StatusPill label="Cost" value={`${formatNeuron(costNeuron)} 0G`} />
      )}
      {routerUsage && <RouterUsageTooltip usage={routerUsage} />}
    </div>
  );
}

function MessageDetails({
  message,
  showReasoning = true,
}: {
  message: StoredChatMessage;
  showReasoning?: boolean;
}) {
  const reasoningText = buildReasoningText(message);
  const workflowEvents = message.progressEvents ?? [];

  if (
    !message.result &&
    !message.directAnswer &&
    !message.onChain &&
    !workflowEvents.length &&
    !message.error &&
    !message.stopped
  ) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3 text-xs text-muted-foreground">
      {message.directAnswer && (
        <div className="flex flex-wrap gap-2">
          <StatusPill label="Mode" value="Direct chat" />
          {message.directAnswer.requestedModel && (
            <StatusPill
              label="Requested"
              value={message.directAnswer.requestedModel}
            />
          )}
          {message.directAnswer.usedModel && (
            <StatusPill label="Used" value={message.directAnswer.usedModel} />
          )}
          {message.directAnswer.model && (
            <StatusPill label="Model" value={message.directAnswer.model} />
          )}
          {message.directAnswer.modelHonored === false && (
            <StatusPill
              label="Fallback"
              value={message.directAnswer.fallbackFrom ?? "model fallback"}
            />
          )}
          {message.directAnswer.teeVerification?.status && (
            <StatusPill
              label="TEE"
              value={message.directAnswer.teeVerification.status}
            />
          )}
          {message.directAnswer.source && (
            <StatusPill label="Source" value={message.directAnswer.source} />
          )}
        </div>
      )}

      {showReasoning && reasoningText && (
        <Reasoning isStreaming={isWorkflowStreaming(workflowEvents)}>
          <ReasoningTrigger
            getThinkingMessage={(isStreaming, duration) =>
              isStreaming
                ? "Langclaw is reasoning through live evidence..."
                : `Langclaw reasoning${duration ? ` (${duration}s)` : ""}`
            }
          />
          <ReasoningContent>{reasoningText}</ReasoningContent>
        </Reasoning>
      )}

      {workflowEvents.length ? <WorkflowPlan events={workflowEvents} /> : null}

      {message.result && <DiscoverDetails payload={message.result} />}

      {message.onChain && <OnChainDetails payload={message.onChain} />}

      {(message.error || message.directAnswer?.error) && (
        <p className="text-destructive">
          {message.error || message.directAnswer?.error}
        </p>
      )}
      {message.stopped && <p>Generation stopped.</p>}
    </div>
  );
}

function RouterUsageTooltip({
  usage,
}: {
  usage: DirectChatUsage | ModelUsageReceipt;
}) {
  const costNeuron = getRouterUsageCostNeuron(usage);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs"
            type="button"
          >
            <InfoIcon className="size-3" />
            <span>Router usage</span>
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-72 flex-col items-start gap-1.5">
          <p className="font-medium">Router usage</p>
          <p>Model: {usage.model}</p>
          <p>
            Input tokens:{" "}
            {formatNumber(usage.inputTokens ?? usage.promptTokens)}
          </p>
          <p>
            Output tokens:{" "}
            {formatNumber(usage.outputTokens ?? usage.completionTokens)}
          </p>
          <p>Total tokens: {formatNumber(usage.totalTokens)}</p>
          {"provider" in usage && usage.provider && (
            <p>Provider: {usage.provider}</p>
          )}
          {"requestId" in usage && usage.requestId && (
            <p>Request: {usage.requestId}</p>
          )}
          {"status" in usage && usage.status && <p>Status: {usage.status}</p>}
          {"costSource" in usage && usage.costSource && (
            <p>Cost source: {usage.costSource}</p>
          )}
          {costNeuron && (
            <p>Cost: {formatNeuron(costNeuron)} 0G</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function OnChainDetails({ payload }: { payload: OnChainToolFinalPayload }) {
  return (
    <div className="space-y-3 rounded-md border bg-background/70 p-3">
      <div className="flex flex-wrap gap-2">
        <StatusPill label="Mode" value="On-chain" />
        <StatusPill label="Intent" value={payload.plan.intent} />
        <StatusPill label="Chain" value={payload.plan.chain} />
        <StatusPill label="Tools" value={String(payload.tools.length)} />
      </div>
      <div className="space-y-2">
        <p className="font-medium text-foreground">Tool results</p>
        {payload.tools.map((tool) => (
          <Tool
            className="mb-0 bg-background"
            defaultOpen
            key={`${tool.commandId}-${tool.provider}`}
          >
            <ToolHeader
              state={getOnChainToolState(tool.status)}
              title={tool.title}
              toolName={tool.commandId}
              type="dynamic-tool"
            />
            <ToolContent className="flex flex-col gap-2 pt-0 text-sm text-muted-foreground">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill label="Provider" value={tool.provider} />
                <StatusPill label="Status" value={tool.status} />
                <span>{tool.latencyMs}ms</span>
              </div>
              <p>{tool.summary}</p>
              {tool.sourceUrl && (
                <a
                  className="break-all text-foreground underline underline-offset-2"
                  href={tool.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {tool.sourceUrl}
                </a>
              )}
              {tool.error && <p className="text-destructive">{tool.error}</p>}
              <OnChainToolDataPreview tool={tool} />
            </ToolContent>
          </Tool>
        ))}
      </div>
    </div>
  );
}

function getOnChainToolState(
  status: OnChainToolResult["status"]
): ToolPart["state"] {
  if (status === "success") {
    return "output-available";
  }

  if (status === "skipped") {
    return "output-denied";
  }

  return "output-error";
}

function OnChainToolDataPreview({ tool }: { tool: OnChainToolResult }) {
  if (tool.data === undefined) {
    return null;
  }

  const synthesis = getSynthesisPreview(tool.data);

  if (synthesis) {
    return <OnChainSynthesisPreview synthesis={synthesis} />;
  }

  const recordSet = getToolRecordSet(tool.data);

  if (recordSet.records.length) {
    const visibleRecords = recordSet.records.slice(0, 5);

    return (
      <div className="overflow-hidden rounded-md border bg-muted/20">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-2 py-1.5">
          <p className="font-medium text-foreground">Fetched output</p>
          <StatusPill
            label={recordSet.label}
            value={
              recordSet.total > visibleRecords.length
                ? `${visibleRecords.length} of ${recordSet.total}`
                : String(recordSet.total)
            }
          />
        </div>
        <div className="divide-y">
          {visibleRecords.map((record, index) => (
            <OnChainRecordPreview
              index={index}
              key={getRecordKey(record, index)}
              record={record}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <ToolOutput
      className="[&_pre]:max-h-64"
      errorText={undefined}
      output={tool.data}
    />
  );
}

function OnChainRecordPreview({
  index,
  record,
}: {
  index: number;
  record: Record<string, unknown>;
}) {
  const baseToken = readRecord(record.baseToken);
  const quoteToken = readRecord(record.quoteToken);
  const tokenAddress =
    readString(record.tokenAddress) ||
    readString(record.address) ||
    readString(baseToken?.address);
  const title =
    readString(baseToken?.symbol) ||
    readString(record.symbol) ||
    readString(record.name) ||
    readString(baseToken?.name) ||
    (tokenAddress ? shortHash(tokenAddress) : `Record ${index + 1}`);
  const subtitle =
    readString(record.description) ||
    readString(record.label) ||
    readString(record.category) ||
    readString(baseToken?.name);
  const chain = readString(record.chainId) || readString(record.chain);
  const dex = readString(record.dexId) || readString(record.exchange);
  const quoteSymbol = readString(quoteToken?.symbol);
  const price = readString(record.priceUsd) || readString(record.price);
  const liquidity = readNumber(readRecord(record.liquidity)?.usd);
  const volume24h = readNumber(readRecord(record.volume)?.h24);
  const marketCap = readNumber(record.marketCap) || readNumber(record.fdv);
  const boostAmount = readNumber(record.totalAmount) || readNumber(record.amount);
  const url = readString(record.url) || readString(record.sourceUrl);

  return (
    <div className="flex flex-col gap-1.5 px-2 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">
          {quoteSymbol ? `${title}/${quoteSymbol}` : title}
        </span>
        {chain && <StatusPill label="Chain" value={chain} />}
        {dex && <StatusPill label="DEX" value={dex} />}
      </div>
      {subtitle && <p className="break-words">{subtitle}</p>}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {price && <span>Price {price}</span>}
        {typeof liquidity === "number" && (
          <span>Liquidity {formatUsd(liquidity)}</span>
        )}
        {typeof volume24h === "number" && (
          <span>24h volume {formatUsd(volume24h)}</span>
        )}
        {typeof marketCap === "number" && (
          <span>Market cap {formatUsd(marketCap)}</span>
        )}
        {typeof boostAmount === "number" && (
          <span>Boost {formatNumber(boostAmount)}</span>
        )}
      </div>
      {(tokenAddress || url) && (
        <div className="flex flex-col gap-1 text-xs">
          {tokenAddress && (
            <span className="break-all">Token {tokenAddress}</span>
          )}
          {url && (
            <a
              className="break-all text-foreground underline underline-offset-2"
              href={url}
              rel="noreferrer"
              target="_blank"
            >
              {url}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function OnChainSynthesisPreview({
  synthesis,
}: {
  synthesis: {
    completedTools?: number;
    failedTools?: number;
    summaries: string[];
  };
}) {
  return (
    <div className="overflow-hidden rounded-md border bg-muted/20">
      <div className="flex flex-wrap items-center gap-2 border-b px-2 py-1.5">
        <p className="font-medium text-foreground">Synthesis output</p>
        {typeof synthesis.completedTools === "number" && (
          <StatusPill
            label="Completed"
            value={String(synthesis.completedTools)}
          />
        )}
        {typeof synthesis.failedTools === "number" && (
          <StatusPill label="Failed" value={String(synthesis.failedTools)} />
        )}
      </div>
      <div className="flex flex-col gap-1 px-2 py-2">
        {synthesis.summaries.slice(0, 6).map((summary, index) => (
          <p className="break-words" key={`${summary}-${index}`}>
            {summary}
          </p>
        ))}
      </div>
    </div>
  );
}

function getToolRecordSet(data: unknown): {
  label: string;
  records: Array<Record<string, unknown>>;
  total: number;
} {
  const direct = toRecordArray(data);

  if (direct.length) {
    return { label: "Records", records: direct, total: direct.length };
  }

  const nested = findRecordSet(data, 0);

  if (nested) {
    return nested;
  }

  return { label: "Records", records: [], total: 0 };
}

const onChainRecordKeys = [
  "pairs",
  "data",
  "result",
  "items",
  "tokens",
  "rows",
  "transfers",
  "tokenBalances",
  "protocols",
  "pools",
];

function findRecordSet(
  data: unknown,
  depth: number
): { label: string; records: Array<Record<string, unknown>>; total: number } | null {
  if (depth > 3) {
    return null;
  }

  const root = readRecord(data);

  if (!root) {
    return null;
  }

  for (const key of onChainRecordKeys) {
    const records = toRecordArray(root[key]);

    if (records.length) {
      return {
        label: formatRecordLabel(key),
        records,
        total: records.length,
      };
    }
  }

  for (const key of onChainRecordKeys) {
    const nested = findRecordSet(root[key], depth + 1);

    if (nested) {
      return nested;
    }
  }

  return null;
}

function formatRecordLabel(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) =>
    char.toUpperCase()
  );
}

function getSynthesisPreview(data: unknown) {
  const root = readRecord(data);

  if (!root || !Array.isArray(root.summaries)) {
    return null;
  }

  const summaries = root.summaries.filter(
    (summary): summary is string => typeof summary === "string"
  );

  if (!summaries.length) {
    return null;
  }

  return {
    completedTools: readNumber(root.completedTools),
    failedTools: readNumber(root.failedTools),
    summaries,
  };
}

function toRecordArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is Record<string, unknown> => Boolean(readRecord(item))
  );
}

function getRecordKey(record: Record<string, unknown>, index: number) {
  return (
    readString(record.pairAddress) ||
    readString(record.tokenAddress) ||
    readString(record.address) ||
    readString(readRecord(record.baseToken)?.address) ||
    `${index}`
  );
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function shortHash(value: string) {
  return value.length > 14 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: value >= 1 ? 0 : 6,
    style: "currency",
  }).format(value);
}

function getUIMessageReasoning(message: Pick<LangclawUIMessage, "parts">) {
  return message.parts
    .filter((part) => part.type === "reasoning")
    .map((part) => part.text)
    .join("")
    .trim();
}

function getMessageTokenUsage(message: StoredChatMessage) {
  if (message.role === "user") {
    return {
      inputTokens: estimateTokens(message.content),
      source: "estimated",
    };
  }

  const actualUsage = message.directAnswer?.usage ?? message.result?.usage;

  if (actualUsage) {
    const inputTokens = actualUsage.inputTokens ?? actualUsage.promptTokens;
    const outputTokens =
      actualUsage.outputTokens ?? actualUsage.completionTokens;
    const totalTokens =
      actualUsage.totalTokens ??
      (typeof inputTokens === "number" && typeof outputTokens === "number"
        ? inputTokens + outputTokens
        : undefined);

    if (
      typeof inputTokens === "number" ||
      typeof outputTokens === "number" ||
      typeof totalTokens === "number"
    ) {
      return {
        inputTokens,
        outputTokens,
        source: "actual",
        totalTokens,
      };
    }
  }

  if (!message.content.trim()) {
    return null;
  }

  return {
    outputTokens: estimateTokens(message.content),
    source: "estimated",
  };
}

function getRouterUsage(message: StoredChatMessage) {
  return message.directAnswer?.usage ?? message.result?.usage;
}

function getRouterUsageCostNeuron(
  usage: DirectChatUsage | ModelUsageReceipt
) {
  if ("chargedNeuron" in usage) {
    return usage.chargedNeuron;
  }

  return usage.totalCostNeuron;
}

function getLatestAssistantMessageId(messages: LangclawUIMessage[]) {
  return [...messages].reverse().find((message) => message.role === "assistant")
    ?.id;
}

function buildReasoningText(message: StoredChatMessage) {
  if (message.onChain) {
    const payload = message.onChain;
    const tools = payload.tools.map(
      (tool) => `- ${tool.provider}: ${tool.title} ${tool.status}`,
    );

    return [
      `Intent: ${payload.plan.intent}`,
      `Chain: ${payload.plan.chain}`,
      ...tools,
    ].join("\n");
  }

  if (message.result) {
    const payload = message.result;
    const topTrend = payload.agentOutputs?.trend?.topTrend;
    const lines = [
      `Runtime: ${payload.orchestration.runtime}`,
      payload.finalAnswerMeta?.synthesis
        ? `Synthesis: ${payload.finalAnswerMeta.synthesis}`
        : undefined,
      topTrend ? `Top trend: ${topTrend}` : undefined,
      payload.finalConclusion.summary,
      ...payload.finalConclusion.keySignals.map(
        (signal) => `- ${signal.label}: ${signal.text}`,
      ),
    ];

    return lines.filter(Boolean).join("\n");
  }

  if (message.progressEvents?.length) {
    return message.progressEvents
      .map((event) => `- ${event.agent}: ${event.summary}`)
      .join("\n");
  }

  return "";
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function formatNumber(value?: number) {
  return value === undefined ? "Not available" : value.toLocaleString();
}

function formatNeuron(value: string) {
  try {
    const raw = BigInt(value);
    const base = BigInt("1000000000000000000");
    const whole = raw / base;
    const fraction = raw % base;
    const fractionText = fraction.toString().padStart(18, "0").slice(0, 6);

    return `${whole}.${fractionText}`.replace(/\.?0+$/, "");
  } catch {
    return value;
  }
}

function LoadingMessages() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-20 w-3/4" />
      <Skeleton className="ml-auto h-16 w-2/3" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}

function SpeechTranscriptionPreview({
  segments,
}: {
  segments: TranscriptionSegments;
}) {
  if (!segments.length) {
    return null;
  }

  return (
    <div className="border-b px-3 py-2">
      <Transcription segments={segments}>
        {(segment, index) => (
          <TranscriptionSegment
            index={index}
            key={`${segment.startSecond}-${segment.text}`}
            segment={segment}
          />
        )}
      </Transcription>
    </div>
  );
}

function appendSpeechText(currentText: string, transcript: string) {
  const next = transcript.trim();

  if (!next) {
    return currentText;
  }

  return currentText.trim() ? `${currentText.trim()} ${next}` : next;
}

function appendTranscriptionSegment(
  segments: TranscriptionSegments,
  text: string,
): TranscriptionSegments {
  const transcript = text.trim();

  if (!transcript) {
    return segments;
  }

  const startSecond = segments.at(-1)?.endSecond ?? 0;
  const duration = Math.max(1, Math.ceil(transcript.split(/\s+/).length / 2));

  return [
    ...segments,
    {
      endSecond: startSecond + duration,
      startSecond,
      text: transcript,
    },
  ];
}

export default Chat;
