"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  TimerReset,
  Trash2,
  Workflow,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  createAutomationTask,
  deleteAutomationTask,
  getAutomationDashboard,
  readFriendlyError,
  runAutomationTask,
  setAllAutomationTasksStatus,
  setAutomationTaskStatus,
  type AutomationDashboard,
  type AutomationFrequency,
  type AutomationTask,
  type AutomationTaskInput,
  type AutomationTriggerType,
} from "@/lib/langclaw-api";

type TaskForm = {
  eventName: string;
  name: string;
  project: string;
  prompt: string;
  scheduleFrequency: AutomationFrequency;
  scheduleTime: string;
  status: "active" | "draft";
  timezone: string;
  triggerType: AutomationTriggerType;
};

const defaultForm: TaskForm = {
  eventName: "",
  name: "",
  project: "Langclaw Website",
  prompt: "",
  scheduleFrequency: "daily",
  scheduleTime: "09:00",
  status: "active",
  timezone: "Asia/Jakarta",
  triggerType: "schedule",
};

export default function Page() {
  const { getWalletAuth, isConnected, openWalletModal } = useWalletSession();
  const [dashboard, setDashboard] = useState<AutomationDashboard | null>(null);
  const [form, setForm] = useState<TaskForm>(defaultForm);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");

  const loadDashboard = useCallback(async () => {
    if (!isConnected) {
      setDashboard(null);
      setError("");
      return;
    }

    setLoading("dashboard");
    setError("");

    try {
      const wallet = await getWalletAuth();
      setDashboard(await getAutomationDashboard(wallet));
    } catch (err) {
      const message = readFriendlyError(err, "Unable to load automations.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading("");
    }
  }, [getWalletAuth, isConnected]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadDashboard]);

  const requireWallet = async () => {
    if (!isConnected) {
      openWalletModal();
      throw new Error("Choose a wallet to manage automations.");
    }

    return getWalletAuth();
  };

  const filteredTasks = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return (dashboard?.tasks ?? []).filter((task) => {
      const matchesQuery =
        !needle ||
        [task.name, task.project, task.prompt, task.triggerLabel]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      const matchesStatus =
        statusFilter === "all" || task.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [dashboard?.tasks, query, statusFilter]);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setError("Give this automation a name.");
      return;
    }

    setLoading("create");
    setError("");

    try {
      const wallet = await requireWallet();
      const taskInput: AutomationTaskInput = {
        name: form.name,
        project: form.project,
        prompt: form.prompt,
        scheduleFrequency: form.scheduleFrequency,
        scheduleTime: form.scheduleTime,
        status: form.status,
        timezone: form.timezone,
        triggerType: form.triggerType,
        eventName:
          form.triggerType === "event" ? form.eventName || form.name : undefined,
      };
      await createAutomationTask(wallet, taskInput);
      setForm(defaultForm);
      toast.success("Automation created");
      await loadDashboard();
    } catch (err) {
      const message = readFriendlyError(err, "Unable to create automation.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading("");
    }
  };

  const handleStatus = async (
    task: AutomationTask,
    status: "active" | "paused",
  ) => {
    setLoading(`${status}-${task.id}`);
    setError("");

    try {
      const wallet = await requireWallet();
      await setAutomationTaskStatus(wallet, task.id, status);
      toast.success(status === "active" ? "Automation resumed" : "Automation paused");
      await loadDashboard();
    } catch (err) {
      const message = readFriendlyError(err, "Unable to update automation.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading("");
    }
  };

  const handleRun = async (task: AutomationTask) => {
    setLoading(`run-${task.id}`);
    setError("");

    try {
      const wallet = await requireWallet();
      await runAutomationTask(wallet, task.id);
      toast.success("Automation run started");
      await loadDashboard();
    } catch (err) {
      const message = readFriendlyError(err, "Unable to run automation.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading("");
    }
  };

  const handleDelete = async (task: AutomationTask) => {
    setLoading(`delete-${task.id}`);
    setError("");

    try {
      const wallet = await requireWallet();
      await deleteAutomationTask(wallet, task.id);
      toast.success("Automation deleted");
      await loadDashboard();
    } catch (err) {
      const message = readFriendlyError(err, "Unable to delete automation.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading("");
    }
  };

  const handleAllStatus = async (status: "active" | "paused") => {
    setLoading(`${status}-all`);
    setError("");

    try {
      const wallet = await requireWallet();
      await setAllAutomationTasksStatus(wallet, status);
      toast.success(status === "active" ? "All automations resumed" : "All automations paused");
      await loadDashboard();
    } catch (err) {
      const message = readFriendlyError(err, "Unable to update automations.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading("");
    }
  };

  const stats = dashboard?.stats;

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Automation Tasks</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Schedule research runs and keep recurring work moving from one
            place.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={loading === "dashboard"}
            onClick={() => void loadDashboard()}
            variant="outline"
          >
            {loading === "dashboard" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh
          </Button>
          <Button disabled={loading === "create"} onClick={() => void handleCreate()}>
            {loading === "create" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Create task
          </Button>
        </div>
      </section>

      {!isConnected && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Wallet required</AlertTitle>
          <AlertDescription>
            Choose a wallet to load and manage your automation tasks.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Something needs attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          description={`${stats?.scheduledTasks ?? 0} scheduled, ${stats?.eventTasks ?? 0} event-based`}
          icon={Workflow}
          label="Active tasks"
          value={String(stats?.activeTasks ?? 0)}
        />
        <StatCard
          description="Currently processing"
          icon={Activity}
          label="Running now"
          value={String(stats?.runningNow ?? 0)}
        />
        <StatCard
          description="Last 30 days"
          icon={CheckCircle2}
          label="Success rate"
          value={`${stats?.successRate ?? 0}%`}
        />
        <StatCard
          description={stats?.nextRunTaskName ?? "No scheduled run"}
          icon={Clock3}
          label="Next run"
          value={formatShortDate(stats?.nextRunAt)}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="gap-0 rounded-lg" size="sm">
          <CardHeader className="border-b pb-4">
            <CardTitle>Task Queue</CardTitle>
            <CardDescription>
              Live tasks returned by your Langclaw backend.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 border-b px-4 py-4 md:flex-row md:items-center">
              <div className="relative w-full md:max-w-xs">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  placeholder="Search tasks..."
                  value={query}
                />
              </div>

              <Select onValueChange={setStatusFilter} value={statusFilter}>
                <SelectTrigger className="w-[148px] md:ml-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead>Next run</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.length ? (
                  filteredTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div className="font-medium">{task.name}</div>
                        <div className="max-w-72 truncate text-xs text-muted-foreground">
                          {task.project}
                        </div>
                      </TableCell>
                      <TableCell>{task.triggerLabel}</TableCell>
                      <TableCell>
                        <StatusBadge status={task.displayStatus} />
                      </TableCell>
                      <TableCell>{formatDate(task.lastRunAt)}</TableCell>
                      <TableCell>{formatDate(task.nextRunAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            disabled={
                              task.status === "draft" ||
                              loading === `run-${task.id}`
                            }
                            onClick={() => void handleRun(task)}
                            size="icon-sm"
                            variant="ghost"
                          >
                            {loading === `run-${task.id}` ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Zap className="size-4" />
                            )}
                            <span className="sr-only">Run {task.name}</span>
                          </Button>
                          <Button
                            disabled={
                              loading === `${task.status === "paused" ? "active" : "paused"}-${task.id}`
                            }
                            onClick={() =>
                              void handleStatus(
                                task,
                                task.status === "paused" ? "active" : "paused",
                              )
                            }
                            size="icon-sm"
                            variant="ghost"
                          >
                            {task.status === "paused" ? (
                              <PlayCircle className="size-4" />
                            ) : (
                              <PauseCircle className="size-4" />
                            )}
                            <span className="sr-only">
                              {task.status === "paused" ? "Resume" : "Pause"}{" "}
                              {task.name}
                            </span>
                          </Button>
                          <Button
                            disabled={loading === `delete-${task.id}`}
                            onClick={() => void handleDelete(task)}
                            size="icon-sm"
                            variant="destructive"
                          >
                            {loading === `delete-${task.id}` ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                            <span className="sr-only">Delete {task.name}</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      className="py-10 text-center text-muted-foreground"
                      colSpan={6}
                    >
                      {isConnected
                        ? "No automation tasks yet."
                        : "Choose a wallet to load tasks."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-lg" size="sm">
            <CardHeader>
              <CardTitle>Create Task</CardTitle>
              <CardDescription>
                Describe the recurring work Langclaw should run.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.currentTarget.value,
                  }))
                }
                placeholder="Daily market research"
                value={form.name}
              />
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    project: event.currentTarget.value,
                  }))
                }
                placeholder="Project"
                value={form.project}
              />
              <Textarea
                className="min-h-24"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    prompt: event.currentTarget.value,
                  }))
                }
                placeholder="What should Langclaw research or summarize?"
                value={form.prompt}
              />
              <Select
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    triggerType: value as AutomationTriggerType,
                  }))
                }
                value={form.triggerType}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="schedule">Schedule</SelectItem>
                  <SelectItem value="event">App event</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                </SelectContent>
              </Select>
              {form.triggerType === "schedule" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        scheduleFrequency: value as AutomationFrequency,
                      }))
                    }
                    value={form.scheduleFrequency}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        scheduleTime: event.currentTarget.value,
                      }))
                    }
                    type="time"
                    value={form.scheduleTime}
                  />
                </div>
              ) : form.triggerType === "event" ? (
                <Input
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      eventName: event.currentTarget.value,
                    }))
                  }
                  placeholder="Event name"
                  value={form.eventName}
                />
              ) : null}
              <Select
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    status: value as "active" | "draft",
                  }))
                }
                value={form.status}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="rounded-lg" size="sm">
            <CardHeader>
              <CardTitle>Recent Runs</CardTitle>
              <CardDescription>Latest automation activity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(dashboard?.recentRuns ?? []).length ? (
                dashboard!.recentRuns.slice(0, 5).map((run) => (
                  <div key={run.id} className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-8 items-center justify-center rounded-md bg-muted">
                      {run.status === "completed" ? (
                        <CheckCircle2 className="size-4 text-emerald-600" />
                      ) : (
                        <TimerReset className="size-4 text-amber-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {run.taskName ?? "Automation run"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {run.status} {formatDuration(run.durationMs)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatShortDate(run.completedAt ?? run.createdAt)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No runs yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="rounded-lg" size="sm">
        <CardHeader>
          <div>
            <CardTitle>Automation Controls</CardTitle>
            <CardDescription>
              Pause or resume every active task for this wallet.
            </CardDescription>
          </div>
          <CardAction className="flex gap-2">
            <Button
              disabled={loading === "paused-all"}
              onClick={() => void handleAllStatus("paused")}
              size="sm"
              variant="outline"
            >
              {loading === "paused-all" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PauseCircle className="size-4" />
              )}
              Pause all
            </Button>
            <Button
              disabled={loading === "active-all"}
              onClick={() => void handleAllStatus("active")}
              size="sm"
            >
              {loading === "active-all" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PlayCircle className="size-4" />
              )}
              Resume all
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <InfoTile
            icon={CalendarClock}
            label="Scheduler"
            value={`${stats?.scheduledTasks ?? 0} scheduled tasks`}
          />
          <InfoTile
            icon={Workflow}
            label="Queue"
            value={`${stats?.pendingRuns ?? 0} pending runs`}
          />
          <InfoTile
            icon={Activity}
            label="Throughput"
            value={`${stats?.completedThisWeek ?? 0} completed this week`}
          />
        </CardContent>
      </Card>

      <Card className="rounded-lg" size="sm">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Failures and skipped runs appear here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(dashboard?.notifications ?? []).length ? (
            dashboard!.notifications.slice(0, 5).map((notification) => (
              <div
                className="flex items-start gap-3 rounded-md border p-3"
                key={notification.id}
              >
                <Bell className="mt-0.5 size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{notification.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {notification.body}
                  </p>
                </div>
                <StatusBadge
                  status={notification.status === "read" ? "Read" : "Active"}
                />
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No notifications yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  description,
  icon: Icon,
  label,
  value,
}: {
  description: string;
  icon: typeof Workflow;
  label: string;
  value: string;
}) {
  return (
    <Card className="rounded-lg" size="sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>{label}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Running" || status === "Active"
      ? "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900"
      : status === "Paused"
        ? "bg-muted text-muted-foreground ring-border"
        : status === "Draft"
          ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900"
          : "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900";

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ${tone}`}
    >
      {status}
    </span>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Workflow;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2 font-medium">
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{value}</p>
    </div>
  );
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : "Not scheduled";
}

function formatShortDate(value?: string) {
  if (!value) {
    return "None";
  }

  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function formatDuration(value?: number) {
  if (!value) {
    return "";
  }

  const seconds = Math.round(value / 1000);

  return `in ${seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)}m`}`;
}
