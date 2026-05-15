"use client";

import { useChat } from "@ai-sdk/react";
import {
  CheckIcon,
  CopyIcon,
  RefreshCcwIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import {
  Agent,
  AgentContent,
  AgentHeader,
  AgentInstructions,
} from "@/components/ai-elements/agent";
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
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselItem,
  InlineCitationCarouselNext,
  InlineCitationCarouselPrev,
  InlineCitationQuote,
  InlineCitationSource,
  InlineCitationText,
} from "@/components/ai-elements/inline-citation";
import {
  Plan,
  PlanAction,
  PlanContent,
  PlanDescription,
  PlanHeader,
  PlanTitle,
  PlanTrigger,
} from "@/components/ai-elements/plan";
import {
  Queue,
  QueueItem,
  QueueItemContent,
  QueueItemDescription,
  QueueItemIndicator,
  QueueList,
  QueueSection,
  QueueSectionContent,
  QueueSectionLabel,
  QueueSectionTrigger,
} from "@/components/ai-elements/queue";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/sources";
import { SpeechInput } from "@/components/ai-elements/speech-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import {
  Task,
  TaskContent,
  TaskItem,
  TaskItemFile,
  TaskTrigger,
} from "@/components/ai-elements/task";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import {
  Transcription,
  TranscriptionSegment,
} from "@/components/ai-elements/transcription";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CHAT_MODELS,
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
  type ChatSession,
  type DiscoverPayload,
  type StoredChatMessage,
  type WorkflowProgressEvent,
  type ZeroGProof,
  upsertChatSession,
} from "@/lib/signalgraph-api";
import { useWalletSession } from "@/hooks/use-wallet-session";

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

const Chat = ({ sessionId }: ChatProps) => {
  const { getWalletAuth, isConnected, isSigning } = useWalletSession();
  const transport = useMemo(() => createLangclawChatTransport(), []);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(CHAT_MODELS[0].id);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [researchTrend, setResearchTrend] = useState(false);
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [speechSegments, setSpeechSegments] = useState<TranscriptionSegments>(
    []
  );
  const [pendingRetryMessageId, setPendingRetryMessageId] = useState<
    string | null
  >(null);
  const sessionRef = useRef<ChatSession | null>(null);
  const pendingStartedRef = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const persistSession = useCallback(
    async (nextSession: ChatSession) => {
      if (!isConnected) {
        setSaveError("Connect wallet to save this chat session.");
        return;
      }

      const wallet = await getWalletAuth();
      await upsertChatSession(wallet, nextSession);
      dispatchChatSessionsUpdated();
      setSaveError("");
    },
    [getWalletAuth, isConnected]
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
        setSaveError(
          saveErr instanceof Error ? saveErr.message : "Unable to save chat."
        );
      });
    },
    transport,
  });

  const storedMessages = useMemo(
    () => uiMessagesToStoredMessages(messages),
    [messages]
  );
  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (
          message
        ): message is LangclawUIMessage & { role: "assistant" | "user" } =>
          message.role === "assistant" || message.role === "user"
      ),
    [messages]
  );
  const estimatedContextTokens = useMemo(
    () =>
      estimateTokens(
        [input, ...storedMessages.map((message) => message.content)].join("\n")
      ),
    [input, storedMessages]
  );
  const maxContextTokens = getModelContextWindow(model);

  const selectedModelData = CHAT_MODELS.find((item) => item.id === model);

  const handleModelSelect = useCallback((id: string) => {
    setModel(id);
    setModelSelectorOpen(false);
  }, []);

  const submitMessage = useCallback(
    async (text: string, options: SubmitOptions = {}) => {
      const content = text.trim();

      if (!content || status === "submitted" || status === "streaming") {
        return;
      }

      if (!isConnected) {
        setError("Connect wallet first so Langclaw can save the chat session.");
        return;
      }

      const selectedModel = options.model ?? model;
      const selectedResearchTrend = options.researchTrend ?? researchTrend;
      const baseSession =
        sessionRef.current ?? createChatSession(content, sessionId ?? undefined);

      setError("");
      setSaveError("");
      setSpeechSegments([]);
      sessionRef.current = baseSession;
      setSession(baseSession);

      try {
        await getWalletAuth();
        await sendMessage(
          { text: content },
          {
            body: {
              model: selectedModel,
              researchTrend: selectedResearchTrend,
              sessionId: baseSession.id,
            },
          }
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to start the chat."
        );
      }
    },
    [
      getWalletAuth,
      isConnected,
      model,
      researchTrend,
      sendMessage,
      sessionId,
      status,
    ]
  );

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let active = true;

    const loadSession = async () => {
      if (!isConnected) {
        setError("Connect wallet to load saved chat sessions.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const wallet = await getWalletAuth();
        const loadedSession = await getChatSession(wallet, sessionId);
        const nextSession = loadedSession ?? createChatSession("New Chat", sessionId);

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

        setError(
          err instanceof Error ? err.message : "Unable to load chat session."
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
  }, [getWalletAuth, isConnected, sessionId, setMessages]);

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

      if (!text) {
        return;
      }

      setInput("");
      setSpeechSegments([]);
      await submitMessage(text);
    },
    [submitMessage]
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
      markLatestAssistantStopped(currentMessages)
    );
  }, [setMessages, stop]);

  const handleRetry = useCallback(
    async (messageId: string) => {
      if (!isConnected) {
        setError("Connect wallet first so Langclaw can save the chat session.");
        return;
      }

      try {
        setError("");
        setSaveError("");
        setPendingRetryMessageId(null);
        await getWalletAuth();
        await regenerate({
          body: {
            model,
            researchTrend,
            sessionId: sessionRef.current?.id ?? sessionId,
          },
          messageId,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to retry chat.");
      }
    },
    [getWalletAuth, isConnected, model, regenerate, researchTrend, sessionId]
  );

  return (
    <div className="mx-auto flex size-full min-h-[calc(100vh-5rem)] flex-col rounded-lg p-6">
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
                      : "Connect wallet from the sidebar to load and save chats."}
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
                        {content && <MessageResponse>{content}</MessageResponse>}
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
                            model and research mode?
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

        {(error || saveError || chatError) && (
          <div className="mx-auto mt-3 w-full max-w-2xl rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error || saveError || chatError?.message}
          </div>
        )}

        <PromptInput
          className="relative mx-auto mt-4 w-full max-w-2xl"
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
              <ModelSelector
                onOpenChange={setModelSelectorOpen}
                open={modelSelectorOpen}
              >
                <ModelSelectorTrigger asChild>
                  <PromptInputButton>
                    {selectedModelData?.chefSlug && (
                      <ModelSelectorLogo
                        provider={selectedModelData.chefSlug}
                      />
                    )}
                    {selectedModelData?.name && (
                      <ModelSelectorName>
                        {selectedModelData.name}
                      </ModelSelectorName>
                    )}
                  </PromptInputButton>
                </ModelSelectorTrigger>
                <ModelSelectorContent>
                  <ModelSelectorInput placeholder="Search models..." />
                  <ModelSelectorList>
                    <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                    {["0G Compute", "OpenAI", "Anthropic", "Google"].map(
                      (chef) => (
                        <ModelSelectorGroup heading={chef} key={chef}>
                          {CHAT_MODELS.filter((item) => item.chef === chef).map(
                            (item) => (
                              <ModelSelectorItem
                                key={item.id}
                                onSelect={() => handleModelSelect(item.id)}
                                value={item.id}
                              >
                                <ModelSelectorLogo provider={item.chefSlug} />
                                <ModelSelectorName>
                                  {item.name}
                                </ModelSelectorName>
                                <ModelSelectorLogoGroup>
                                  {item.providers.map((provider) => (
                                    <ModelSelectorLogo
                                      key={provider}
                                      provider={provider}
                                    />
                                  ))}
                                </ModelSelectorLogoGroup>
                                {model === item.id ? (
                                  <CheckIcon className="ml-auto size-4" />
                                ) : (
                                  <div className="ml-auto size-4" />
                                )}
                              </ModelSelectorItem>
                            )
                          )}
                        </ModelSelectorGroup>
                      )
                    )}
                  </ModelSelectorList>
                </ModelSelectorContent>
              </ModelSelector>
              <Context
                maxTokens={maxContextTokens}
                modelId={model}
                usedTokens={estimatedContextTokens}
              >
                <ContextTrigger />
                <ContextContent>
                  <ContextContentHeader />
                  <ContextContentBody className="space-y-1 text-xs text-muted-foreground">
                    <p>Estimated from the current browser-side conversation.</p>
                    <p>
                      Backend token usage can replace this once the stream
                      returns usage metadata.
                    </p>
                  </ContextContentBody>
                </ContextContent>
              </Context>
            </PromptInputTools>
            <PromptInputSubmit
              disabled={
                isSigning ||
                (!input.trim() && status !== "submitted" && status !== "streaming")
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
          {message.directAnswer.model && (
            <StatusPill label="Model" value={message.directAnswer.model} />
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

      {workflowEvents.length ? (
        <WorkflowPlan events={workflowEvents} />
      ) : null}

      {message.result && <DiscoverDetails payload={message.result} />}

      {message.error && <p className="text-destructive">{message.error}</p>}
      {message.stopped && <p>Generation stopped.</p>}
    </div>
  );
}

function DiscoverDetails({ payload }: { payload: DiscoverPayload }) {
  const zeroG = payload.zeroG;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <StatusPill label="Runtime" value={payload.orchestration.runtime} />
        {payload.finalAnswerMeta?.synthesis && (
          <StatusPill label="Synthesis" value={payload.finalAnswerMeta.synthesis} />
        )}
        {zeroG?.compute?.status && (
          <StatusPill label="0G compute" value={zeroG.compute.status} />
        )}
        {zeroG?.storage.status && (
          <StatusPill label="0G storage" value={zeroG.storage.status} />
        )}
        {zeroG?.chain.status && (
          <StatusPill label="0G chain" value={zeroG.chain.status} />
        )}
      </div>

      <Agent>
        <AgentHeader
          model={payload.finalAnswerMeta?.model}
          name={payload.finalAnswer.generatedBy}
        />
        <AgentContent>
          <AgentInstructions>
            Synthesize ranked live sources, trend scoring, verifier notes, and
            0G evidence state into a concise builder-ready answer.
          </AgentInstructions>
        </AgentContent>
      </Agent>

      <KeySignalCitations payload={payload} />

      {payload.sources.length > 0 && (
        <Sources className="rounded-md border bg-background/70 p-3">
          <SourcesTrigger count={payload.sources.length} />
          <SourcesContent>
            {payload.sources.slice(0, 8).map((source) => (
              <Source href={source.url} key={source.id} title={source.title}>
                <span className="font-medium text-foreground">
                  {source.title}
                </span>
                <span className="text-muted-foreground">
                  {source.provider}
                </span>
              </Source>
            ))}
          </SourcesContent>
        </Sources>
      )}

      {zeroG && <VerificationDetails payload={payload} zeroG={zeroG} />}
    </div>
  );
}

function WorkflowPlan({ events }: { events: WorkflowProgressEvent[] }) {
  const latest = events.at(-1);
  const isStreaming = isWorkflowStreaming(events);

  return (
    <Plan className="rounded-md" defaultOpen={isStreaming} isStreaming={isStreaming}>
      <PlanHeader>
        <div className="space-y-1">
          <PlanTitle>SignalGraph workflow</PlanTitle>
          <PlanDescription>
            {latest?.summary ?? "Preparing agent workflow."}
          </PlanDescription>
        </div>
        <PlanAction>
          <PlanTrigger />
        </PlanAction>
      </PlanHeader>
      <PlanContent className="space-y-3">
        <Queue className="rounded-md shadow-none">
          <QueueSection defaultOpen>
            <QueueSectionTrigger>
              <QueueSectionLabel
                count={events.length}
                icon={<SearchIcon className="size-4" />}
                label="workflow events"
              />
            </QueueSectionTrigger>
            <QueueSectionContent>
              <QueueList>
                {events.map((event, index) => {
                  const completed = event.status === "complete";

                  return (
                    <QueueItem
                      key={`${event.stepId}-${event.status}-${event.timestamp}-${index}`}
                    >
                      <div className="flex items-start gap-3">
                        <QueueItemIndicator completed={completed} />
                        <QueueItemContent completed={completed}>
                          {event.agent}
                        </QueueItemContent>
                        <StatusPill label={event.skill} value={event.status} />
                      </div>
                      <QueueItemDescription completed={completed}>
                        {event.summary}
                        {event.execution ? ` (${event.execution})` : ""}
                      </QueueItemDescription>
                    </QueueItem>
                  );
                })}
              </QueueList>
            </QueueSectionContent>
          </QueueSection>
        </Queue>
      </PlanContent>
    </Plan>
  );
}

function KeySignalCitations({ payload }: { payload: DiscoverPayload }) {
  const signals = payload.finalConclusion.keySignals.filter((signal) =>
    Boolean(signal.text.trim())
  );

  if (!signals.length) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-md border bg-background/70 p-3">
      <p className="font-medium text-foreground">Key signals</p>
      <div className="space-y-2">
        {signals.map((signal) => {
          const sources = getSourcesForIds(
            payload,
            signal.sourceId ? [signal.sourceId] : []
          );
          const sourceUrls = sources.map((source) => source.url);

          return (
            <p key={`${signal.label}-${signal.text}`}>
              <InlineCitation>
                <InlineCitationText>
                  <span className="font-medium text-foreground">
                    {signal.label}:
                  </span>{" "}
                  {signal.text}
                </InlineCitationText>
                {sourceUrls.length > 0 && (
                  <InlineCitationCard>
                    <InlineCitationCardTrigger sources={sourceUrls} />
                    <InlineCitationCardBody>
                      <InlineCitationCarousel>
                        <InlineCitationCarouselHeader>
                          <InlineCitationCarouselPrev />
                          <InlineCitationCarouselIndex />
                          <InlineCitationCarouselNext />
                        </InlineCitationCarouselHeader>
                        <InlineCitationCarouselContent>
                          {sources.map((source) => (
                            <InlineCitationCarouselItem key={source.id}>
                              <InlineCitationSource
                                description={source.excerpt}
                                title={source.title}
                                url={source.url}
                              />
                              <InlineCitationQuote>
                                {source.provider}
                              </InlineCitationQuote>
                            </InlineCitationCarouselItem>
                          ))}
                        </InlineCitationCarouselContent>
                      </InlineCitationCarousel>
                    </InlineCitationCardBody>
                  </InlineCitationCard>
                )}
              </InlineCitation>
            </p>
          );
        })}
      </div>
    </div>
  );
}

function VerificationDetails({
  payload,
  zeroG,
}: {
  payload: DiscoverPayload;
  zeroG: ZeroGProof;
}) {
  const errorText = getZeroGError(zeroG);

  return (
    <div className="space-y-3">
      <Task>
        <TaskTrigger title="Verification evidence" />
        <TaskContent>
          <TaskItem>
            <TaskItemFile>
              <ShieldCheckIcon className="size-3" />
              Storage: {zeroG.storage.status}
            </TaskItemFile>
          </TaskItem>
          <TaskItem>
            <TaskItemFile>
              <ShieldCheckIcon className="size-3" />
              Chain: {zeroG.chain.status}
            </TaskItemFile>
          </TaskItem>
          <div className="grid gap-2 md:grid-cols-2">
            <ProofLink
              href={zeroG.storage.explorerUrl}
              label="Storage"
              value={zeroG.storage.txHash || zeroG.storage.rootHash}
            />
            <ProofLink
              href={zeroG.chain.explorerUrl}
              label="Chain"
              value={zeroG.chain.txHash || zeroG.chain.briefHash}
            />
          </div>
        </TaskContent>
      </Task>

      <Tool defaultOpen={false}>
        <ToolHeader
          state={getZeroGToolState(zeroG)}
          title="0G evidence bundle"
          toolName="zeroGProof"
          type="dynamic-tool"
        />
        <ToolContent>
          <ToolInput
            input={{
              sourceCount: payload.sources.length,
              topic: payload.topic,
            }}
          />
          <ToolOutput errorText={errorText} output={zeroG} />
        </ToolContent>
      </Tool>
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
  return [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.id;
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
        (signal) => `- ${signal.label}: ${signal.text}`
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

function isWorkflowStreaming(events: WorkflowProgressEvent[]) {
  const latest = events.at(-1);

  return latest?.status === "pending" || latest?.status === "running";
}

function getSourcesForIds(payload: DiscoverPayload, sourceIds: string[]) {
  if (!sourceIds.length) {
    return [];
  }

  const idSet = new Set(sourceIds);

  return payload.sources.filter((source) => idSet.has(source.id));
}

function getZeroGError(zeroG: ZeroGProof) {
  return zeroG.storage.error || zeroG.chain.error || zeroG.compute?.error;
}

function getZeroGToolState(zeroG: ZeroGProof) {
  if (
    zeroG.storage.status === "failed" ||
    zeroG.chain.status === "failed" ||
    zeroG.compute?.status === "failed"
  ) {
    return "output-error";
  }

  if (
    zeroG.storage.status === "uploaded" ||
    zeroG.chain.status === "anchored" ||
    zeroG.storage.status === "prepared" ||
    zeroG.chain.status === "prepared"
  ) {
    return "output-available";
  }

  return "input-available";
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function getModelContextWindow(modelId: string) {
  if (modelId.includes("claude")) {
    return 200_000;
  }

  if (modelId.includes("gemini")) {
    return 1_000_000;
  }

  if (modelId.includes("gpt-4o")) {
    return 128_000;
  }

  return 32_000;
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1">
      <span>{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}

function ProofLink({
  href,
  label,
  value,
}: {
  href?: string;
  label: string;
  value?: string;
}) {
  const content = (
    <div className="rounded-md border bg-background/70 p-2">
      <p className="font-medium text-foreground">{label}</p>
      <p className="mt-1 break-all">{value || "Not available"}</p>
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <a href={href} rel="noreferrer" target="_blank">
      {content}
    </a>
  );
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
  text: string
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
