"use client";

import { useEffect, useMemo, useState } from "react";

import {
  listZeroGModels,
  type RouterModel,
} from "@/lib/signalgraph-api";

export const DEFAULT_CHAT_MODEL_ID = "0GM-1.0-35B-A3B";
export const DEFAULT_IMAGE_MODEL_ID = "z-image";
export const DEFAULT_AUDIO_MODEL_ID = "openai/whisper-large-v3";

const fallbackModels: RouterModel[] = [
  {
    id: DEFAULT_CHAT_MODEL_ID,
    name: "0G Mainnet Chat",
    type: "chatbot",
  },
  {
    id: DEFAULT_IMAGE_MODEL_ID,
    name: "0G Image",
    type: "text-to-image",
  },
  {
    id: DEFAULT_AUDIO_MODEL_ID,
    name: "Whisper Large v3",
    type: "audio",
  },
];

export function useRouterModels() {
  const [models, setModels] = useState<RouterModel[]>(fallbackModels);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
      listZeroGModels()
        .then((payload) => {
          if (!active) {
            return;
          }

          setModels(payload.data.length ? payload.data : fallbackModels);
          setError("");
        })
        .catch((err) => {
          if (!active) {
            return;
          }

          setModels(fallbackModels);
          setError(
            err instanceof Error ? err.message : "Unable to load 0G models."
          );
        })
        .finally(() => {
          if (active) {
            setIsLoading(false);
          }
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, []);

  return useMemo(
    () => ({
      audioModels: models.filter((model) => modelSupportsService(model, "audio")),
      chatModels: models.filter((model) => modelSupportsService(model, "chat")),
      error,
      imageModels: models.filter((model) => modelSupportsService(model, "image")),
      isLoading,
      models,
    }),
    [error, isLoading, models]
  );
}

export function getModelLabel(model: RouterModel) {
  return model.name && model.name !== model.id ? `${model.name} (${model.id})` : model.id;
}

export function modelSupportsService(
  model: RouterModel,
  service: "audio" | "chat" | "image"
) {
  const id = model.id.toLowerCase();
  const type = String(model.type ?? "").toLowerCase();
  const hasPromptPricing = Boolean(model.pricing?.prompt);
  const hasCompletionPricing = Boolean(model.pricing?.completion);
  const hasImagePricing = Boolean(model.pricing?.image);

  if (service === "image") {
    return (
      hasImagePricing ||
      type.includes("image") ||
      type.includes("text-to-image") ||
      id.includes("image")
    );
  }

  if (service === "audio") {
    return (
      type.includes("audio") ||
      type.includes("speech") ||
      type.includes("transcription") ||
      id.includes("whisper")
    );
  }

  if (type.includes("image") || type.includes("audio") || id.includes("whisper")) {
    return false;
  }

  return (
    hasPromptPricing ||
    hasCompletionPricing ||
    type.includes("chat") ||
    type.includes("llm") ||
    type.includes("language") ||
    type.includes("instruct") ||
    !type
  );
}
