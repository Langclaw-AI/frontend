"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BrainCircuit,
  Database,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ToggleLeft,
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
import { useWalletSession } from "@/hooks/use-wallet-session";
import {
  deleteManyMemoryRecords,
  deleteMemoryRecord,
  getMemoryDashboard,
  readFriendlyError,
  setManyMemoryStatuses,
  setMemoryStatus,
  type MemoryItem,
  type MemoryStats,
  type MemoryStatus,
} from "@/lib/langclaw-api";
import { MemoryDataTable } from "./data-table";

export default function Page() {
  const { getWalletAuth, isConnected, isSigning, openWalletModal } =
    useWalletSession();
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [backendStats, setBackendStats] = useState<MemoryStats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");

  const stats = useMemo(
    () => backendStats ?? buildMemoryStats(memories),
    [backendStats, memories],
  );

  const statCards = useMemo(
    () => [
      {
        label: "Total memories",
        value: stats.total,
        description: "Captured across chats",
        icon: Database,
      },
      {
        label: "Active",
        value: stats.active,
        description: "Available for recall",
        icon: BrainCircuit,
      },
      {
        label: "Project scoped",
        value: stats.projectScoped,
        description: "Attached to workspaces",
        icon: ShieldCheck,
      },
      {
        label: "Disabled",
        value: stats.disabled,
        description: "Kept but not reused",
        icon: ToggleLeft,
      },
    ],
    [stats],
  );

  const loadMemories = useCallback(async () => {
    if (!isConnected) {
      setMemories([]);
      setBackendStats(null);
      setError("");
      return;
    }

    setLoading("load");
    setError("");

    try {
      const wallet = await getWalletAuth();
      const dashboard = await getMemoryDashboard(wallet);
      setMemories(dashboard.memories);
      setBackendStats(dashboard.stats);
    } catch (err) {
      const message = readFriendlyError(err, "Unable to load memories.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading("");
    }
  }, [getWalletAuth, isConnected]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadMemories();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadMemories]);

  const requireWallet = useCallback(async () => {
    if (!isConnected) {
      openWalletModal();
      throw new Error("Choose a wallet to manage memories.");
    }

    return getWalletAuth();
  }, [getWalletAuth, isConnected, openWalletModal]);

  const handleStatusChange = useCallback(
    async (memory: MemoryItem, status: MemoryStatus) => {
      setLoading(`status:${memory.id}`);
      setError("");

      try {
        const wallet = await requireWallet();
        const updated = await setMemoryStatus(wallet, memory.id, status);
        setMemories((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
        setBackendStats(null);
        toast.success(status === "active" ? "Memory enabled" : "Memory disabled");
      } catch (err) {
        const message = readFriendlyError(err, "Unable to update memory.");
        setError(message);
        toast.error(message);
      } finally {
        setLoading("");
      }
    },
    [requireWallet],
  );

  const handleStatusChangeMany = useCallback(
    async (memoryIds: string[], status: MemoryStatus) => {
      if (!memoryIds.length) {
        return;
      }

      setLoading("bulk-status");
      setError("");

      try {
        const wallet = await requireWallet();
        const updated = await setManyMemoryStatuses(wallet, memoryIds, status);
        const updatedById = new Map(updated.map((memory) => [memory.id, memory]));

        setMemories((current) =>
          current.map((memory) => updatedById.get(memory.id) ?? memory),
        );
        setBackendStats(null);
        toast.success("Selected memories updated");
      } catch (err) {
        const message = readFriendlyError(err, "Unable to update memories.");
        setError(message);
        toast.error(message);
      } finally {
        setLoading("");
      }
    },
    [requireWallet],
  );

  const handleDelete = useCallback(
    async (memory: MemoryItem) => {
      setLoading(`delete:${memory.id}`);
      setError("");

      try {
        const wallet = await requireWallet();
        const deletedIds = await deleteMemoryRecord(wallet, memory.id);
        const deletedSet = new Set(deletedIds);
        setMemories((current) =>
          current.filter((item) => !deletedSet.has(item.id)),
        );
        setBackendStats(null);
        toast.success("Memory deleted");
      } catch (err) {
        const message = readFriendlyError(err, "Unable to delete memory.");
        setError(message);
        toast.error(message);
      } finally {
        setLoading("");
      }
    },
    [requireWallet],
  );

  const handleDeleteMany = useCallback(
    async (memoryIds: string[]) => {
      if (!memoryIds.length) {
        return;
      }

      setLoading("bulk-delete");
      setError("");

      try {
        const wallet = await requireWallet();
        const deletedIds = await deleteManyMemoryRecords(wallet, memoryIds);
        const deletedSet = new Set(deletedIds);
        setMemories((current) =>
          current.filter((item) => !deletedSet.has(item.id)),
        );
        setBackendStats(null);
        toast.success("Selected memories deleted");
      } catch (err) {
        const message = readFriendlyError(err, "Unable to delete memories.");
        setError(message);
        toast.error(message);
      } finally {
        setLoading("");
      }
    },
    [requireWallet],
  );

  const busy = Boolean(loading) || isSigning;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Memory</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Manage what Langclaw remembers, where each memory applies, and whether
            it can be reused in future conversations.
          </p>
        </div>

        <Button
          disabled={loading === "load"}
          onClick={() => void loadMemories()}
          variant="outline"
        >
          {loading === "load" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Refresh
        </Button>
      </section>

      {!isConnected && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Wallet required</AlertTitle>
          <AlertDescription>
            Choose a wallet to load and manage saved memories.
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
        {statCards.map((stat) => {
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

      <MemoryDataTable
        data={memories}
        disabled={!isConnected || busy}
        onDelete={handleDelete}
        onDeleteMany={handleDeleteMany}
        onStatusChange={handleStatusChange}
        onStatusChangeMany={handleStatusChangeMany}
      />
    </div>
  );
}

function buildMemoryStats(memories: MemoryItem[]): MemoryStats {
  return {
    active: memories.filter((memory) => memory.status === "active").length,
    disabled: memories.filter((memory) => memory.status === "disabled").length,
    projectScoped: memories.filter((memory) => memory.scope !== "Global").length,
    total: memories.length,
  };
}
