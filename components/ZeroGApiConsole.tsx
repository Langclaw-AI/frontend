"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import {
  AlertCircleIcon,
  ImageIcon,
  Loader2Icon,
  MicIcon,
  PlayIcon,
  RefreshCcwIcon,
  ShieldIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useWalletSession } from "@/hooks/use-wallet-session";
import {
  DEFAULT_AUDIO_MODEL_ID,
  DEFAULT_CHAT_MODEL_ID,
  DEFAULT_IMAGE_MODEL_ID,
  getModelLabel,
  modelSupportsService,
} from "@/hooks/use-router-models";
import {
  createZeroGChatCompletion,
  generateZeroGImage,
  getZeroGAdminAccountBalance,
  getZeroGAdminUsageHistory,
  getZeroGAdminUsageStats,
  getZeroGAsyncJob,
  listZeroGModels,
  listZeroGProviders,
  streamZeroGChatCompletion,
  submitZeroGAsyncImage,
  transcribeZeroGAudio,
  type RouterModel,
  type ZeroGAsyncImagePayload,
  type ZeroGAsyncJobPayload,
  type ZeroGChatCompletionPayload,
  type ZeroGChatStreamResult,
  type ZeroGImagePayload,
} from "@/lib/signalgraph-api";

type LoadingKey =
  | ""
  | "admin"
  | "async-job"
  | "async-submit"
  | "audio"
  | "chat"
  | "image"
  | "models"
  | "providers";

const defaultMessage = "Give me one concise product idea for 0G builders.";
const defaultImagePrompt = "A clean dashboard for decentralized AI usage billing";

export default function ZeroGApiConsole() {
  const { getWalletAuth, isConnected, isSigning } = useWalletSession();
  const [models, setModels] = useState<RouterModel[]>([]);
  const [loading, setLoading] = useState<LoadingKey>("");
  const [error, setError] = useState("");

  const [providerModel, setProviderModel] = useState(DEFAULT_CHAT_MODEL_ID);
  const [providerService, setProviderService] = useState<
    "audio" | "chat" | "image"
  >("chat");
  const [providerResult, setProviderResult] = useState<unknown>(null);

  const [chatModel, setChatModel] = useState(DEFAULT_CHAT_MODEL_ID);
  const [chatPrompt, setChatPrompt] = useState(defaultMessage);
  const [chatStreaming, setChatStreaming] = useState(true);
  const [chatText, setChatText] = useState("");
  const [chatResult, setChatResult] = useState<
    ZeroGChatCompletionPayload | ZeroGChatStreamResult | null
  >(null);

  const [imageModel, setImageModel] = useState(DEFAULT_IMAGE_MODEL_ID);
  const [imagePrompt, setImagePrompt] = useState(defaultImagePrompt);
  const [imageResult, setImageResult] = useState<ZeroGImagePayload | null>(null);

  const [asyncResult, setAsyncResult] =
    useState<ZeroGAsyncImagePayload | null>(null);
  const [asyncJobResult, setAsyncJobResult] =
    useState<ZeroGAsyncJobPayload | null>(null);
  const [asyncJobId, setAsyncJobId] = useState("");
  const [asyncReservationId, setAsyncReservationId] = useState("");

  const [audioModel, setAudioModel] = useState(DEFAULT_AUDIO_MODEL_ID);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioLanguage, setAudioLanguage] = useState("");
  const [audioResult, setAudioResult] = useState<unknown>(null);

  const [adminKey, setAdminKey] = useState("");
  const [adminLimit, setAdminLimit] = useState("25");
  const [adminResult, setAdminResult] = useState<unknown>(null);

  const chatModels = useMemo(
    () => models.filter((model) => modelSupportsService(model, "chat")),
    [models]
  );
  const imageModels = useMemo(
    () => models.filter((model) => modelSupportsService(model, "image")),
    [models]
  );
  const audioModels = useMemo(
    () => models.filter((model) => modelSupportsService(model, "audio")),
    [models]
  );

  const showError = (message: string) => {
    setError(message);
    toast.error(message);
  };

  const reportError = (err: unknown, fallback: string) => {
    showError(err instanceof Error ? err.message : fallback);
  };

  const refreshModels = async (silent = false) => {
    setLoading("models");
    setError("");

    try {
      const payload = await listZeroGModels();
      setModels(payload.data);
      setChatModel(selectExisting(payload.data, "chat", chatModel));
      setProviderModel(selectExisting(payload.data, "chat", providerModel));
      setImageModel(selectExisting(payload.data, "image", imageModel));
      setAudioModel(selectExisting(payload.data, "audio", audioModel));
      if (!silent) {
        toast.success("Models loaded", {
          description: `${payload.data.length} models available from 0G Router.`,
        });
      }
    } catch (err) {
      reportError(err, "Unable to load models.");
    } finally {
      setLoading("");
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshModels(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requireWallet = async () => {
    if (!isConnected) {
      throw new Error("Connect wallet first.");
    }

    return getWalletAuth();
  };

  const handleProviders = async () => {
    setLoading("providers");
    setError("");

    try {
      const payload = await listZeroGProviders({
        model: providerModel,
        service_type: providerService,
      });
      setProviderResult(payload);
      toast.success("Providers loaded");
    } catch (err) {
      reportError(err, "Unable to load providers.");
    } finally {
      setLoading("");
    }
  };

  const handleChat = async () => {
    setLoading("chat");
    setError("");
    setChatText("");
    setChatResult(null);

    try {
      const wallet = await requireWallet();
      const request = {
        max_tokens: 600,
        messages: [{ content: chatPrompt, role: "user" as const }],
        model: chatModel,
        stream: chatStreaming,
        wallet,
      };

      if (chatStreaming) {
        await streamZeroGChatCompletion({
          onDelta: (delta) => setChatText((current) => current + delta),
          onError: showError,
          onResult: (payload) => {
            setChatResult(payload);
            toast.success("Chat completion finished", {
              description: payload.model ?? chatModel,
            });
          },
          request,
        });
      } else {
        const payload = await createZeroGChatCompletion(request);
        setChatResult(payload);
        setChatText(readAssistantText(payload));
        toast.success("Chat completion finished", {
          description: chatModel,
        });
      }
    } catch (err) {
      reportError(err, "Chat completion failed.");
    } finally {
      setLoading("");
    }
  };

  const handleImage = async () => {
    setLoading("image");
    setError("");
    setImageResult(null);

    try {
      const wallet = await requireWallet();
      const payload = await generateZeroGImage({
        model: imageModel,
        n: 1,
        prompt: imagePrompt,
        wallet,
      });
      setImageResult(payload);
      toast.success("Image generated", {
        description: imageModel,
      });
    } catch (err) {
      reportError(err, "Image generation failed.");
    } finally {
      setLoading("");
    }
  };

  const handleAsyncSubmit = async () => {
    setLoading("async-submit");
    setError("");
    setAsyncResult(null);
    setAsyncJobResult(null);

    try {
      const wallet = await requireWallet();
      const payload = await submitZeroGAsyncImage({
        model: imageModel,
        n: 1,
        prompt: imagePrompt,
        wallet,
      });
      setAsyncResult(payload);
      setAsyncJobId(readAsyncJobId(payload));
      setAsyncReservationId(payload.billing?.reservationId ?? "");
      toast.success("Async image job submitted", {
        description: readAsyncJobId(payload) || "Job id returned by router.",
      });
    } catch (err) {
      reportError(err, "Async image submit failed.");
    } finally {
      setLoading("");
    }
  };

  const handleAsyncJob = async () => {
    if (!asyncJobId.trim() || !asyncReservationId.trim()) {
      showError("Job id and reservation id are required.");
      return;
    }

    setLoading("async-job");
    setError("");

    try {
      const wallet = await requireWallet();
      const payload = await getZeroGAsyncJob({
        jobId: asyncJobId.trim(),
        model: imageModel,
        reservationId: asyncReservationId.trim(),
        wallet,
      });
      setAsyncJobResult(payload);
      toast.success("Async job loaded", {
        description: payload.status ?? "Router job response received.",
      });
    } catch (err) {
      reportError(err, "Async job lookup failed.");
    } finally {
      setLoading("");
    }
  };

  const handleAudio = async () => {
    if (!audioFile) {
      showError("Audio file is required.");
      return;
    }

    setLoading("audio");
    setError("");
    setAudioResult(null);

    try {
      const wallet = await requireWallet();
      const payload = await transcribeZeroGAudio({
        file: audioFile,
        language: audioLanguage.trim() || undefined,
        model: audioModel,
        wallet,
      });
      setAudioResult(payload);
      toast.success("Audio transcribed", {
        description: payload.text ? "Transcript returned." : audioModel,
      });
    } catch (err) {
      reportError(err, "Audio transcription failed.");
    } finally {
      setLoading("");
    }
  };

  const handleAdmin = async (kind: "balance" | "history" | "stats") => {
    if (!adminKey.trim()) {
      showError("Admin key is required.");
      return;
    }

    setLoading("admin");
    setError("");

    try {
      const query = { limit: adminLimit || undefined };
      const payload =
        kind === "balance"
          ? await getZeroGAdminAccountBalance(adminKey.trim())
          : kind === "stats"
            ? await getZeroGAdminUsageStats(adminKey.trim(), query)
            : await getZeroGAdminUsageHistory(adminKey.trim(), query);
      setAdminResult(payload);
      toast.success(`Admin ${kind} loaded`);
    } catch (err) {
      reportError(err, "Admin request failed.");
    } finally {
      setLoading("");
    }
  };

  const imageData = readImageData(imageResult);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-semibold text-2xl">API Console</h1>
          <p className="text-muted-foreground text-sm">
            0G router, wallet billing, and admin endpoints.
          </p>
        </div>
        <Button
          disabled={loading === "models"}
          onClick={() => void refreshModels()}
          size="sm"
          variant="outline"
        >
          {loading === "models" ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <RefreshCcwIcon className="size-4" />
          )}
          Models
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircleIcon className="size-4" />
          <AlertTitle>Endpoint error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="models">
        <TabsList className="flex h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="image">Image</TabsTrigger>
          <TabsTrigger value="async">Async image</TabsTrigger>
          <TabsTrigger value="audio">Audio</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
        </TabsList>

        <TabsContent value="models">
          <Card className="rounded-lg" size="sm">
            <CardHeader>
              <CardTitle>Models</CardTitle>
              <CardDescription>GET /api/0g/models</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Providers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models.map((model) => (
                    <TableRow key={model.id}>
                      <TableCell className="max-w-80 truncate font-medium">
                        {model.id}
                      </TableCell>
                      <TableCell>{model.type ?? "Not available"}</TableCell>
                      <TableCell className="text-right">
                        {model.provider_count ?? "Not available"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers">
          <EndpointCard
            action={
              <Button
                disabled={loading === "providers"}
                onClick={() => void handleProviders()}
                size="sm"
              >
                {loading === "providers" && (
                  <Loader2Icon className="size-4 animate-spin" />
                )}
                Fetch
              </Button>
            }
            description="GET /api/0g/providers"
            title="Providers"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <ModelPicker
                models={models}
                onChange={setProviderModel}
                service={providerService}
                value={providerModel}
              />
              <Select
                onValueChange={(value) =>
                  setProviderService(value as "audio" | "chat" | "image")
                }
                value={providerService}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chat">chat</SelectItem>
                  <SelectItem value="image">image</SelectItem>
                  <SelectItem value="audio">audio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <JsonBlock value={providerResult} />
          </EndpointCard>
        </TabsContent>

        <TabsContent value="chat">
          <EndpointCard
            action={
              <Button
                disabled={loading === "chat" || isSigning}
                onClick={() => void handleChat()}
                size="sm"
              >
                {loading === "chat" ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <PlayIcon className="size-4" />
                )}
                Run
              </Button>
            }
            description="POST /api/0g/chat/completions"
            title="Chat completions"
          >
            <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
              <ModelPicker
                models={chatModels}
                onChange={setChatModel}
                service="chat"
                value={chatModel}
              />
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={chatStreaming} onCheckedChange={setChatStreaming} />
                Stream
              </label>
            </div>
            <Textarea
              className="min-h-24"
              onChange={(event) => setChatPrompt(event.currentTarget.value)}
              value={chatPrompt}
            />
            {chatText && (
              <div className="rounded-md border bg-muted/30 p-3 whitespace-pre-wrap">
                {chatText}
              </div>
            )}
            <JsonBlock value={chatResult} />
          </EndpointCard>
        </TabsContent>

        <TabsContent value="image">
          <EndpointCard
            action={
              <Button
                disabled={loading === "image" || isSigning}
                onClick={() => void handleImage()}
                size="sm"
              >
                {loading === "image" ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <ImageIcon className="size-4" />
                )}
                Generate
              </Button>
            }
            description="POST /api/0g/images/generations"
            title="Image generation"
          >
            <ModelPicker
              models={imageModels}
              onChange={setImageModel}
              service="image"
              value={imageModel}
            />
            <Textarea
              className="min-h-24"
              onChange={(event) => setImagePrompt(event.currentTarget.value)}
              value={imagePrompt}
            />
            {imageData && (
              <Image
                alt="0G generated"
                className="max-h-[420px] rounded-md border object-contain"
                height={1024}
                src={`data:image/png;base64,${imageData}`}
                unoptimized
                width={1024}
              />
            )}
            <JsonBlock value={imageResult} />
          </EndpointCard>
        </TabsContent>

        <TabsContent value="async">
          <EndpointCard
            action={
              <div className="flex gap-2">
                <Button
                  disabled={loading === "async-submit" || isSigning}
                  onClick={() => void handleAsyncSubmit()}
                  size="sm"
                >
                  {loading === "async-submit" && (
                    <Loader2Icon className="size-4 animate-spin" />
                  )}
                  Submit
                </Button>
                <Button
                  disabled={loading === "async-job" || isSigning}
                  onClick={() => void handleAsyncJob()}
                  size="sm"
                  variant="outline"
                >
                  {loading === "async-job" && (
                    <Loader2Icon className="size-4 animate-spin" />
                  )}
                  Poll
                </Button>
              </div>
            }
            description="POST /api/0g/async/images/generations and GET /api/0g/async/jobs/:jobId"
            title="Async image job"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                onChange={(event) => setAsyncJobId(event.currentTarget.value)}
                placeholder="job id"
                value={asyncJobId}
              />
              <Input
                onChange={(event) =>
                  setAsyncReservationId(event.currentTarget.value)
                }
                placeholder="reservation id"
                value={asyncReservationId}
              />
            </div>
            <JsonBlock label="Submit response" value={asyncResult} />
            <JsonBlock label="Job response" value={asyncJobResult} />
          </EndpointCard>
        </TabsContent>

        <TabsContent value="audio">
          <EndpointCard
            action={
              <Button
                disabled={loading === "audio" || isSigning}
                onClick={() => void handleAudio()}
                size="sm"
              >
                {loading === "audio" ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <MicIcon className="size-4" />
                )}
                Transcribe
              </Button>
            }
            description="POST /api/0g/audio/transcriptions"
            title="Audio transcription"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <ModelPicker
                models={audioModels}
                onChange={setAudioModel}
                service="audio"
                value={audioModel}
              />
              <Input
                onChange={(event) => setAudioLanguage(event.currentTarget.value)}
                placeholder="language"
                value={audioLanguage}
              />
            </div>
            <Input
              accept="audio/*"
              onChange={(event) =>
                setAudioFile(event.currentTarget.files?.[0] ?? null)
              }
              type="file"
            />
            <JsonBlock value={audioResult} />
          </EndpointCard>
        </TabsContent>

        <TabsContent value="admin">
          <EndpointCard
            action={
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={loading === "admin"}
                  onClick={() => void handleAdmin("balance")}
                  size="sm"
                  variant="outline"
                >
                  <ShieldIcon className="size-4" />
                  Balance
                </Button>
                <Button
                  disabled={loading === "admin"}
                  onClick={() => void handleAdmin("stats")}
                  size="sm"
                  variant="outline"
                >
                  Stats
                </Button>
                <Button
                  disabled={loading === "admin"}
                  onClick={() => void handleAdmin("history")}
                  size="sm"
                  variant="outline"
                >
                  History
                </Button>
              </div>
            }
            description="GET /api/0g/admin/account/*"
            title="Admin account"
          >
            <div className="grid gap-3 md:grid-cols-[1fr_8rem]">
              <Input
                onChange={(event) => setAdminKey(event.currentTarget.value)}
                placeholder="admin key"
                type="password"
                value={adminKey}
              />
              <Input
                onChange={(event) => setAdminLimit(event.currentTarget.value)}
                placeholder="limit"
                value={adminLimit}
              />
            </div>
            <JsonBlock value={adminResult} />
          </EndpointCard>
        </TabsContent>
      </Tabs>

      {!isConnected && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Badge variant="outline">Wallet required</Badge>
          Inference endpoints reserve usage from the connected wallet.
        </div>
      )}
    </div>
  );
}

function EndpointCard({
  action,
  children,
  description,
  title,
}: {
  action: ReactNode;
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <Card className="rounded-lg" size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>{action}</CardAction>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function ModelPicker({
  models,
  onChange,
  service,
  value,
}: {
  models: RouterModel[];
  onChange: (value: string) => void;
  service: "audio" | "chat" | "image";
  value: string;
}) {
  const fallback =
    service === "image"
      ? DEFAULT_IMAGE_MODEL_ID
      : service === "audio"
        ? DEFAULT_AUDIO_MODEL_ID
        : DEFAULT_CHAT_MODEL_ID;
  const options = models.length ? models : [{ id: fallback }];

  return (
    <Select onValueChange={onChange} value={value || fallback}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-w-96">
        {options.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            {getModelLabel(model)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function JsonBlock({
  label = "Response",
  value,
}: {
  label?: string;
  value: unknown;
}) {
  if (!value) {
    return null;
  }

  return (
    <div className="space-y-1">
      <p className="font-medium text-sm">{label}</p>
      <pre className="max-h-80 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function selectExisting(
  models: RouterModel[],
  service: "audio" | "chat" | "image",
  current: string
) {
  const filtered = models.filter((model) => modelSupportsService(model, service));

  if (filtered.some((model) => model.id === current)) {
    return current;
  }

  return (
    filtered[0]?.id ??
    (service === "image"
      ? DEFAULT_IMAGE_MODEL_ID
      : service === "audio"
        ? DEFAULT_AUDIO_MODEL_ID
        : DEFAULT_CHAT_MODEL_ID)
  );
}

function readAssistantText(payload: Record<string, unknown>) {
  const choices = payload.choices;

  if (!Array.isArray(choices)) {
    return "";
  }

  const first = choices[0] as Record<string, unknown> | undefined;
  const message = first?.message as Record<string, unknown> | undefined;

  return typeof message?.content === "string" ? message.content : "";
}

function readImageData(payload: ZeroGImagePayload | null) {
  return payload?.data?.find((item) => typeof item.b64_json === "string")
    ?.b64_json;
}

function readAsyncJobId(payload: ZeroGAsyncImagePayload) {
  const nested = payload.data as Record<string, unknown> | undefined;
  const id =
    payload.job_id ??
    payload.id ??
    (typeof nested?.job_id === "string" ? nested.job_id : undefined) ??
    (typeof nested?.id === "string" ? nested.id : undefined);

  return id ?? "";
}
