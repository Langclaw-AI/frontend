"use client";

import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
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
  PromptInputActionAddAttachments,
  PromptInputActionAddScreenshot,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { CheckIcon, GlobeIcon } from "lucide-react";
import type { FileUIPart } from "ai";
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

interface AttachmentItemProps {
  attachment: FileUIPart & { id: string };
  onRemove: (id: string) => void;
}

const AttachmentItem = memo(({ attachment, onRemove }: AttachmentItemProps) => {
  const handleRemove = useCallback(
    () => onRemove(attachment.id),
    [onRemove, attachment.id],
  );
  return (
    <Attachment data={attachment} key={attachment.id} onRemove={handleRemove}>
      <AttachmentPreview />
      <AttachmentRemove />
    </Attachment>
  );
});

AttachmentItem.displayName = "AttachmentItem";

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

const PromptInputAttachmentsDisplay = () => {
  const attachments = usePromptInputAttachments();

  const handleRemove = useCallback(
    (id: string) => attachments.remove(id),
    [attachments],
  );

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <Attachments variant="inline">
      {attachments.files.map((attachment) => (
        <AttachmentItem
          attachment={attachment}
          key={attachment.id}
          onRemove={handleRemove}
        />
      ))}
    </Attachments>
  );
};

const ChatInput = () => {
  const router = useRouter();
  const { getWalletAuth, isConnected, isSigning } = useWalletSession();
  const [model, setModel] = useState<string>(CHAT_MODELS[0].id);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [researchTrend, setResearchTrend] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<
    "submitted" | "streaming" | "ready" | "error"
  >("ready");

  const selectedModelData = CHAT_MODELS.find((m) => m.id === model);

  const handleModelSelect = useCallback((id: string) => {
    setModel(id);
    setModelSelectorOpen(false);
  }, []);

  const handleSubmit = useCallback(async (message: PromptInputMessage) => {
    const text = message.text.trim();
    const hasText = Boolean(text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    if (!isConnected) {
      setError("Connect wallet first so Langclaw can create a saved chat session.");
      setStatus("error");
      return;
    }

    setStatus("submitted");
    setError("");

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
    <div className="size-full mx-auto flex flex-col h-full justify-center items-center gap-10">
      <div className="flex items-end text-4xl gap-2">
        <span>Welcome to</span>
        <SparklesText className="text-5xl">Langclaw,</SparklesText>
        <span>how can I help?</span>
      </div>
      <PromptInputProvider>
        <PromptInput globalDrop multiple onSubmit={handleSubmit}>
          <PromptInputAttachmentsDisplay />
          <PromptInputBody>
            <PromptInputTextarea />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                  <PromptInputActionAddScreenshot />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
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
      </PromptInputProvider>
      {error && (
        <p className="max-w-2xl text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
};

export default ChatInput;
