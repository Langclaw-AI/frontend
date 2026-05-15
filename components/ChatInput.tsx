"use client";

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
import { CheckIcon, GlobeIcon } from "lucide-react";
import type { Experimental_TranscriptionResult } from "ai";
import { memo, useCallback, useState } from "react";
import { SparklesText } from "./ui/sparkles-text";
import { useRouter } from "next/navigation";

import {
  CHAT_MODELS,
  createChatSession,
  savePendingPrompt,
} from "@/lib/chat-utils";
import {
  dispatchChatSessionsUpdated,
  upsertChatSession,
} from "@/lib/signalgraph-api";
import { useWalletSession } from "@/hooks/use-wallet-session";

const SUBMITTING_TIMEOUT = 200;
const STREAMING_TIMEOUT = 2000;
const CHAT_INPUT_SUGGESTIONS = [
  "Find the strongest AI x Web3 product trends this week",
  "Map evidence for 0G agent infrastructure",
  "Give me a builder-ready demo angle",
];

type TranscriptionSegments = Experimental_TranscriptionResult["segments"];

interface ModelItemProps {
  m: (typeof CHAT_MODELS)[number];
  selectedModel: string;
  onSelect: (id: string) => void;
}

const ModelItem = memo(({ m, selectedModel, onSelect }: ModelItemProps) => {
  const handleSelect = useCallback(() => onSelect(m.id), [onSelect, m.id]);
  return (
    <ModelSelectorItem key={m.id} onSelect={handleSelect} value={m.id}>
      <ModelSelectorLogo provider={m.chefSlug} />
      <ModelSelectorName>{m.name}</ModelSelectorName>
      <ModelSelectorLogoGroup>
        {m.providers.map((provider) => (
          <ModelSelectorLogo key={provider} provider={provider} />
        ))}
      </ModelSelectorLogoGroup>
      {selectedModel === m.id ? (
        <CheckIcon className="ml-auto size-4" />
      ) : (
        <div className="ml-auto size-4" />
      )}
    </ModelSelectorItem>
  );
});

ModelItem.displayName = "ModelItem";

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
    [onTranscript, textInput]
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
  const [model, setModel] = useState<string>(CHAT_MODELS[0].id);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [researchTrend, setResearchTrend] = useState(false);
  const [error, setError] = useState("");
  const [speechSegments, setSpeechSegments] = useState<TranscriptionSegments>(
    []
  );
  const [status, setStatus] = useState<
    "submitted" | "streaming" | "ready" | "error"
  >("ready");

  const selectedModelData = CHAT_MODELS.find((m) => m.id === model);

  const handleModelSelect = useCallback((id: string) => {
    setModel(id);
    setModelSelectorOpen(false);
  }, []);

  const handleSpeechTranscript = useCallback((text: string) => {
    setSpeechSegments((segments) => appendTranscriptionSegment(segments, text));
  }, []);

  const handleSubmit = useCallback(async (message: PromptInputMessage) => {
    const text = message.text.trim();
    const hasText = Boolean(text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    if (hasAttachments) {
      setError("File attachments are not supported by the current chat backend.");
      setStatus("error");
      return;
    }

    if (!isConnected) {
      setError("Connect wallet first so Langclaw can create a saved chat session.");
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
        model,
        researchTrend,
        text,
      });

      await upsertChatSession(wallet, session);
      dispatchChatSessionsUpdated();
      setStatus("streaming");

      setTimeout(() => {
        router.push(`/chat/${session.id}`);
      }, SUBMITTING_TIMEOUT);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start the chat session."
      );
      setStatus("error");

      setTimeout(() => {
        setStatus("ready");
      }, STREAMING_TIMEOUT);
    }
  }, [getWalletAuth, isConnected, model, researchTrend, router]);

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
                    {["0G Compute", "OpenAI", "Anthropic", "Google"].map((chef) => (
                      <ModelSelectorGroup heading={chef} key={chef}>
                        {CHAT_MODELS
                          .filter((m) => m.chef === chef)
                          .map((m) => (
                            <ModelItem
                              key={m.id}
                              m={m}
                              onSelect={handleModelSelect}
                              selectedModel={model}
                            />
                          ))}
                      </ModelSelectorGroup>
                    ))}
                  </ModelSelectorList>
                </ModelSelectorContent>
              </ModelSelector>
            </PromptInputTools>
            <PromptInputSubmit disabled={isSigning} status={status} />
          </PromptInputFooter>
        </PromptInput>
        <ChatInputSuggestions />
      </PromptInputProvider>
      {error && (
        <p className="max-w-2xl text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
};

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

export default ChatInput;
