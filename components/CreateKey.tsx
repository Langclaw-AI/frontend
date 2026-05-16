"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckIcon,
  CopyIcon,
  KeyRoundIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWalletSession } from "@/hooks/use-wallet-session";
import {
  createApiKey,
  listApiKeys,
  readFriendlyError,
  revokeApiKey,
  type ApiKeyRecord,
  type WalletAuthPurpose,
} from "@/lib/langclaw-api";

export default function CreateKey() {
  const { getWalletAuth, isConnected, isSigning, openWalletModal } =
    useWalletSession();
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");
  const [open, setOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    if (!isConnected) {
      setKeys([]);
      return;
    }

    setLoading("list");
    setError("");

    try {
      const wallet = await getWalletAuth();
      setKeys(await listApiKeys(wallet));
    } catch (err) {
      const message = readFriendlyError(err, "Unable to load API keys.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading("");
    }
  }, [getWalletAuth, isConnected]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadKeys();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadKeys]);

  const requireWallet = async (purpose?: WalletAuthPurpose) => {
    if (!isConnected) {
      openWalletModal();
      throw new Error("Choose a wallet to manage API keys.");
    }

    return getWalletAuth(purpose ? { force: true, purpose } : undefined);
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Give this key a short name.");
      return;
    }

    setLoading("create");
    setError("");

    try {
      const wallet = await requireWallet("api-key:create");
      const payload = await createApiKey(wallet, trimmedName);
      setKeys((current) => [payload.key, ...current]);
      setSecret(payload.secret);
      setName("");
      setOpen(false);
      toast.success("API key created");
    } catch (err) {
      const message = readFriendlyError(err, "Unable to create API key.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading("");
    }
  };

  const handleRevoke = async (keyId: string) => {
    setLoading(keyId);
    setError("");

    try {
      const wallet = await requireWallet();
      const revoked = await revokeApiKey(wallet, keyId);
      setKeys((current) =>
        current.map((key) => (key.id === keyId ? revoked : key)),
      );
      toast.success("API key revoked");
    } catch (err) {
      const message = readFriendlyError(err, "Unable to revoke API key.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading("");
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success("Copied to clipboard");
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-lg" size="sm">
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Create server-side keys for apps that call Langclaw directly.
          </CardDescription>
          <CardAction className="flex gap-2">
            <Button
              disabled={loading === "list"}
              onClick={() => void loadKeys()}
              size="sm"
              variant="outline"
            >
              {loading === "list" && (
                <Loader2Icon className="size-4 animate-spin" />
              )}
              Refresh
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button disabled={isSigning || keys.filter((key) => key.status === "active").length >= 3} size="sm">
                  <PlusIcon className="size-4" />
                  New key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create API key</DialogTitle>
                  <DialogDescription>
                    The secret is shown once. Store it in your server
                    environment.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    onChange={(event) => setName(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void handleCreate();
                      }
                    }}
                    placeholder="Production server"
                    value={name}
                  />
                  <Button
                    disabled={loading === "create" || isSigning}
                    onClick={() => void handleCreate()}
                  >
                    {loading === "create" ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <KeyRoundIcon className="size-4" />
                    )}
                    Create key
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Something needs attention</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {secret && (
            <Alert>
              <KeyRoundIcon className="size-4" />
              <AlertTitle>Secret key created</AlertTitle>
              <AlertDescription className="space-y-3">
                <span className="block">
                  This is the only time the full key is shown.
                </span>
                <div className="flex min-w-0 items-start gap-2 rounded-md border bg-muted/30 p-2">
                  <code className="min-w-0 flex-1 break-all font-mono text-xs select-text">
                    {secret}
                  </code>
                  <Button
                    aria-label="Copy API key secret"
                    onClick={() => void copyToClipboard(secret, "secret")}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {copiedId === "secret" ? (
                      <CheckIcon className="size-3" />
                    ) : (
                      <CopyIcon className="size-3" />
                    )}
                    {copiedId === "secret" ? "Copied" : "Copy"}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.length ? (
                keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell className="max-w-56">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <code className="min-w-0 flex-1 truncate font-mono text-xs">
                          {key.maskedKey}
                        </code>
                        <Button
                          aria-label={`Copy key ${key.name}`}
                          onClick={() =>
                            void copyToClipboard(key.maskedKey, key.id)
                          }
                          size="icon-xs"
                          type="button"
                          variant="ghost"
                        >
                          {copiedId === key.id ? (
                            <CheckIcon className="size-3" />
                          ) : (
                            <CopyIcon className="size-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{key.status}</TableCell>
                    <TableCell>{formatDate(key.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        disabled={key.status !== "active" || loading === key.id}
                        onClick={() => void handleRevoke(key.id)}
                        size="sm"
                        variant="destructive"
                      >
                        {loading === key.id ? (
                          <Loader2Icon className="size-4 animate-spin" />
                        ) : (
                          <Trash2Icon className="size-4" />
                        )}
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    className="py-8 text-center text-muted-foreground"
                    colSpan={5}
                  >
                    {isConnected
                      ? "No API keys yet."
                      : "Choose a wallet to load API keys."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) {
    return "Not used";
  }

  return new Date(value).toLocaleString();
}
