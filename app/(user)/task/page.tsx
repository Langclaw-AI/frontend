import {
  Activity,
  CalendarClock,
  CheckCircle2,
  Clock3,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  TimerReset,
  Workflow,
  Zap,
} from "lucide-react";

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

const stats = [
  {
    label: "Active tasks",
    value: "12",
    description: "8 scheduled, 4 event-based",
    icon: Workflow,
  },
  {
    label: "Running now",
    value: "3",
    description: "Across connected projects",
    icon: Activity,
  },
  {
    label: "Success rate",
    value: "98.2%",
    description: "Last 30 days",
    icon: CheckCircle2,
  },
  {
    label: "Next run",
    value: "14m",
    description: "Usage digest sync",
    icon: Clock3,
  },
];

const tasks = [
  {
    name: "Usage digest sync",
    project: "Langclaw Website",
    trigger: "Every day at 09:00",
    status: "Running",
    lastRun: "May 15, 2026 09:00",
    nextRun: "May 16, 2026 09:00",
  },
  {
    name: "Memory cleanup review",
    project: "RAG Knowledge Base",
    trigger: "Every Friday",
    status: "Active",
    lastRun: "May 15, 2026 08:30",
    nextRun: "May 22, 2026 08:30",
  },
  {
    name: "API key rotation reminder",
    project: "API Playground",
    trigger: "Monthly",
    status: "Active",
    lastRun: "May 1, 2026 10:00",
    nextRun: "Jun 1, 2026 10:00",
  },
  {
    name: "Model benchmark report",
    project: "Model Benchmark",
    trigger: "After benchmark completes",
    status: "Paused",
    lastRun: "May 12, 2026 17:45",
    nextRun: "Paused",
  },
];

const recentRuns = [
  {
    task: "Usage digest sync",
    result: "Completed",
    duration: "32s",
    time: "09:00",
  },
  {
    task: "Memory cleanup review",
    result: "Completed",
    duration: "1m 08s",
    time: "08:30",
  },
  {
    task: "Webhook retry sweep",
    result: "Needs review",
    duration: "48s",
    time: "07:45",
  },
];

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Running"
      ? "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900"
      : status === "Paused"
        ? "bg-muted text-muted-foreground ring-border"
        : "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900";

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ${tone}`}
    >
      {status}
    </span>
  );
}

export default function Page() {
  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Automation Tasks</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Scheduled workflows, event triggers, and operational runs for every
            Langclaw project.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline">
            <RefreshCw />
            Refresh
          </Button>
          <Button>
            <Plus />
            New Task
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Card key={stat.label} size="sm">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle>{stat.label}</CardTitle>
                  <CardDescription>{stat.description}</CardDescription>
                </div>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card size="sm" className="gap-0">
          <CardHeader className="border-b pb-4">
            <CardTitle>Task Queue</CardTitle>
            <CardDescription>
              Automations currently attached to the workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 border-b px-4 py-4 md:flex-row md:items-center">
              <div className="relative w-full md:max-w-xs">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search tasks..." className="pl-8" />
              </div>

              <div className="flex flex-wrap gap-2 md:ml-auto">
                <Select defaultValue="all">
                  <SelectTrigger className="w-[132px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>

                <Select defaultValue="all-projects">
                  <SelectTrigger className="w-[152px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-projects">All projects</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="rag">RAG Knowledge Base</SelectItem>
                    <SelectItem value="benchmark">Benchmark</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.name}>
                    <TableCell>
                      <div className="font-medium">{task.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {task.project}
                      </div>
                    </TableCell>
                    <TableCell>{task.trigger}</TableCell>
                    <TableCell>
                      <StatusBadge status={task.status} />
                    </TableCell>
                    <TableCell>{task.lastRun}</TableCell>
                    <TableCell>{task.nextRun}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-sm">
                        <MoreHorizontal />
                        <span className="sr-only">Open task actions</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Create Task</CardTitle>
              <CardDescription>
                Draft a task before connecting it to a live trigger.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Task name" />
              <Select defaultValue="schedule">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="schedule">Schedule</SelectItem>
                  <SelectItem value="event">Event trigger</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                </SelectContent>
              </Select>
              <Select defaultValue="daily">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              <Button className="w-full">
                <Zap />
                Save Draft
              </Button>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Recent Runs</CardTitle>
              <CardDescription>Latest automation activity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentRuns.map((run) => (
                <div
                  key={`${run.task}-${run.time}`}
                  className="flex items-start gap-3"
                >
                  <div className="mt-0.5 flex size-8 items-center justify-center rounded-md bg-muted">
                    {run.result === "Completed" ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : (
                      <TimerReset className="size-4 text-amber-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{run.task}</p>
                    <p className="text-xs text-muted-foreground">
                      {run.result} in {run.duration}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {run.time}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <Card size="sm">
        <CardHeader>
          <div>
            <CardTitle>Execution Controls</CardTitle>
            <CardDescription>
              Workspace-level automation controls for queued jobs.
            </CardDescription>
          </div>
          <CardAction className="flex gap-2">
            <Button variant="outline" size="sm">
              <PauseCircle />
              Pause All
            </Button>
            <Button size="sm">
              <PlayCircle />
              Resume
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border p-3">
            <div className="flex items-center gap-2 font-medium">
              <CalendarClock className="size-4 text-muted-foreground" />
              Scheduler
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Healthy, 12 tasks registered.
            </p>
          </div>
          <div className="rounded-md border p-3">
            <div className="flex items-center gap-2 font-medium">
              <Workflow className="size-4 text-muted-foreground" />
              Queue Depth
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              6 pending runs, normal load.
            </p>
          </div>
          <div className="rounded-md border p-3">
            <div className="flex items-center gap-2 font-medium">
              <Activity className="size-4 text-muted-foreground" />
              Throughput
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              284 completed this week.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
