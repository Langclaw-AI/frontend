"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Bell,
  Bot,
  BrainCircuit,
  Database,
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useWalletSession } from "@/hooks/use-wallet-session";
import {
  createAutomationTelegramLink,
  getMemorySettings,
  getAutomationDashboard,
  getUsageBalance,
  pollAutomationTelegramLink,
  readFriendlyError,
  requestAutomationEmailLink,
  updateAutomationSettings,
  verifyAutomationEmailLink,
  type AutomationDashboard,
  type AutomationNotificationChannel,
  type AutomationSettings,
  type MemorySettings,
  type UsageBalancePayload,
  updateMemorySettings,
} from "@/lib/langclaw-api";

export default function Page() {
  const { getWalletAuth, isConnected, isSigning, openWalletModal } =
    useWalletSession();
  const [dashboard, setDashboard] = useState<AutomationDashboard | null>(null);
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [memorySettings, setMemorySettings] = useState<MemorySettings | null>(
    null,
  );
  const [balance, setBalance] = useState<UsageBalancePayload | null>(null);
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [telegramCommand, setTelegramCommand] = useState("");
  const [telegramDeepLink, setTelegramDeepLink] = useState("");
  const [telegramBotUsername, setTelegramBotUsername] =
    useState("langclawaibot");
  const [telegramPolling, setTelegramPolling] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");
  const telegramPollTimerRef = useRef<number | null>(null);

  const loadSettings = useCallback(async () => {
    if (!isConnected) {
      setDashboard(null);
      setSettings(null);
      setMemorySettings(null);
      setBalance(null);
      return;
    }

    setLoading("load");
    setError("");

    try {
      const wallet = await getWalletAuth();
      const [automation, usage, memory] = await Promise.all([
        getAutomationDashboard(wallet),
        getUsageBalance(wallet).catch(() => null),
        getMemorySettings(wallet),
      ]);
      setDashboard(automation);
      setSettings(automation.settings);
      setMemorySettings(memory);
      setBalance(usage);
      setEmail(automation.settings.notificationEmail ?? "");
    } catch (err) {
      const message = readFriendlyError(err, "Unable to load settings.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading("");
    }
  }, [getWalletAuth, isConnected]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSettings();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadSettings]);

  const clearTelegramPollTimer = useCallback(() => {
    if (telegramPollTimerRef.current !== null) {
      window.clearTimeout(telegramPollTimerRef.current);
      telegramPollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearTelegramPollTimer();
  }, [clearTelegramPollTimer]);

  const requireWallet = async () => {
    if (!isConnected) {
      openWalletModal();
      throw new Error("Choose a wallet to update settings.");
    }

    return getWalletAuth();
  };

  const patchSettings = (patch: Partial<AutomationSettings>) => {
    setSettings((current) => (current ? { ...current, ...patch } : current));
  };

  const patchMemorySettings = (patch: Partial<MemorySettings>) => {
    setMemorySettings((current) =>
      current ? { ...current, ...patch } : current,
    );
  };

  const toggleChannel = (channel: AutomationNotificationChannel) => {
    setSettings((current) => {
      if (!current) {
        return current;
      }

      const set = new Set(current.notificationChannels);

      if (set.has(channel)) {
        set.delete(channel);
      } else {
        set.add(channel);
      }

      return {
        ...current,
        notificationChannels: Array.from(set),
      };
    });
  };

  const handleSave = async () => {
    if (!settings) {
      return;
    }

    setLoading("save");
    setError("");

    try {
      const wallet = await requireWallet();
      const [next, nextMemory] = await Promise.all([
        updateAutomationSettings(wallet, {
          autoPauseRepeatedFailures: settings.autoPauseRepeatedFailures,
          dailyLimit0G: settings.dailyLimit0G,
          failureNotification: settings.failureNotification,
          limitBehavior: settings.limitBehavior,
          lowBalanceThreshold0G: settings.lowBalanceThreshold0G,
          monthlyCap0G: settings.monthlyCap0G,
          notificationChannels: settings.notificationChannels,
          retryPolicy: settings.retryPolicy,
          thresholdAction: settings.thresholdAction,
          writeRunLogsToMemory: settings.writeRunLogsToMemory,
        }),
        memorySettings
          ? updateMemorySettings(wallet, {
              autoDisableLowConfidence:
                memorySettings.autoDisableLowConfidence,
              captureEnabled: memorySettings.captureEnabled,
              crossChatRecall: memorySettings.crossChatRecall,
              projectScopedRecall: memorySettings.projectScopedRecall,
              retentionDays: memorySettings.retentionDays,
            })
          : Promise.resolve(null),
      ]);
      setSettings(next);
      if (nextMemory) {
        setMemorySettings(nextMemory);
      }
      toast.success("Settings saved");
    } catch (err) {
      const message = readFriendlyError(err, "Unable to save settings.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading("");
    }
  };

  const handleRequestEmail = async () => {
    if (!email.trim()) {
      setError("Enter an email address first.");
      return;
    }

    setLoading("email");
    setError("");

    try {
      const wallet = await requireWallet();
      const payload = await requestAutomationEmailLink(wallet, email.trim());
      toast.success("Verification code sent", {
        description: payload.link.email,
      });
      await loadSettings();
    } catch (err) {
      const message = readFriendlyError(err, "Unable to send email code.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading("");
    }
  };

  const handleVerifyEmail = async () => {
    if (!emailCode.trim()) {
      setError("Enter the email verification code.");
      return;
    }

    setLoading("verify-email");
    setError("");

    try {
      const wallet = await requireWallet();
      const next = await verifyAutomationEmailLink(wallet, emailCode.trim());
      setSettings(next);
      setEmail(next.notificationEmail ?? "");
      setEmailCode("");
      toast.success("Email linked");
    } catch (err) {
      const message = readFriendlyError(err, "Unable to verify email.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading("");
    }
  };

  const startTelegramPolling = useCallback(
    (expiresAt: string, botUsername: string) => {
      const expiresAtMs = new Date(expiresAt).getTime();
      clearTelegramPollTimer();
      setTelegramPolling(true);
      setTelegramStatus(`Waiting for @${botUsername} confirmation...`);

      const poll = async () => {
        if (Date.now() >= expiresAtMs) {
          setTelegramPolling(false);
          setTelegramStatus("Telegram link expired. Create a new link.");
          return;
        }

        try {
          const wallet = await getWalletAuth();
          const payload = await pollAutomationTelegramLink(wallet);

          if (payload.settings) {
            setSettings(payload.settings);
          }

          if (payload.linked) {
            setTelegramPolling(false);
            setTelegramStatus("Telegram linked.");
            setTelegramCommand("");
            setTelegramDeepLink("");
            toast.success("Telegram linked");
            return;
          }

          setTelegramStatus(`Waiting for @${botUsername} confirmation...`);
          telegramPollTimerRef.current = window.setTimeout(poll, 3000);
        } catch (err) {
          const message = readFriendlyError(
            err,
            "Unable to check Telegram link.",
          );
          setTelegramPolling(false);
          setTelegramStatus(message);
          setError(message);
          toast.error(message);
        }
      };

      telegramPollTimerRef.current = window.setTimeout(poll, 1500);
    },
    [clearTelegramPollTimer, getWalletAuth],
  );

  const handleTelegramLink = async () => {
    setLoading("telegram");
    setError("");
    clearTelegramPollTimer();

    const telegramWindow = window.open("about:blank", "_blank");

    try {
      const wallet = await requireWallet();
      const link = await createAutomationTelegramLink(wallet);
      setTelegramCommand(link.command);
      setTelegramDeepLink(link.deepLink);
      setTelegramBotUsername(link.botUsername);
      setTelegramStatus(`Waiting for @${link.botUsername} confirmation...`);

      if (telegramWindow) {
        telegramWindow.opener = null;
        telegramWindow.location.href = link.deepLink;
      } else {
        setTelegramStatus(
          `Open @${link.botUsername} and send the fallback command below.`,
        );
      }

      startTelegramPolling(link.expiresAt, link.botUsername);
      toast.success("Telegram link opened", {
        description: `Confirm the chat with @${link.botUsername}.`,
      });
    } catch (err) {
      telegramWindow?.close();
      const message = readFriendlyError(err, "Unable to create Telegram link.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading("");
    }
  };

  const handlePollTelegram = async () => {
    setLoading("poll-telegram");
    setError("");

    try {
      const wallet = await requireWallet();
      const payload = await pollAutomationTelegramLink(wallet);

      if (payload.settings) {
        setSettings(payload.settings);
      }

      if (payload.linked) {
        clearTelegramPollTimer();
        setTelegramPolling(false);
        setTelegramStatus("Telegram linked.");
        setTelegramCommand("");
        setTelegramDeepLink("");
      }

      toast.success(
        payload.linked ? "Telegram linked" : "No Telegram message yet",
      );
    } catch (err) {
      const message = readFriendlyError(err, "Unable to check Telegram link.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading("");
    }
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Manage notifications, automation limits, and wallet-backed account
            preferences.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            disabled={loading === "load"}
            onClick={() => void loadSettings()}
            variant="outline"
          >
            {loading === "load" && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Refresh
          </Button>
          <Button disabled={loading === "save" || isSigning || !settings} onClick={() => void handleSave()}>
            {loading === "save" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save changes
          </Button>
        </div>
      </section>

      {!isConnected && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Wallet required</AlertTitle>
          <AlertDescription>
            Choose a wallet to load your Langclaw settings.
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
          description="Available for paid requests"
          icon={WalletCards}
          label="0G Balance"
          value={balance?.balance.available0G ?? "0"}
        />
        <StatCard
          description="Active automation tasks"
          icon={Bot}
          label="Automations"
          value={String(dashboard?.stats.activeTasks ?? 0)}
        />
        <StatCard
          description="Last 30 days"
          icon={Database}
          label="Success rate"
          value={`${dashboard?.stats.successRate ?? 0}%`}
        />
        <StatCard
          description="Wallet approval enabled"
          icon={ShieldCheck}
          label="Access"
          value={isConnected ? "Wallet" : "Not connected"}
        />
      </section>

      <Tabs defaultValue="notifications" className="space-y-4">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="notifications">
            <Bell />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="automation">
            <SlidersHorizontal />
            Automation
          </TabsTrigger>
          <TabsTrigger value="memory">
            <BrainCircuit />
            Memory
          </TabsTrigger>
          <TabsTrigger value="account">
            <ShieldCheck />
            Account
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-4">
          <Card className="rounded-lg" size="sm">
            <CardHeader>
              <CardTitle>Notification Channels</CardTitle>
              <CardDescription>
                Pick where Langclaw sends failed-run and low-balance alerts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleRow
                checked={settings?.notificationChannels.includes("in-app") ?? false}
                description="Show alerts inside the Langclaw dashboard."
                onCheckedChange={() => toggleChannel("in-app")}
                title="In-app alerts"
              />
              <ToggleRow
                checked={settings?.notificationChannels.includes("email") ?? false}
                description="Send alerts to a verified email address."
                onCheckedChange={() => toggleChannel("email")}
                title="Email alerts"
              />
              <ToggleRow
                checked={settings?.notificationChannels.includes("telegram") ?? false}
                description="Send alerts to a linked Telegram chat."
                onCheckedChange={() => toggleChannel("telegram")}
                title="Telegram alerts"
              />
              <label className="space-y-2">
                <span className="text-sm font-medium">Failure alerts</span>
                <Select
                  onValueChange={(value) =>
                    patchSettings({
                      failureNotification: value as AutomationSettings["failureNotification"],
                    })
                  }
                  value={settings?.failureNotification ?? "email"}
                >
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
            </CardContent>
          </Card>

          <Card className="rounded-lg" size="sm">
            <CardHeader>
              <CardTitle>Email</CardTitle>
              <CardDescription>
                Verify an email address before enabling email alerts.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <Input
                onChange={(event) => setEmail(event.currentTarget.value)}
                placeholder="alerts@company.com"
                type="email"
                value={email}
              />
              <Button
                disabled={loading === "email"}
                onClick={() => void handleRequestEmail()}
                variant="outline"
              >
                {loading === "email" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Mail className="size-4" />
                )}
                Send code
              </Button>
              <StatusText
                value={
                  settings?.notificationEmailVerified
                    ? "Verified"
                    : settings?.notificationEmailPending
                      ? "Code sent"
                      : "Not linked"
                }
              />
              <Input
                className="md:col-span-2"
                onChange={(event) => setEmailCode(event.currentTarget.value)}
                placeholder="Verification code"
                value={emailCode}
              />
              <Button
                disabled={loading === "verify-email"}
                onClick={() => void handleVerifyEmail()}
              >
                {loading === "verify-email" && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Verify
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-lg" size="sm">
            <CardHeader>
              <CardTitle>Telegram</CardTitle>
              <CardDescription>
                Open @{telegramBotUsername} and verify this wallet for automation alerts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={loading === "telegram" || telegramPolling}
                  onClick={() => void handleTelegramLink()}
                  variant="outline"
                >
                  {loading === "telegram" || telegramPolling ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Bot className="size-4" />
                  )}
                  Connect Telegram
                </Button>
                <Button
                  disabled={loading === "poll-telegram" || telegramPolling}
                  onClick={() => void handlePollTelegram()}
                >
                  {loading === "poll-telegram" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Check link
                </Button>
                {telegramDeepLink && (
                  <Button asChild variant="outline">
                    <a
                      href={telegramDeepLink}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ExternalLink className="size-4" />
                      Open Telegram
                    </a>
                  </Button>
                )}
              </div>
              {telegramCommand && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Fallback command
                  </p>
                  <code className="block rounded-md border bg-muted/40 p-3 text-sm">
                    {telegramCommand}
                  </code>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {telegramStatus ||
                  (settings?.telegramVerified
                    ? `Linked${settings.telegramUsername ? ` to @${settings.telegramUsername}` : ""}.`
                    : "Not linked yet.")}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation" className="space-y-4">
          <Card className="rounded-lg" size="sm">
            <CardHeader>
              <CardTitle>Run Behavior</CardTitle>
              <CardDescription>
                Defaults used when an automation starts.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">Retry policy</span>
                <Select
                  onValueChange={(value) =>
                    patchSettings({
                      retryPolicy: value as AutomationSettings["retryPolicy"],
                    })
                  }
                  value={settings?.retryPolicy ?? "3-attempts"}
                >
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
                <span className="text-sm font-medium">When limits are hit</span>
                <Select
                  onValueChange={(value) =>
                    patchSettings({
                      limitBehavior: value as AutomationSettings["limitBehavior"],
                    })
                  }
                  value={settings?.limitBehavior ?? "pause"}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pause">Pause automations</SelectItem>
                    <SelectItem value="alert">Alert only</SelectItem>
                    <SelectItem value="allow">Keep running</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <ToggleRow
                checked={settings?.autoPauseRepeatedFailures ?? true}
                description="Pause a task after repeated failures."
                onCheckedChange={(checked) =>
                  patchSettings({ autoPauseRepeatedFailures: checked })
                }
                title="Auto-pause failing tasks"
              />
              <ToggleRow
                checked={settings?.writeRunLogsToMemory ?? false}
                description="Keep helpful run summaries available for chat recall."
                onCheckedChange={(checked) =>
                  patchSettings({ writeRunLogsToMemory: checked })
                }
                title="Save run summaries"
              />
            </CardContent>
          </Card>

          <Card className="rounded-lg" size="sm">
            <CardHeader>
              <CardTitle>0G Guardrails</CardTitle>
              <CardDescription>
                Keep automated work inside your preferred spend range.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <NumberField
                label="Daily limit"
                onChange={(value) => patchSettings({ dailyLimit0G: value })}
                value={settings?.dailyLimit0G ?? "25"}
              />
              <NumberField
                label="Monthly cap"
                onChange={(value) => patchSettings({ monthlyCap0G: value })}
                value={settings?.monthlyCap0G ?? "500"}
              />
              <NumberField
                label="Low balance alert"
                onChange={(value) =>
                  patchSettings({ lowBalanceThreshold0G: value })
                }
                value={settings?.lowBalanceThreshold0G ?? "10"}
              />
              <label className="space-y-2 md:col-span-3">
                <span className="text-sm font-medium">Low balance action</span>
                <Select
                  onValueChange={(value) =>
                    patchSettings({
                      thresholdAction: value as AutomationSettings["thresholdAction"],
                    })
                  }
                  value={settings?.thresholdAction ?? "notify"}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="notify">Notify me</SelectItem>
                    <SelectItem value="pause">Pause paid tasks</SelectItem>
                    <SelectItem value="continue">Keep running</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memory" className="space-y-4">
          <Card className="rounded-lg" size="sm">
            <CardHeader>
              <CardTitle>Memory Capture</CardTitle>
              <CardDescription>
                Control which saved memories can be captured and reused.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <ToggleRow
                checked={memorySettings?.captureEnabled ?? true}
                description="Allow Langclaw to save helpful long-term memories."
                onCheckedChange={(checked) =>
                  patchMemorySettings({ captureEnabled: checked })
                }
                title="Capture memories"
              />
              <ToggleRow
                checked={memorySettings?.crossChatRecall ?? true}
                description="Reuse active memories across wallet chat sessions."
                onCheckedChange={(checked) =>
                  patchMemorySettings({ crossChatRecall: checked })
                }
                title="Cross-chat recall"
              />
              <ToggleRow
                checked={memorySettings?.projectScopedRecall ?? true}
                description="Allow project-scoped memories to inform matching work."
                onCheckedChange={(checked) =>
                  patchMemorySettings({ projectScopedRecall: checked })
                }
                title="Project-scoped recall"
              />
              <ToggleRow
                checked={memorySettings?.autoDisableLowConfidence ?? false}
                description="Move low-confidence memories out of recall automatically."
                onCheckedChange={(checked) =>
                  patchMemorySettings({ autoDisableLowConfidence: checked })
                }
                title="Auto-disable weak memories"
              />
              <NumberField
                label="Retention days"
                onChange={(value) =>
                  patchMemorySettings({
                    retentionDays: readRetentionDays(value),
                  })
                }
                value={`${memorySettings?.retentionDays ?? 365}`}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="space-y-4">
          <Card className="rounded-lg" size="sm">
            <CardHeader>
              <CardTitle>Wallet Access</CardTitle>
              <CardDescription>
                Sensitive changes require a signed wallet session.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <InfoBlock label="Balance" value={`${balance?.balance.available0G ?? "0"} 0G`} />
              <InfoBlock
                label="Reserved"
                value={`${balance?.balance.reserved0G ?? "0"} 0G`}
              />
              <InfoBlock
                label="Deposited"
                value={`${balance?.balance.lifetimeDeposited0G ?? "0"} 0G`}
              />
              <InfoBlock
                label="Spent"
                value={`${balance?.balance.lifetimeCharged0G ?? "0"} 0G`}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ToggleRow({
  checked,
  description,
  onCheckedChange,
  title,
}: {
  checked: boolean;
  description: string;
  onCheckedChange: (checked: boolean) => void;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border p-3">
      <span>
        <span className="block font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
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
  icon: typeof WalletCards;
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

function NumberField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <Input
        inputMode="decimal"
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      />
    </label>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function StatusText({ value }: { value: string }) {
  return (
    <span className="inline-flex h-9 items-center rounded-md border px-3 text-sm">
      {value}
    </span>
  );
}

function readRetentionDays(value: string) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return 365;
  }

  return Math.min(Math.max(parsed, 0), 3650);
}
