"use client";

import { useRef, useState } from "react";
import { AlertCircleIcon, Loader2Icon, PlayIcon, SquareIcon } from "lucide-react";
import { toast } from "sonner";

import {
  SignalGraphResult,
  WorkflowPlan,
} from "@/components/SignalGraphResult";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useWalletSession } from "@/hooks/use-wallet-session";
import {
  runDiscover,
  streamDiscover,
  type DiscoverPayload,
  type WorkflowProgressEvent,
} from "@/lib/signalgraph-api";

type RunMode = "single" | "stream";

export default function DiscoverPage() {
  const { getWalletAuth, isConnected, isSigning } = useWalletSession();
  const [topic, setTopic] = useState(
    "AI x Web3 product trends builders can ship this week"
  );
  const [mode, setMode] = useState<RunMode>("stream");
  const [events, setEvents] = useState<WorkflowProgressEvent[]>([]);
  const [result, setResult] = useState<DiscoverPayload | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "running">("idle");
  const abortRef = useRef<AbortController | null>(null);

  const isRunning = status === "running";

  const handleRun = async () => {
    const value = topic.trim();

    if (!value) {
      showError(setError, "Topic is required.");
      return;
    }

    if (!isConnected) {
      showError(setError, "Connect wallet first.");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setEvents([]);
    setResult(null);
    setError("");
    setStatus("running");

    try {
      const wallet = await getWalletAuth();

      if (mode === "stream") {
        await streamDiscover({
          onError: (message) => showError(setError, message),
          onProgress: (event) => setEvents((current) => [...current, event]),
          onResult: (payload) => {
            setResult(payload);
            toast.success("Discovery complete", {
              description: `${payload.sources.length} sources and ${payload.orchestration.steps.length} workflow steps.`,
            });
          },
          signal: controller.signal,
          topic: value,
          wallet,
        });
      } else {
        const payload = await runDiscover({
          signal: controller.signal,
          topic: value,
          wallet,
        });
        setResult(payload);
        toast.success("Discovery complete", {
          description: `${payload.sources.length} sources returned.`,
        });
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        showError(
          setError,
          err instanceof Error ? err.message : "Discovery failed.",
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        setStatus("idle");
      }
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setStatus("idle");
    toast.info("Discovery stopped");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-semibold text-2xl">Discovery</h1>
          <p className="text-muted-foreground text-sm">
            SignalGraph research, sources, proof, and usage.
          </p>
        </div>
        <Tabs onValueChange={(value) => setMode(value as RunMode)} value={mode}>
          <TabsList>
            <TabsTrigger value="stream">Streaming</TabsTrigger>
            <TabsTrigger value="single">Single run</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="rounded-lg" size="sm">
        <CardHeader>
          <CardTitle>Topic</CardTitle>
          <CardDescription>POST /api/discover{mode === "stream" ? "/stream" : ""}</CardDescription>
          <CardAction>
            {isRunning ? (
              <Button onClick={handleStop} size="sm" type="button" variant="outline">
                <SquareIcon className="size-4" />
                Stop
              </Button>
            ) : (
              <Button
                disabled={isSigning}
                onClick={() => void handleRun()}
                size="sm"
                type="button"
              >
                {isSigning ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <PlayIcon className="size-4" />
                )}
                Run
              </Button>
            )}
          </CardAction>
        </CardHeader>
        <CardContent>
          <Textarea
            className="min-h-24"
            onChange={(event) => setTopic(event.currentTarget.value)}
            value={topic}
          />
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircleIcon className="size-4" />
          <AlertTitle>Endpoint error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {events.length > 0 && !result && <WorkflowPlan events={events} />}

      {result && (
        <div className="space-y-4">
          <ProviderErrors payload={result} />
          <SignalGraphResult events={events} payload={result} />
        </div>
      )}
    </div>
  );
}

function showError(setError: (message: string) => void, message: string) {
  setError(message);
  toast.error(message);
}

function ProviderErrors({ payload }: { payload: DiscoverPayload }) {
  if (!payload.errors.length) {
    return null;
  }

  return (
    <Alert>
      <AlertCircleIcon className="size-4" />
      <AlertTitle>Provider notes</AlertTitle>
      <AlertDescription>
        {payload.errors.map((error) => `${error.provider}: ${error.message}`).join(" | ")}
      </AlertDescription>
    </Alert>
  );
}
