"use client";

import { useChat } from "@ai-sdk/react";
import {
  CopyIcon,
  RefreshCcwIcon,
  SearchIcon,
} from "lucide-react";
import {
  Fragment,
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
  Transcription,
  TranscriptionSegment,
} from "@/components/ai-elements/transcription";
import {
  DiscoverDetails,
  isWorkflowStreaming,
  StatusPill,
  WorkflowPlan,
} from "@/components/SignalGraphResult";
import { Skeleton } from "@/components/ui/skeleton";
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
  type RouterModel,
  type ChatSession,
  type StoredChatMessage,
  upsertChatSession,
} from "@/lib/signalgraph-api";
import { useWalletSession } from "@/hooks/use-wallet-session";
import {
  DEFAULT_CHAT_MODEL_ID,
  getModelLabel,
  useRouterModels,
} from "@/hooks/use-router-models";

type ChatProps = {
  sessionId?: string;
};

type SubmitOptions = {
  model?: string;
  researchTrend?: boolean;
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
  const [researchTrend, setResearchTrend] = useState(false);
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

      const selectedResearchTrend = options.researchTrend ?? researchTrend;
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
              researchTrend: selectedResearchTrend,
              sessionId: baseSession.id,
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
      researchTrend,
      selectedModel,
      sendMessage,
      sessionId,
      status,
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
        researchTrend: pending.researchTrend,
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
        await regenerate({
          body: {
            model: selectedModel,
            researchTrend,
            sessionId: sessionRef.current?.id ?? sessionId,
            wallet,
          },
          messageId,
        });
        toast.info("Retry started", {
          description: researchTrend ? "Search mode" : selectedModel,
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
      regenerate,
      researchTrend,
      selectedModel,
      sessionId,
    ],
  );

  return (
    <div className="mx-auto flex size-full min-h-[calc(100vh-5rem)] flex-col">
      <div className="flex min-h-0 flex-1 flex-col">
        <Conversation>
          <ConversationContent>
            {loading ? (
              <LoadingMessages />
            ) : visibleMessages.length === 0 ? (
              <ConversationEmptyState>
                <SearchIcon className="size-5 text-muted-foreground" />
                <div className="space-y-1">
                  <h3 className="font-medium text-sm">Start a Langclaw chat</h3>
                  <p className="text-muted-foreground text-sm">
                    {isConnected
                      ? "Ask directly or run SignalGraph research."
                      : "Choose a wallet to load your chats and start writing."}
                  </p>
                </div>
                <Suggestions className="max-w-full justify-center">
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
                        {content && (
                          <MessageResponse>{content}</MessageResponse>
                        )}
                        {storedMessage && (
                          <MessageDetails
                            message={storedMessage}
                            showReasoning={!reasoningText}
                          />
                        )}
                      </MessageContent>
                    </Message>
                    {message.role === "assistant" && (
                      <MessageActions>
                        <MessageAction
                          disabled={
                            status === "submitted" || status === "streaming"
                          }
                          label="Retry"
                          onClick={() => setPendingRetryMessageId(message.id)}
                        >
                          <RefreshCcwIcon className="size-3" />
                        </MessageAction>
                        <MessageAction
                          label="Copy"
                          onClick={() => navigator.clipboard.writeText(content)}
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
          <div className="mx-auto mt-3 w-full rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error || saveError || chatError?.message || modelsError}
          </div>
        )}

        <PromptInput
          className="relative mx-auto mt-4 w-full"
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
          <PromptInputFooter>
            <PromptInputTools>
              <SpeechInput
                aria-label="Dictate prompt"
                lang="en-US"
                onTranscriptionChange={handleSpeechTranscript}
                size="icon-sm"
                variant="ghost"
              />
              <PromptInputButton
                onClick={() => setResearchTrend((value) => !value)}
                variant={researchTrend ? "default" : "ghost"}
              >
                <SearchIcon size={16} />
                <span>Search</span>
              </PromptInputButton>
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
        className="h-8 w-[min(15rem,42vw)] text-xs"
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
                ? "SignalGraph is reasoning through live evidence..."
                : `SignalGraph reasoning${duration ? ` (${duration}s)` : ""}`
            }
          />
          <ReasoningContent>{reasoningText}</ReasoningContent>
        </Reasoning>
      )}

      {workflowEvents.length ? <WorkflowPlan events={workflowEvents} /> : null}

      {message.result && <DiscoverDetails payload={message.result} />}

      {(message.error || message.directAnswer?.error) && (
        <p className="text-destructive">
          {message.error || message.directAnswer?.error}
        </p>
      )}
      {message.stopped && <p>Generation stopped.</p>}
    </div>
  );
}

function getUIMessageReasoning(message: Pick<LangclawUIMessage, "parts">) {
  return message.parts
    .filter((part) => part.type === "reasoning")
    .map((part) => part.text)
    .join("")
    .trim();
}

function getLatestAssistantMessageId(messages: LangclawUIMessage[]) {
  return [...messages].reverse().find((message) => message.role === "assistant")
    ?.id;
}

function buildReasoningText(message: StoredChatMessage) {
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
