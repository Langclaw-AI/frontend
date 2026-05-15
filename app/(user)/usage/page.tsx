"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CopyIcon,
  InfoIcon,
  Loader2Icon,
  RefreshCcwIcon,
  SendIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { formatEther, parseEther, type Hash } from "viem";
import {
  useBalance,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWalletSession } from "@/hooks/use-wallet-session";
import {
  getUsageBalance,
  getUsageQuote,
  readFriendlyError,
  requestUsageWithdraw,
  verifyUsageDeposit,
  type UsageBalancePayload,
  type UsageDepositVerifyPayload,
  type UsageQuotePayload,
  type UsageWithdrawRequestPayload,
} from "@/lib/signalgraph-api";

const usageVaultAbi = [
  {
    inputs: [{ name: "depositReference", type: "bytes32" }],
    name: "deposit",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "amount", type: "uint256" }],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "payer", type: "address" }],
    name: "authorizedWithdrawals",
    outputs: [{ name: "amount", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "withdrawalAuthority",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "paused",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export default function UsagePage() {
  const { address, getWalletAuth, isConnected, isSigning } = useWalletSession();
  const { isPending: isDepositPending, writeContractAsync: writeDepositAsync } =
    useWriteContract();
  const {
    isPending: isWithdrawPending,
    writeContractAsync: writeWithdrawAsync,
  } = useWriteContract();
  const [quote, setQuote] = useState<UsageQuotePayload | null>(null);
  const [balance, setBalance] = useState<UsageBalancePayload | null>(null);
  const [vaultInfo, setVaultInfo] =
    useState<UsageWithdrawRequestPayload | null>(null);
  const [deposit, setDeposit] = useState<UsageDepositVerifyPayload | null>(
    null,
  );
  const [withdraw, setWithdraw] = useState<UsageWithdrawRequestPayload | null>(
    null,
  );
  const [depositAmount, setDepositAmount] = useState("0.1");
  const [depositReference, setDepositReference] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [depositHash, setDepositHash] = useState<Hash | undefined>();
  const [withdrawHash, setWithdrawHash] = useState<Hash | undefined>();
  const [txHash, setTxHash] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");
  const [copied, setCopied] = useState("");
  const autoCreditHashRef = useRef("");
  const {
    data: depositReceipt,
    isLoading: isConfirmingDeposit,
    isSuccess: isDepositConfirmed,
  } = useWaitForTransactionReceipt({
    hash: depositHash,
  });
  const {
    data: withdrawReceipt,
    isLoading: isConfirmingWithdraw,
    isSuccess: isWithdrawConfirmed,
  } = useWaitForTransactionReceipt({
    hash: withdrawHash,
  });
  const vaultAddress = (vaultInfo?.vaultAddress ?? withdraw?.vaultAddress) as
    | `0x${string}`
    | undefined;
  const connectedWalletAddress = address as `0x${string}` | undefined;
  const { data: walletBalance, isLoading: isLoadingWalletBalance } = useBalance(
    {
      address: connectedWalletAddress,
      query: {
        enabled: Boolean(connectedWalletAddress),
      },
    },
  );
  const {
    data: authorizedWithdrawalData,
    isLoading: isLoadingAuthorizedWithdrawal,
    refetch: refetchAuthorizedWithdrawal,
  } = useReadContract({
    abi: usageVaultAbi,
    address: vaultAddress,
    args: [
      connectedWalletAddress ?? "0x0000000000000000000000000000000000000000",
    ],
    functionName: "authorizedWithdrawals",
    query: {
      enabled: Boolean(vaultAddress && connectedWalletAddress),
    },
  });
  const { data: withdrawalAuthorityData, refetch: refetchWithdrawalAuthority } =
    useReadContract({
      abi: usageVaultAbi,
      address: vaultAddress,
      functionName: "withdrawalAuthority",
      query: {
        enabled: Boolean(vaultAddress),
      },
    });
  const {
    data: vaultPausedData,
    isLoading: isLoadingVaultPaused,
    refetch: refetchVaultPaused,
  } = useReadContract({
    abi: usageVaultAbi,
    address: vaultAddress,
    functionName: "paused",
    query: {
      enabled: Boolean(vaultAddress),
    },
  });
  const authorizedWithdrawal =
    typeof authorizedWithdrawalData === "bigint"
      ? authorizedWithdrawalData
      : BigInt(0);
  const parsedWithdrawAmount = useMemo(
    () => parsePositive0GAmount(withdrawAmount),
    [withdrawAmount],
  );
  const parsedDepositAmount = useMemo(
    () => parsePositive0GAmount(depositAmount),
    [depositAmount],
  );
  const wallet0GBalance = walletBalance
    ? `${trimDecimal(formatEther(walletBalance.value))} ${walletBalance.symbol}`
    : "";
  const hasNoNative0G =
    isConnected &&
    walletBalance !== undefined &&
    walletBalance.value === BigInt(0);
  const depositExceedsNativeBalance =
    parsedDepositAmount !== null &&
    walletBalance !== undefined &&
    parsedDepositAmount > walletBalance.value;
  const isVaultPaused = vaultPausedData === true;
  const withdrawalAmountIsCovered =
    parsedWithdrawAmount !== null &&
    parsedWithdrawAmount <= authorizedWithdrawal;
  const canWithdrawOnchain =
    Boolean(vaultAddress) &&
    isConnected &&
    parsedWithdrawAmount !== null &&
    withdrawalAmountIsCovered &&
    !isVaultPaused &&
    !isWithdrawPending &&
    !isConfirmingWithdraw &&
    loading !== "onchain-withdraw";

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDepositReference(createBytes32Reference());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const loadQuote = useCallback(async () => {
    try {
      const payload = await getUsageQuote();
      setQuote(payload);
    } catch (err) {
      const message = readFriendlyError(err, "Unable to load quote.");
      setError(message);
      toast.error(message);
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!isConnected) {
      setBalance(null);
      return;
    }

    setLoading("balance");
    setError("");

    try {
      const wallet = await getWalletAuth();
      const [payload, vault] = await Promise.all([
        getUsageBalance(wallet),
        requestUsageWithdraw(wallet).catch(() => null),
      ]);
      setBalance(payload);
      setVaultInfo(vault);
    } catch (err) {
      const message = readFriendlyError(err, "Unable to load balance.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading("");
    }
  }, [getWalletAuth, isConnected]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadQuote();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadQuote]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshBalance();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refreshBalance]);

  useEffect(() => {
    if (!isWithdrawConfirmed || !withdrawHash) {
      return;
    }

    toast.success("Withdrawal completed", {
      description: `${shortHash(withdrawHash)} confirmed${
        withdrawReceipt?.blockNumber
          ? ` at block ${withdrawReceipt.blockNumber.toString()}`
          : ""
      }.`,
    });

    const timeoutId = window.setTimeout(() => {
      void refreshBalance();
      void refetchAuthorizedWithdrawal();
      void refetchVaultPaused();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [
    isWithdrawConfirmed,
    refetchAuthorizedWithdrawal,
    refetchVaultPaused,
    refreshBalance,
    withdrawHash,
    withdrawReceipt?.blockNumber,
  ]);

  const handleRefreshVaultState = async () => {
    if (!vaultAddress) {
      showError(setError, "Load vault address first.");
      return;
    }

    setLoading("vault-state");
    setError("");

    try {
      await Promise.all([
        refetchAuthorizedWithdrawal(),
        refetchVaultPaused(),
        refetchWithdrawalAuthority(),
      ]);
      toast.success("Vault state refreshed");
    } catch (err) {
      const message = readFriendlyError(err, "Unable to refresh vault state.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading("");
    }
  };

  const handleVerifyDeposit = useCallback(
    async (options: { hash?: string; reference?: string; silent?: boolean } = {}) => {
      const hash = options.hash ?? (txHash.trim() || depositHash);

      if (!hash) {
        showError(setError, "Transaction hash is required.");
        return;
      }

      setLoading("deposit");
      setError("");
      setDeposit(null);

      try {
        const wallet = await getWalletAuth();
        const payload = await verifyUsageDeposit({
          reference: options.reference ?? (reference.trim() || undefined),
          txHash: hash,
          wallet,
        });
        setDeposit(payload);
        toast.success(
          options.silent ? "Deposit credited automatically" : "Deposit credited",
          {
            description: `${payload.amount0G} 0G is ready to use.`,
          },
        );
        await refreshBalance();
      } catch (err) {
        const message = readFriendlyError(err, "Unable to verify deposit.");
        setError(message);
        toast.error(message);
      } finally {
        setLoading("");
      }
    },
    [depositHash, getWalletAuth, reference, refreshBalance, txHash],
  );

  useEffect(() => {
    if (
      !depositHash ||
      !isDepositConfirmed ||
      autoCreditHashRef.current === depositHash
    ) {
      return;
    }

    autoCreditHashRef.current = depositHash;
    const timeoutId = window.setTimeout(() => {
      void handleVerifyDeposit({
        hash: depositHash,
        reference,
        silent: true,
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [depositHash, handleVerifyDeposit, isDepositConfirmed, reference]);

  const handleSendDeposit = async () => {
    if (!vaultInfo?.vaultAddress) {
      showError(setError, "Load vault address first.");
      return;
    }

    if (!parsedDepositAmount) {
      showError(setError, "Enter a valid 0G amount greater than zero.");
      return;
    }

    if (depositExceedsNativeBalance || hasNoNative0G) {
      showError(
        setError,
        "Insufficient 0G balance in your wallet for this deposit.",
      );
      return;
    }

    if (!depositReference.trim()) {
      showError(setError, "Deposit reference is required.");
      return;
    }

    if (!isBytes32(depositReference)) {
      showError(setError, "Deposit reference must be a bytes32 hex string.");
      return;
    }

    setLoading("send-deposit");
    setError("");
    setDeposit(null);

    try {
      const hash = await writeDepositAsync({
        abi: usageVaultAbi,
        address: vaultInfo.vaultAddress as `0x${string}`,
        args: [depositReference as `0x${string}`],
        functionName: "deposit",
        value: parsedDepositAmount,
      });
      setDepositHash(hash);
      setTxHash(hash);
      setReference(depositReference);
      toast.success("Deposit transaction sent", {
        description: `${shortHash(hash)} is waiting for confirmation.`,
      });
    } catch (err) {
      const message = readFriendlyError(err, "Unable to send deposit.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading("");
    }
  };

  const handleLoadVault = async () => {
    setLoading("vault");
    setError("");

    try {
      const wallet = await getWalletAuth();
      const payload = await requestUsageWithdraw(wallet);
      setVaultInfo(payload);
      toast.success("Usage vault loaded", {
        description: shortHash(payload.vaultAddress),
      });
    } catch (err) {
      const message = readFriendlyError(err, "Unable to load vault.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading("");
    }
  };

  const handleWithdrawRequest = async () => {
    if (!parsedWithdrawAmount) {
      showError(setError, "Enter a valid withdrawal amount greater than zero.");
      return;
    }

    setLoading("withdraw");
    setError("");
    setWithdraw(null);

    try {
      const wallet = await getWalletAuth();
      const payload = await requestUsageWithdraw(wallet);
      setWithdraw(payload);
      setVaultInfo(payload);
      toast.info("Withdraw request prepared", {
        description: "You can withdraw after Langclaw approves the amount.",
      });
    } catch (err) {
      const message = readFriendlyError(err, "Unable to request withdraw.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading("");
    }
  };

  const handleWithdrawOnchain = async () => {
    if (!vaultAddress) {
      showError(setError, "Load vault address first.");
      return;
    }

    if (!parsedWithdrawAmount) {
      showError(setError, "Enter a valid withdrawal amount greater than zero.");
      return;
    }

    if (isVaultPaused) {
      showError(setError, "Vault is paused.");
      return;
    }

    if (!withdrawalAmountIsCovered) {
      showError(
        setError,
        "Backend has not authorized enough withdrawal allowance on-chain yet.",
      );
      return;
    }

    setLoading("onchain-withdraw");
    setError("");

    try {
      const hash = await writeWithdrawAsync({
        abi: usageVaultAbi,
        address: vaultAddress,
        args: [parsedWithdrawAmount],
        functionName: "withdraw",
      });

      setWithdrawHash(hash);
      toast.success("Withdrawal transaction sent", {
        description: `${shortHash(hash)} is waiting for confirmation.`,
      });
    } catch (err) {
      const message = readFriendlyError(err, "Unable to withdraw from vault.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-semibold text-2xl">Credits & Balance</h1>
          <p className="text-muted-foreground text-sm">
            Add 0G credits, track spend, and withdraw unused balance.
          </p>
        </div>
        <Button
          disabled={!isConnected || loading === "balance" || isSigning}
          onClick={() => void refreshBalance()}
          size="sm"
          variant="outline"
        >
          {loading === "balance" ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <RefreshCcwIcon className="size-4" />
          )}
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircleIcon className="size-4" />
          <AlertTitle>Something needs attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {(hasNoNative0G || depositExceedsNativeBalance) && (
        <Alert>
          <InfoIcon className="size-4" />
          <AlertTitle>Insufficient wallet balance</AlertTitle>
          <AlertDescription>
            Your wallet has {wallet0GBalance || "0 0G"}. Lower the deposit
            amount or add 0G to this wallet first.
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Available"
          title={balance?.balance.available0G ?? "Connect wallet"}
          unit="0G"
        />
        <MetricCard
          label="Reserved"
          title={balance?.balance.reserved0G ?? "0"}
          unit="0G"
        />
        <MetricCard
          label="Estimated run"
          title={quote?.quote.estimatedCost0G ?? "Not available"}
          unit="0G"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-lg" size="sm">
          <CardHeader>
            <CardTitle>Balance overview</CardTitle>
            <CardDescription>
              Credits available for chat, research, and API requests.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">0G</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <UsageRow
                  label="Available"
                  token={balance?.balance.available0G}
                />
                <UsageRow
                  label="Reserved"
                  token={balance?.balance.reserved0G}
                />
                <UsageRow
                  label="Lifetime deposited"
                  token={balance?.balance.lifetimeDeposited0G}
                />
                <UsageRow
                  label="Lifetime charged"
                  token={balance?.balance.lifetimeCharged0G}
                />
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-lg" size="sm">
          <CardHeader>
            <CardTitle>Typical request</CardTitle>
            <CardDescription>
              Current estimate before a paid research run starts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Detail label="Model" value={quote?.quote.model} />
            <Detail
              label="Estimated cost"
              value={
                quote?.quote.estimatedCost0G
                  ? `${quote.quote.estimatedCost0G} 0G`
                  : undefined
              }
            />
            <Detail
              label="Prompt size"
              value={
                quote?.quote.estimatedPromptTokens
                  ? `${quote.quote.estimatedPromptTokens.toLocaleString()} tokens`
                  : undefined
              }
            />
            <Detail
              label="Answer size"
              value={
                quote?.quote.estimatedCompletionTokens
                  ? `${quote.quote.estimatedCompletionTokens.toLocaleString()} tokens`
                  : undefined
              }
            />
            <Detail
              label="Fetched"
              value={
                quote?.quote.priceFetchedAt
                  ? new Date(quote.quote.priceFetchedAt).toLocaleString()
                  : undefined
              }
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-lg lg:col-span-2" size="sm">
          <CardHeader>
            <CardTitle>Add 0G credits</CardTitle>
            <CardDescription>
              Confirm the wallet transaction. Langclaw credits your account
              automatically after it lands on-chain.
            </CardDescription>
            <CardAction>
              <Button
                disabled={loading === "vault" || isSigning}
                onClick={() => void handleLoadVault()}
                size="sm"
                variant="outline"
              >
                {loading === "vault" ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <RefreshCcwIcon className="size-4" />
                )}
                Refresh vault
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[0.75fr_1.25fr]">
              <div className="space-y-2">
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">
                    Amount
                  </span>
                  <Input
                    inputMode="decimal"
                    onChange={(event) =>
                      setDepositAmount(event.currentTarget.value)
                    }
                    placeholder="0.1"
                    value={depositAmount}
                  />
                </label>
                <div className="flex gap-2">
                  <Button
                    disabled={
                      !vaultInfo?.vaultAddress ||
                      !isConnected ||
                      isDepositPending ||
                      loading === "send-deposit" ||
                      !parsedDepositAmount ||
                      depositExceedsNativeBalance ||
                      hasNoNative0G
                    }
                    onClick={() => void handleSendDeposit()}
                    size="sm"
                  >
                    {isDepositPending || loading === "send-deposit" ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <SendIcon className="size-4" />
                    )}
                    Send deposit
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  Wallet balance:{" "}
                  {isLoadingWalletBalance
                    ? "Loading"
                    : wallet0GBalance || "Connect wallet"}
                </p>
              </div>
              <div className="space-y-2">
                <CopyField
                  copied={copied}
                  label="Vault address"
                  onCopy={setCopied}
                  value={vaultInfo?.vaultAddress ?? ""}
                />
                <CopyField
                  copied={copied}
                  label="Reference"
                  onCopy={setCopied}
                  value={depositReference}
                />
                <Button
                  onClick={() => setDepositReference(createBytes32Reference())}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Generate reference
                </Button>
              </div>
            </div>
            <DepositStatus
              credited={deposit}
              hash={depositHash}
              isConfirmed={isDepositConfirmed}
              isConfirming={isConfirmingDeposit}
              receiptBlock={depositReceipt?.blockNumber?.toString()}
            />
          </CardContent>
        </Card>

        <Card className="rounded-lg" size="sm">
          <CardHeader>
            <CardTitle>Already sent a deposit?</CardTitle>
            <CardDescription>
              Paste a transaction hash to reconcile an older deposit.
            </CardDescription>
            <CardAction>
              <Button
                disabled={loading === "deposit" || isSigning}
                onClick={() => void handleVerifyDeposit()}
                size="sm"
              >
                {loading === "deposit" ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <ShieldCheckIcon className="size-4" />
                )}
                Verify
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              onChange={(event) => setTxHash(event.currentTarget.value)}
              placeholder="0x transaction hash"
              value={txHash}
            />
            <Input
              onChange={(event) => setReference(event.currentTarget.value)}
              placeholder="reference (optional for receive deposits)"
              value={reference}
            />
            <p className="text-muted-foreground text-xs">
              Use this for deposits sent outside the UI. If you called
              deposit(bytes32), paste the same reference.
            </p>
            {deposit && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <Detail
                  label="Credited"
                  value={deposit.credited ? "yes" : "no"}
                />
                <Detail label="Amount" value={`${deposit.amount0G} 0G`} />
                <Detail
                  label="Balance after"
                  value={formatNeuron(deposit.balanceAfter)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg" size="sm">
          <CardHeader>
            <CardTitle>Withdraw 0G</CardTitle>
            <CardDescription>
              Prepare a withdrawal, then confirm it from your wallet.
            </CardDescription>
            <CardAction>
              <Button
                disabled={loading === "vault-state" || !vaultAddress}
                onClick={() => void handleRefreshVaultState()}
                size="sm"
                variant="outline"
              >
                {loading === "vault-state" ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <RefreshCcwIcon className="size-4" />
                )}
                Refresh
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">
                Amount to withdraw
              </span>
              <Input
                inputMode="decimal"
                onChange={(event) =>
                  setWithdrawAmount(event.currentTarget.value)
                }
                placeholder="0.05"
                value={withdrawAmount}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={loading === "withdraw" || isSigning || !isConnected}
                onClick={() => void handleWithdrawRequest()}
                size="sm"
                variant="outline"
              >
                {loading === "withdraw" && (
                  <Loader2Icon className="size-4 animate-spin" />
                )}
                Prepare
              </Button>
              <Button
                disabled={!canWithdrawOnchain}
                onClick={() => void handleWithdrawOnchain()}
                size="sm"
              >
                {isWithdrawPending ||
                isConfirmingWithdraw ||
                loading === "onchain-withdraw" ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <SendIcon className="size-4" />
                )}
                Withdraw
              </Button>
            </div>
            <Detail
              label="Vault"
              value={withdraw?.vaultAddress ?? vaultInfo?.vaultAddress}
            />
            <Detail label="Function" value={withdraw?.functionName} />
            <Detail label="Available" value={withdraw?.balance.available0G} />
            <Detail
              label="Authorized on-chain"
              value={
                isLoadingAuthorizedWithdrawal
                  ? "Loading"
                  : `${format0G(authorizedWithdrawal)} 0G`
              }
            />
            <Detail
              label="Requested amount"
              value={
                parsedWithdrawAmount === null
                  ? "Not available"
                  : `${format0G(parsedWithdrawAmount)} 0G`
              }
            />
            <Detail
              label="Withdrawal authority"
              value={String(withdrawalAuthorityData ?? "")}
            />
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={
                  isLoadingVaultPaused
                    ? "Vault loading"
                    : isVaultPaused
                      ? "Vault paused"
                      : "Vault active"
                }
                variant={isVaultPaused ? "destructive" : "secondary"}
              />
              <StatusBadge
                label={
                  withdrawalAmountIsCovered
                    ? "Allowance ready"
                    : "Waiting authorization"
                }
                variant={withdrawalAmountIsCovered ? "secondary" : "outline"}
              />
              {withdrawHash && (
                <StatusBadge
                  label={
                    isWithdrawConfirmed
                      ? `Withdraw confirmed${withdrawReceipt?.blockNumber ? ` #${withdrawReceipt.blockNumber.toString()}` : ""}`
                      : isConfirmingWithdraw
                        ? "Withdraw confirming"
                        : shortHash(withdrawHash) || "Withdraw sent"
                  }
                  variant={isWithdrawConfirmed ? "secondary" : "outline"}
                />
              )}
            </div>
            <Alert>
              <ShieldCheckIcon className="size-4" />
              <AlertTitle>Withdrawal approval</AlertTitle>
              <AlertDescription>
                The withdraw button unlocks once Langclaw approves this wallet
                and amount.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  title,
  unit,
}: {
  label: string;
  title: string;
  unit: string;
}) {
  return (
    <Card className="rounded-lg" size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="break-all text-2xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground text-xs">
        {unit}
      </CardContent>
    </Card>
  );
}

function UsageRow({
  label,
  token,
}: {
  label: string;
  token?: string;
}) {
  return (
    <TableRow>
      <TableCell>{label}</TableCell>
      <TableCell className="text-right">{token ?? "Not available"}</TableCell>
    </TableRow>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value ?? "Not available"}</span>
    </div>
  );
}

function StatusBadge({
  label,
  variant,
}: {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
}) {
  return <Badge variant={variant}>{label}</Badge>;
}

function CopyField({
  copied,
  label,
  onCopy,
  value,
}: {
  copied: string;
  label: string;
  onCopy: (value: string) => void;
  value: string;
}) {
  const handleCopy = async () => {
    if (!value) {
      return;
    }

    await navigator.clipboard.writeText(value);
    onCopy(label);
    window.setTimeout(() => onCopy(""), 1200);
  };

  return (
    <div className="rounded-md border bg-muted/20 p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">{label}</span>
        <Button
          disabled={!value}
          onClick={() => void handleCopy()}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          {copied === label ? (
            <CheckCircle2Icon className="size-3" />
          ) : (
            <CopyIcon className="size-3" />
          )}
        </Button>
      </div>
      <p className="break-all font-mono text-xs">
        {value || "Load vault first"}
      </p>
    </div>
  );
}

function DepositStatus({
  credited,
  hash,
  isConfirmed,
  isConfirming,
  receiptBlock,
}: {
  credited: UsageDepositVerifyPayload | null;
  hash?: string;
  isConfirmed: boolean;
  isConfirming: boolean;
  receiptBlock?: string;
}) {
  if (!hash && !credited) {
    return (
      <div className="grid gap-2 text-sm md:grid-cols-3">
        <Step label="1" text="Load vault" />
        <Step label="2" text="Confirm deposit" />
        <Step label="3" text="Credit updates automatically" />
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3 text-sm">
      <div className="grid gap-2 md:grid-cols-3">
        <Detail label="Tx hash" value={shortHash(hash)} />
        <Detail
          label="Confirmation"
          value={
            isConfirmed
              ? `confirmed${receiptBlock ? ` at ${receiptBlock}` : ""}`
              : isConfirming
                ? "confirming"
                : "pending"
          }
        />
        <Detail
          label="Credit"
          value={
            credited
              ? `${credited.credited ? "credited" : "already credited"} ${credited.amount0G} 0G`
              : isConfirmed
                ? "crediting"
                : "waiting for confirmation"
          }
        />
      </div>
    </div>
  );
}

function Step({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/20 p-2">
      <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
        {label}
      </span>
      <span>{text}</span>
    </div>
  );
}

function shortHash(value?: string) {
  return value && value.length > 16
    ? `${value.slice(0, 10)}...${value.slice(-6)}`
    : value;
}

function createBytes32Reference() {
  const bytes = new Uint8Array(32);

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function isBytes32(value: string) {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

function parsePositive0GAmount(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = parseEther(trimmed);

    return parsed > BigInt(0) ? parsed : null;
  } catch {
    return null;
  }
}

function format0G(value: bigint) {
  return trimDecimal(formatEther(value));
}

function showError(setError: (message: string) => void, message: string) {
  setError(message);
  toast.error(message);
}

function formatNeuron(value: string) {
  try {
    return trimDecimal(formatEther(BigInt(value)));
  } catch {
    return value;
  }
}

function trimDecimal(value: string) {
  return value.includes(".")
    ? value.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "")
    : value;
}
