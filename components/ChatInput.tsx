"use client";

import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { SpeechInput } from "@/components/ai-elements/speech-input";
import {
  Transcription,
  TranscriptionSegment,
} from "@/components/ai-elements/transcription";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CpuIcon, GlobeIcon } from "lucide-react";
import type { Experimental_TranscriptionResult } from "ai";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SparklesText } from "./ui/sparkles-text";
import { useRouter } from "next/navigation";

import { createChatSession, savePendingPrompt } from "@/lib/chat-utils";
import {
  dispatchChatSessionsUpdated,
  upsertChatSession,
} from "@/lib/signalgraph-api";
import { useWalletSession } from "@/hooks/use-wallet-session";
import {
  DEFAULT_CHAT_MODEL_ID,
  getModelLabel,
  useRouterModels,
} from "@/hooks/use-router-models";

const SUBMITTING_TIMEOUT = 200;
const STREAMING_TIMEOUT = 2000;
const CHAT_INPUT_SUGGESTIONS = [
  "Find the strongest AI x Web3 product trends this week",
  "Map evidence for 0G agent infrastructure",
  "Give me a builder-ready demo angle",
];

type TranscriptionSegments = Experimental_TranscriptionResult["segments"];

const ChatInputSuggestions = () => {
  const { textInput } = usePromptInputController();

  return (
    <Suggestions className="max-w-2xl justify-center">
      {CHAT_INPUT_SUGGESTIONS.map((suggestion) => (
        <Suggestion
          key={suggestion}
          onClick={textInput.setInput}
          suggestion={suggestion}
        />
      ))}
    </Suggestions>
  );
};

function ChatInputSpeechButton({
  onTranscript,
}: {
  onTranscript: (text: string) => void;
}) {
  const { textInput } = usePromptInputController();

  const handleTranscriptionChange = useCallback(
    (text: string) => {
      textInput.setInput(appendSpeechText(textInput.value, text));
      onTranscript(text);
    },
    [onTranscript, textInput],
  );

  return (
    <SpeechInput
      aria-label="Dictate prompt"
      lang="en-US"
      onTranscriptionChange={handleTranscriptionChange}
      size="icon-sm"
      variant="ghost"
    />
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

const ChatInput = () => {
  const router = useRouter();
  const { getWalletAuth, isConnected, isSigning } = useWalletSession();
  const { chatModels, error: modelsError, isLoading: isLoadingModels } =
    useRouterModels();
  const [selectedModel, setSelectedModel] = useState(DEFAULT_CHAT_MODEL_ID);
  const [researchTrend, setResearchTrend] = useState(false);
  const [error, setError] = useState("");
  const [speechSegments, setSpeechSegments] = useState<TranscriptionSegments>(
    [],
  );
  const [status, setStatus] = useState<
    "submitted" | "streaming" | "ready" | "error"
  >("ready");

  const handleSpeechTranscript = useCallback((text: string) => {
    setSpeechSegments((segments) => appendTranscriptionSegment(segments, text));
  }, []);

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

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      const text = message.text.trim();
      const hasText = Boolean(text);
      const hasAttachments = Boolean(message.files?.length);

      if (!(hasText || hasAttachments)) {
        return;
      }

      if (hasAttachments) {
        showError(
          setError,
          "File attachments are not supported by the current chat backend.",
        );
        setStatus("error");
        return;
      }

      if (!isConnected) {
        showError(
          setError,
          "Connect wallet first so Langclaw can create a saved chat session.",
        );
        setStatus("error");
        return;
      }

      setStatus("submitted");
      setError("");
      setSpeechSegments([]);

      try {
        const wallet = await getWalletAuth();
        const session = createChatSession(text);

        savePendingPrompt(session.id, {
          model: selectedModel,
          researchTrend,
          text,
        });

        await upsertChatSession(wallet, session);
        dispatchChatSessionsUpdated();
        setStatus("streaming");
        toast.success("Chat session created", {
          description: researchTrend ? "Search mode is ready." : selectedModel,
        });

        setTimeout(() => {
          router.push(`/chat/${session.id}`);
        }, SUBMITTING_TIMEOUT);
      } catch (err) {
        showError(
          setError,
          err instanceof Error
            ? err.message
            : "Unable to start the chat session.",
        );
        setStatus("error");

        setTimeout(() => {
          setStatus("ready");
        }, STREAMING_TIMEOUT);
      }
    },
    [getWalletAuth, isConnected, researchTrend, router, selectedModel],
  );

  return (
    <div className="mx-auto flex size-full h-full flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-wrap items-end justify-center gap-2 text-center font-medium text-3xl md:text-4xl">
        <span>Welcome to</span>
        <SparklesText className="text-4xl md:text-5xl">Langclaw,</SparklesText>
        <span>how can I help?</span>
      </div>
      <PromptInputProvider>
        <PromptInput className="w-full max-w-2xl" onSubmit={handleSubmit}>
          <SpeechTranscriptionPreview segments={speechSegments} />
          <PromptInputBody>
            <PromptInputTextarea />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <ChatInputSpeechButton onTranscript={handleSpeechTranscript} />
              <PromptInputButton
                onClick={() => setResearchTrend((value) => !value)}
                variant={researchTrend ? "default" : "ghost"}
              >
                <GlobeIcon size={16} />
                <span>Search</span>
              </PromptInputButton>
              <ModelSelect
                models={chatModels}
                onChange={setSelectedModel}
                value={selectedModel}
              />
            </PromptInputTools>
            <PromptInputSubmit disabled={isSigning} status={status} />
          </PromptInputFooter>
        </PromptInput>
        <ChatInputSuggestions />
      </PromptInputProvider>
      {(error || modelsError) && (
        <p className="max-w-2xl text-center text-sm text-destructive">
          {error || (isLoadingModels ? "" : modelsError)}
        </p>
      )}
    </div>
  );
};

function showError(setError: (message: string) => void, message: string) {
  setError(message);
  toast.error(message);
}

function ModelSelect({
  models,
  onChange,
  value,
}: {
  models: ReturnType<typeof useRouterModels>["chatModels"];
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
        <CpuIcon className="size-4 text-muted-foreground" />
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

export default ChatInput;
