"use client";

import { useCallback } from "react";
import { useConnection, useSignMessage } from "wagmi";

import type { WalletAuth } from "@/lib/signalgraph-api";

export const WALLET_AUTH_UPDATED_EVENT = "langclaw-wallet-auth-updated";

const WALLET_LOGIN_PREFIX = "Login to Langclaw";
const WALLET_AUTH_STORAGE_PREFIX = "langclaw.walletAuth.v1";
const MAX_CACHED_WALLET_AUTH_AGE_MS = 29 * 24 * 60 * 60 * 1000;

type WalletAuthOptions = {
  force?: boolean;
};

export function useWalletSession() {
  const { address, isConnected } = useConnection();
  const { isPending, signMessageAsync } = useSignMessage();

  const getWalletAuth = useCallback(
    async (options: WalletAuthOptions = {}) => {
      if (!isConnected || !address) {
        throw new Error("Connect your wallet first.");
      }

      if (!options.force) {
        const cached = readCachedWalletAuth(address);

        if (cached) {
          return cached;
        }
      }

      const message = buildWalletLoginMessage(address);
      const signature = await signMessageAsync({ message });
      const walletAuth = { address, message, signature };

      writeCachedWalletAuth(walletAuth);
      dispatchWalletAuthUpdated();

      return walletAuth;
    },
    [address, isConnected, signMessageAsync]
  );

  const clearWalletAuth = useCallback(() => {
    if (address) {
      window.localStorage.removeItem(getWalletAuthStorageKey(address));
    }

    dispatchWalletAuthUpdated();
  }, [address]);

  return {
    address,
    clearWalletAuth,
    getWalletAuth,
    hasCachedWalletAuth: Boolean(address && readCachedWalletAuth(address)),
    isConnected,
    isSigning: isPending,
  };
}

export function buildWalletLoginMessage(address: string) {
  return `${WALLET_LOGIN_PREFIX}\nAddress: ${address}\nTime: ${new Date().toISOString()}`;
}

export function readCachedWalletAuth(address?: string | null) {
  if (!address || typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(getWalletAuthStorageKey(address));

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<WalletAuth>;

    if (
      typeof parsed.address !== "string" ||
      typeof parsed.message !== "string" ||
      typeof parsed.signature !== "string"
    ) {
      return null;
    }

    if (parsed.address.toLowerCase() !== address.toLowerCase()) {
      return null;
    }

    if (!parsed.message.startsWith(WALLET_LOGIN_PREFIX)) {
      return null;
    }

    const messageAddress = parsed.message
      .split("\n")
      .find((line) => line.startsWith("Address: "))
      ?.replace("Address: ", "")
      .trim();

    if (messageAddress?.toLowerCase() !== address.toLowerCase()) {
      return null;
    }

    const messageTime = parsed.message
      .split("\n")
      .find((line) => line.startsWith("Time: "))
      ?.replace("Time: ", "")
      .trim();
    const signedAt = messageTime ? new Date(messageTime).getTime() : Number.NaN;

    if (
      Number.isNaN(signedAt) ||
      Date.now() - signedAt > MAX_CACHED_WALLET_AUTH_AGE_MS ||
      signedAt - Date.now() > 5 * 60 * 1000
    ) {
      return null;
    }

    return parsed as WalletAuth;
  } catch {
    return null;
  }
}

function writeCachedWalletAuth(walletAuth: WalletAuth) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getWalletAuthStorageKey(walletAuth.address),
    JSON.stringify(walletAuth)
  );
}

function getWalletAuthStorageKey(address: string) {
  return `${WALLET_AUTH_STORAGE_PREFIX}:${address.toLowerCase()}`;
}

function dispatchWalletAuthUpdated() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(WALLET_AUTH_UPDATED_EVENT));
}
