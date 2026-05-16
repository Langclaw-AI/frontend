"use client";

import { SearchIcon, ShieldCheckIcon } from "lucide-react";

import {
  Agent,
  AgentContent,
  AgentHeader,
  AgentInstructions,
} from "@/components/ai-elements/agent";
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
import { MessageResponse } from "@/components/ai-elements/message";
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
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
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
import { buildDiscoverAnswerContent } from "@/lib/chat-utils";
import type {
  DiscoverPayload,
  WorkflowProgressEvent,
  ZeroGProof,
} from "@/lib/langclaw-api";
import { cn } from "@/lib/utils";

type LangclawResultProps = {
  className?: string;
  events?: WorkflowProgressEvent[];
  payload: DiscoverPayload;
  showWorkflow?: boolean;
};

export function LangclawResult({
  className,
  events = [],
  payload,
  showWorkflow = true,
}: LangclawResultProps) {
  const workflowEvents = events.length
    ? events
    : orchestrationStepsToEvents(payload);

  return (
    <div className={cn("space-y-4", className)}>
      {showWorkflow && workflowEvents.length ? (
        <WorkflowPlan events={workflowEvents} />
      ) : null}
      <MessageResponse>{buildDiscoverAnswerContent(payload)}</MessageResponse>
      <DiscoverDetails payload={payload} />
    </div>
  );
}

export function DiscoverDetails({ payload }: { payload: DiscoverPayload }) {
  const zeroG = payload.zeroG;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <StatusPill label="Runtime" value={payload.orchestration.runtime} />
        {payload.finalAnswerMeta?.synthesis && (
          <StatusPill
            label="Synthesis"
            value={payload.finalAnswerMeta.synthesis}
          />
        )}
        {payload.finalAnswerMeta?.requestedModel && (
          <StatusPill
            label="Requested"
            value={payload.finalAnswerMeta.requestedModel}
          />
        )}
        {(payload.finalAnswerMeta?.usedModel || payload.finalAnswerMeta?.model) && (
          <StatusPill
            label="Used"
            value={
              payload.finalAnswerMeta.usedModel ?? payload.finalAnswerMeta.model ?? ""
            }
          />
        )}
        {payload.finalAnswerMeta?.modelHonored === false && (
          <StatusPill
            label="Fallback"
            value={payload.finalAnswerMeta.fallbackFrom ?? "model fallback"}
          />
        )}
        {zeroG?.compute?.status && (
          <StatusPill label="0G compute" value={zeroG.compute.status} />
        )}
        {zeroG?.compute?.teeVerification?.status && (
          <StatusPill label="TEE" value={zeroG.compute.teeVerification.status} />
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
          model={
            payload.finalAnswerMeta?.usedModel ?? payload.finalAnswerMeta?.model
          }
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
                <span className="text-muted-foreground">{source.provider}</span>
              </Source>
            ))}
          </SourcesContent>
        </Sources>
      )}

      {payload.usage && <UsageReceipt usage={payload.usage} />}

      {zeroG && <VerificationDetails payload={payload} zeroG={zeroG} />}
    </div>
  );
}

export function WorkflowPlan({ events }: { events: WorkflowProgressEvent[] }) {
  const latest = events.at(-1);
  const isStreaming = isWorkflowStreaming(events);

  return (
    <Plan
      className="rounded-md"
      defaultOpen={isStreaming}
      isStreaming={isStreaming}
    >
      <PlanHeader>
        <div className="space-y-1">
          <PlanTitle>Langclaw workflow</PlanTitle>
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

export function StatusPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1">
      <span>{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}

export function isWorkflowStreaming(events: WorkflowProgressEvent[]) {
  const latest = events.at(-1);

  return latest?.status === "pending" || latest?.status === "running";
}

function KeySignalCitations({ payload }: { payload: DiscoverPayload }) {
  const signals = payload.finalConclusion.keySignals.filter((signal) =>
    Boolean(signal.text.trim()),
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
            signal.sourceIds?.length
              ? signal.sourceIds
              : signal.sourceId
                ? [signal.sourceId]
                : [],
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

function UsageReceipt({ usage }: { usage: DiscoverPayload["usage"] }) {
  if (!usage) {
    return null;
  }

  return (
    <div className="rounded-md border bg-background/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-foreground">Usage receipt</p>
        <StatusPill label="Status" value={usage.status} />
        <StatusPill label="Model" value={usage.model} />
        <StatusPill label="Charged" value={`${formatNeuron(usage.chargedNeuron)} 0G`} />
      </div>
      <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
        <ReceiptValue label="Wallet" value={shorten(usage.wallet)} />
        <ReceiptValue label="Request" value={usage.requestId ?? "Not available"} />
        <ReceiptValue label="Provider" value={usage.provider ?? "Not available"} />
        <ReceiptValue label="Input tokens" value={formatNumber(usage.inputTokens)} />
        <ReceiptValue label="Output tokens" value={formatNumber(usage.outputTokens)} />
        <ReceiptValue label="Balance after" value={`${formatNeuron(usage.balanceAfter)} 0G`} />
      </div>
    </div>
  );
}

function ReceiptValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-muted/40 px-2 py-1.5">
      <p className="text-muted-foreground">{label}</p>
      <p className="truncate font-medium text-foreground">{value}</p>
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

function orchestrationStepsToEvents(
  payload: DiscoverPayload,
): WorkflowProgressEvent[] {
  return payload.orchestration.steps.map((step, index) => ({
    agent: step.agent,
    error: step.error,
    execution: step.execution,
    model: step.model,
    sessionId: step.sessionId,
    skill: step.skill,
    status: step.status,
    stepId: `${index}-${step.skill}`,
    summary: step.summary,
    timestamp: payload.generatedAt,
  }));
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
    zeroG.chain.status === "pending" ||
    zeroG.storage.status === "prepared" ||
    zeroG.chain.status === "prepared"
  ) {
    return "output-available";
  }

  return "input-available";
}

function formatNumber(value?: number) {
  return value === undefined ? "Not available" : value.toLocaleString();
}

function shorten(value: string) {
  return value.length > 14 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
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
