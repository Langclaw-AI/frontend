"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { CopyIcon, RefreshCcwIcon, SearchIcon } from "lucide-react";

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
import { Skeleton } from "@/components/ui/skeleton";
import {
  appendProgressSummary,
  buildDirectAnswerContent,
  buildDiscoverAnswerContent,
  CHAT_MODELS,
  consumePendingPrompt,
  createAssistantMessage,
  createChatSession,
  createUserMessage,
  updateSessionMessages,
} from "@/lib/chat-utils";
import {
  dispatchChatSessionsUpdated,
  getChatSession,
  type ChatSession,
  type DiscoverPayload,
  type StoredChatMessage,
  type WorkflowProgressEvent,
  streamChat,
  upsertChatSession,
} from "@/lib/signalgraph-api";
import { useWalletSession } from "@/hooks/use-wallet-session";

type ChatProps = {
  sessionId?: string;
};

type SubmitOptions = {
  baseMessages?: StoredChatMessage[];
  model?: string;
  researchTrend?: boolean;
};

const Chat = ({ sessionId }: ChatProps) => {
  const { getWalletAuth, isConnected, isSigning } = useWalletSession();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<StoredChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(CHAT_MODELS[0].id);
  const [researchTrend, setResearchTrend] = useState(false);
  const [status, setStatus] = useState<
    "submitted" | "streaming" | "ready" | "error"
  >("ready");
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const pendingStartedRef = useRef(false);

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

  const submitMessage = useCallback(
    async (text: string, options: SubmitOptions = {}) => {
      const content = text.trim();

      if (!content || status === "submitted" || status === "streaming") {
        return;
      }

      if (!isConnected) {
        setError("Connect wallet first so Langclaw can save the chat session.");
        setStatus("error");
        return;
      }

      const selectedModel = options.model ?? model;
      const selectedResearchTrend = options.researchTrend ?? researchTrend;
      const baseMessages = options.baseMessages ?? messages;
      const baseSession =
        session ?? createChatSession(content, sessionId ?? undefined);
      const userMessage = createUserMessage(content);
      let assistantMessage = createAssistantMessage(
        selectedResearchTrend ? "Starting SignalGraph workflow..." : ""
      );
      let progressEvents: WorkflowProgressEvent[] = [];
      let workingMessages = [...baseMessages, userMessage, assistantMessage];

      const commitMessages = (nextMessages: StoredChatMessage[]) => {
        workingMessages = nextMessages;
        const nextSession = updateSessionMessages(baseSession, nextMessages);
        setMessages(nextMessages);
        setSession(nextSession);
        return nextSession;
      };

      const updateAssistant = (patch: Partial<StoredChatMessage>) => {
        assistantMessage = {
          ...assistantMessage,
          ...patch,
        };

        return commitMessages(
          workingMessages.map((message) =>
            message.id === assistantMessage.id ? assistantMessage : message
          )
        );
      };

      setError("");
      setSaveError("");
      setStatus("submitted");
      commitMessages(workingMessages);

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        await getWalletAuth();
        setStatus("streaming");

        await streamChat({
          message: content,
          messages: baseMessages.map(({ role, content: messageContent }) => ({
            content: messageContent,
            role,
          })),
          model: selectedModel,
          onDirect: (payload) => {
            updateAssistant({
              content: buildDirectAnswerContent(payload),
              directAnswer: payload,
            });
          },
          onDirectDelta: (delta) => {
            if (!delta) {
              return;
            }

            updateAssistant({
              content: `${assistantMessage.content}${delta}`,
            });
          },
          onError: (message) => {
            updateAssistant({
              content: assistantMessage.content || message,
              error: message,
            });
            setError(message);
          },
          onMode: () => {
            updateAssistant({
              content: "Running SignalGraph research workflow...",
            });
          },
          onProgress: (event) => {
            progressEvents = [...progressEvents, event];
            updateAssistant({
              content: appendProgressSummary(progressEvents),
              progressEvents,
            });
          },
          onResult: (payload: DiscoverPayload) => {
            updateAssistant({
              content: buildDiscoverAnswerContent(payload),
              progressEvents,
              result: payload,
            });
          },
          researchTrend: selectedResearchTrend,
          sessionId: baseSession.id,
          signal: abortController.signal,
        });

        const finalSession = updateSessionMessages(baseSession, workingMessages);
        setSession(finalSession);
        await persistSession(finalSession);
        setStatus("ready");
      } catch (err) {
        const stopped = abortController.signal.aborted;
        const message = stopped
          ? "Stopped."
          : err instanceof Error
            ? err.message
            : "Chat request failed.";

        const finalSession = updateAssistant({
          content: assistantMessage.content || message,
          error: stopped ? undefined : message,
          progressEvents,
          stopped,
        });

        if (!stopped) {
          setError(message);
          setStatus("error");
        } else {
          setStatus("ready");
        }

        try {
          await persistSession(finalSession);
        } catch (saveErr) {
          setSaveError(
            saveErr instanceof Error ? saveErr.message : "Unable to save chat."
          );
        }
      } finally {
        abortRef.current = null;
      }
    },
    [
      getWalletAuth,
      isConnected,
      messages,
      model,
      persistSession,
      researchTrend,
      session,
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

        setSession(nextSession);
        setMessages(nextSession.messages);
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
  }, [getWalletAuth, isConnected, sessionId]);

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
        baseMessages: messages,
        model: pending.model,
        researchTrend: pending.researchTrend,
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loading, messages, sessionId, submitMessage]);

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      const text = message.text.trim();

      if (!text) {
        return;
      }

      setInput("");
      await submitMessage(text);
    },
    [submitMessage]
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleRetry = useCallback(
    (assistantIndex: number) => {
      const userIndex = findPreviousUserMessageIndex(messages, assistantIndex);

      if (userIndex === -1) {
        return;
      }

      const userMessage = messages[userIndex];
      const baseMessages = messages.slice(0, userIndex);
      setMessages(baseMessages);

      if (session) {
        setSession(updateSessionMessages(session, baseMessages));
      }

      void submitMessage(userMessage.content, { baseMessages });
    },
    [messages, session, submitMessage]
  );

  return (
    <div className="mx-auto flex size-full min-h-[calc(100vh-5rem)] flex-col rounded-lg p-6">
      <div className="flex min-h-0 flex-1 flex-col">
        <Conversation>
          <ConversationContent>
            {loading ? (
              <LoadingMessages />
            ) : messages.length === 0 ? (
              <ConversationEmptyState
                description={
                  isConnected
                    ? "Ask Langclaw to chat directly or run SignalGraph research."
                    : "Connect wallet from the sidebar to load and save chats."
                }
                icon={<SearchIcon className="size-5" />}
                title="Start a Langclaw chat"
              />
            ) : (
              messages.map((message, messageIndex) => (
                <Fragment key={message.id}>
                  <Message from={message.role}>
                    <MessageContent>
                      <MessageResponse>{message.content}</MessageResponse>
                      <MessageDetails message={message} />
                    </MessageContent>
                  </Message>
                  {message.role === "assistant" && (
                    <MessageActions>
                      <MessageAction
                        disabled={status === "submitted" || status === "streaming"}
                        label="Retry"
                        onClick={() => handleRetry(messageIndex)}
                      >
                        <RefreshCcwIcon className="size-3" />
                      </MessageAction>
                      <MessageAction
                        label="Copy"
                        onClick={() =>
                          navigator.clipboard.writeText(message.content)
                        }
                      >
                        <CopyIcon className="size-3" />
                      </MessageAction>
                    </MessageActions>
                  )}
                </Fragment>
              ))
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {(error || saveError) && (
          <div className="mx-auto mt-3 w-full max-w-2xl rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error || saveError}
          </div>
        )}

        <PromptInput
          className="relative mx-auto mt-4 w-full max-w-2xl"
          onSubmit={handleSubmit}
        >
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
              <PromptInputButton
                onClick={() => setResearchTrend((value) => !value)}
                variant={researchTrend ? "default" : "ghost"}
              >
                <SearchIcon size={16} />
                <span>Search</span>
              </PromptInputButton>
              <select
                aria-label="Model"
                className="h-8 rounded-md border bg-background px-2 text-xs text-muted-foreground"
                onChange={(event) => setModel(event.currentTarget.value)}
                value={model}
              >
                {CHAT_MODELS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
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

function MessageDetails({ message }: { message: StoredChatMessage }) {
  if (
    !message.result &&
    !message.directAnswer &&
    !message.progressEvents?.length &&
    !message.error &&
    !message.stopped
  ) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
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

      {message.progressEvents?.length ? (
        <div className="space-y-2">
          <p className="font-medium text-foreground">Agent progress</p>
          <div className="grid gap-2">
            {message.progressEvents.map((event, index) => (
              <div
                className="grid gap-1 rounded-md border bg-background/70 p-2"
                key={`${event.stepId}-${event.status}-${event.timestamp}-${index}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">
                    {event.agent}
                  </span>
                  <StatusPill label={event.skill} value={event.status} />
                  {event.execution && (
                    <StatusPill label="Exec" value={event.execution} />
                  )}
                </div>
                <p>{event.summary}</p>
              </div>
            ))}
          </div>
        </div>
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

      {payload.sources.length > 0 && (
        <div className="space-y-2">
          <p className="font-medium text-foreground">Sources</p>
          <div className="grid gap-2">
            {payload.sources.slice(0, 6).map((source) => (
              <a
                className="rounded-md border bg-background/70 p-2 transition-colors hover:bg-muted"
                href={source.url}
                key={source.id}
                rel="noreferrer"
                target="_blank"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground">
                    {source.title}
                  </span>
                  <span>{source.provider}</span>
                </div>
                <p className="mt-1 line-clamp-2">{source.excerpt}</p>
              </a>
            ))}
          </div>
        </div>
      )}

      {zeroG && (
        <div className="space-y-2">
          <p className="font-medium text-foreground">Verification</p>
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
        </div>
      )}
    </div>
  );
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

function findPreviousUserMessageIndex(
  messages: StoredChatMessage[],
  assistantIndex: number
) {
  for (let index = assistantIndex - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") {
      return index;
    }
  }

  return -1;
}

export default Chat;
