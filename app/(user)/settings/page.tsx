import {
  Bell,
  Bot,
  Database,
  Mail,
  Palette,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  SunMoon,
  WalletCards,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const accountStats = [
  {
    label: "0G Balance",
    value: "124.8",
    description: "Available pay-as-you-go tokens",
    icon: WalletCards,
  },
  {
    label: "API Usage",
    value: "68%",
    description: "Of this month's token guardrail",
    icon: Database,
  },
  {
    label: "Automations",
    value: "12",
    description: "Active scheduled tasks",
    icon: Bot,
  },
  {
    label: "Access",
    value: "Wallet",
    description: "Wallet approval enabled",
    icon: ShieldCheck,
  },
];

function ToggleRow({
  title,
  description,
  defaultChecked,
}: {
  title: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-md border p-3">
      <span>
        <span className="block font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </span>
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span className="relative h-6 w-11 rounded-full bg-muted ring-1 ring-border transition-colors after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-background after:shadow-sm after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-5" />
    </label>
  );
}

export default function Page() {
  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Account preferences, appearance, notifications, and pay-as-you-go
            automation limits.
          </p>
        </div>

        <Button>
          <Save />
          Save Changes
        </Button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {accountStats.map((stat) => {
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

      <Tabs defaultValue="account" className="space-y-4">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="account">
            <ShieldCheck />
            Account
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="automation">
            <SlidersHorizontal />
            Automation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Account Profile</CardTitle>
              <CardDescription>
                Personal identity and account-level defaults for Langclaw.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">Display name</span>
                <Input defaultValue="Langclaw User" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Notification email</span>
                <Input defaultValue="ops@langclaw.dev" type="email" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Default project</span>
                <Select defaultValue="langclaw-website">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="langclaw-website">
                      Langclaw Website
                    </SelectItem>
                    <SelectItem value="rag-knowledge-base">
                      RAG Knowledge Base
                    </SelectItem>
                    <SelectItem value="api-playground">
                      API Playground
                    </SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Language</span>
                <Select defaultValue="english">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="indonesian">Indonesian</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium">Account note</span>
                <Textarea
                  defaultValue="Personal settings for Langclaw chat, API usage, and automation monitoring."
                  rows={3}
                />
              </label>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Access Controls</CardTitle>
              <CardDescription>
                Lightweight protection for API and billing-sensitive changes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleRow
                title="Require wallet confirmation"
                description="Ask for wallet approval before billing or token limit changes."
                defaultChecked
              />
              <ToggleRow
                title="Restrict API key creation"
                description="Ask for confirmation before creating browser-exposed keys."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Appearance Theme</CardTitle>
              <CardDescription>
                Choose the visual style used across Langclaw.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">Theme</span>
                <Select defaultValue="system">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Interface density</span>
                <Select defaultValue="comfortable">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comfortable">Comfortable</SelectItem>
                    <SelectItem value="compact">Compact</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <div className="md:col-span-2 grid gap-3 md:grid-cols-2">
                <ToggleRow
                  title="Reduce motion"
                  description="Use quieter transitions for interface changes."
                />
                <ToggleRow
                  title="Highlight active tools"
                  description="Show stronger visual states for active controls."
                  defaultChecked
                />
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Theme Preview</CardTitle>
              <CardDescription>
                A quick preview of surfaces and controls.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border bg-background p-3">
                <SunMoon className="mb-3 size-4 text-primary" />
                <p className="font-medium">Surface</p>
                <p className="text-sm text-muted-foreground">
                  Clean panels and readable contrast.
                </p>
              </div>
              <div className="rounded-md border bg-muted p-3">
                <Sparkles className="mb-3 size-4 text-primary" />
                <p className="font-medium">Accent</p>
                <p className="text-sm text-muted-foreground">
                  Focus states for selected actions.
                </p>
              </div>
              <div className="rounded-md border p-3">
                <Button size="sm" className="mb-3">
                  <Zap />
                  Action
                </Button>
                <p className="text-sm text-muted-foreground">
                  Buttons, inputs, and menus share the same theme.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Notification Rules</CardTitle>
              <CardDescription>
                Alerts for token usage, automation runs, and billing events.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleRow
                title="0G token threshold alerts"
                description="Send an alert at 80% and 95% of your token limit."
                defaultChecked
              />
              <ToggleRow
                title="Automation failure alerts"
                description="Notify you when a scheduled task fails."
                defaultChecked
              />
              <ToggleRow
                title="Weekly usage digest"
                description="Send API usage, token spend, and automation summary every Monday."
              />
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Email Channel</CardTitle>
              <CardDescription>
                Delivery address for usage and automation alerts.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 md:flex-row md:items-end">
              <label className="flex-1 space-y-2">
                <span className="text-sm font-medium">Alert email</span>
                <Input defaultValue="ops@langclaw.dev" type="email" />
              </label>
              <Button variant="outline">
                <Mail />
                Send Test
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation" className="space-y-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Automation Defaults</CardTitle>
              <CardDescription>
                Defaults applied to new automation tasks.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">Retry policy</span>
                <Select defaultValue="3-attempts">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No retry</SelectItem>
                    <SelectItem value="3-attempts">3 attempts</SelectItem>
                    <SelectItem value="5-attempts">5 attempts</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">
                  Failure notification
                </span>
                <Select defaultValue="email">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="in-app">In-app only</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <div className="md:col-span-2 grid gap-3 md:grid-cols-2">
                <ToggleRow
                  title="Auto-pause repeated failures"
                  description="Pause a task after 5 consecutive failures."
                  defaultChecked
                />
                <ToggleRow
                  title="Write run logs to memory"
                  description="Keep operational summaries available for chat recall."
                />
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>0G Token Guardrails</CardTitle>
              <CardDescription>
                Pay-as-you-go limits for automated 0G token usage.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm font-medium">Daily 0G limit</span>
                <Input defaultValue="25" type="number" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Monthly 0G cap</span>
                <Input defaultValue="500" type="number" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Limit behavior</span>
                <Select defaultValue="pause">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pause">Pause automations</SelectItem>
                    <SelectItem value="alert">Send alert only</SelectItem>
                    <SelectItem value="allow">Allow extra 0G spend</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium">
                  Low balance threshold
                </span>
                <Input defaultValue="10" type="number" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Threshold action</span>
                <Select defaultValue="notify">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="notify">Notify me</SelectItem>
                    <SelectItem value="pause">Pause paid tasks</SelectItem>
                    <SelectItem value="continue">Continue running</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
