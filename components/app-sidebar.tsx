"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import {
  Cable,
  CalendarSync,
  ChevronDown,
  CircleFadingPlus,
  Cpu,
  CreditCard,
  Database,
  LogOut,
  MessagesSquare,
  MoreHorizontal,
  PinIcon,
  PinOffIcon,
  Settings,
  Trash2,
  User2,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

import { formatUnits } from "viem";
import { useBalance, useChains, useConnection, useDisconnect } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  CHAT_SESSIONS_UPDATED_EVENT,
  checkBackendHealth,
  deleteChatSession,
  dispatchChatSessionsUpdated,
  getChatSession,
  listChatSessions,
  type ChatSession,
  upsertChatSession,
} from "@/lib/signalgraph-api";
import {
  useWalletSession,
  WALLET_AUTH_UPDATED_EVENT,
} from "@/hooks/use-wallet-session";

export function AppSidebar() {
  const { isConnected, address } = useConnection();
  const { getWalletAuth } = useWalletSession();
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState("");
  const { data: balanceUser } = useBalance({
    address: address,
  });
  const balanceLabel = useMemo(() => {
    if (!balanceUser) return null;
    return `${formatUnits(balanceUser.value, balanceUser.decimals).slice(0, 5)} ${balanceUser.symbol}`;
  }, [balanceUser]);
  const chains = useChains();
  const disconnect = useDisconnect();
  const pinnedSessions = useMemo(
    () => sessions.filter((session) => session.pinned),
    [sessions],
  );
  const recentSessions = useMemo(
    () => sessions.filter((session) => !session.pinned),
    [sessions],
  );

  const refreshSessions = useCallback(async () => {
    if (!isConnected || !address) {
      setSessions([]);
      setSessionsError("");
      setIsLoadingSessions(false);
      return;
    }

    setIsLoadingSessions(true);

    try {
      const wallet = await getWalletAuth();
      const nextSessions = await listChatSessions(wallet);
      setSessions(nextSessions);
      setSessionsError("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load chats.";
      setSessions([]);
      setSessionsError(message);
      toast.error(message);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [address, getWalletAuth, isConnected]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshSessions();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refreshSessions]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void checkBackendHealth()
        .then(() => setBackendOnline(true))
        .catch(() => {
          setBackendOnline(false);
          toast.error("Backend offline");
        });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    window.addEventListener(CHAT_SESSIONS_UPDATED_EVENT, refreshSessions);
    window.addEventListener(WALLET_AUTH_UPDATED_EVENT, refreshSessions);

    return () => {
      window.removeEventListener(CHAT_SESSIONS_UPDATED_EVENT, refreshSessions);
      window.removeEventListener(WALLET_AUTH_UPDATED_EVENT, refreshSessions);
    };
  }, [refreshSessions]);

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      try {
        const wallet = await getWalletAuth();
        await deleteChatSession(wallet, sessionId);
        setSessions((current) =>
          current.filter((session) => session.id !== sessionId),
        );
        dispatchChatSessionsUpdated();
        toast.success("Chat deleted");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Unable to delete chat.",
        );
      }
    },
    [getWalletAuth],
  );

  const handleTogglePinSession = useCallback(
    async (session: ChatSession) => {
      try {
        const wallet = await getWalletAuth();
        const fullSession = await getChatSession(wallet, session.id);

        if (!fullSession) {
          throw new Error("Chat was not found.");
        }

        const nextSession = {
          ...fullSession,
          pinned: !session.pinned,
          updatedAt: new Date().toISOString(),
        };

        await upsertChatSession(wallet, nextSession);
        setSessions((current) =>
          current.map((item) =>
            item.id === session.id
              ? { ...item, pinned: nextSession.pinned }
              : item,
          ),
        );
        dispatchChatSessionsUpdated();
        toast.success(nextSession.pinned ? "Chat pinned" : "Chat unpinned");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Unable to update chat.",
        );
      }
    },
    [getWalletAuth],
  );

  // if (isReconnecting) {
  //   <p>hai</p>;
  // }

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href={"/"}>
          <span className="text-lg font-bold mb-5">Langclaw</span>
        </Link>
        <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <span
            className={`size-2 rounded-full ${
              backendOnline === null
                ? "bg-muted-foreground/40"
                : backendOnline
                  ? "bg-emerald-500"
                  : "bg-destructive"
            }`}
          />
          <span>
            {backendOnline === false ? "Backend offline" : "Backend online"}
          </span>
        </div>
        {isConnected && (
          <Card>
            <CardHeader>
              <CardTitle>Connected</CardTitle>
              <CardDescription>
                <p>{chains[0].name}</p>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1">
                <p>
                  {address
                    ? `${address.slice(0, 6)}...${address.slice(-4)}`
                    : ""}
                </p>
                <p>{balanceLabel ? `(${balanceLabel})` : null}</p>
              </div>
            </CardContent>
          </Card>
        )}
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href="/chat">
              <CircleFadingPlus />
              <span>New Chat</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href="/task">
              <CalendarSync />
              <span>Automation Task</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href="/usage">
              <Database />
              <span>Usage</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href="/key">
              <Cable />
              <span>API Console</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href="/memory">
              <Cpu />
              <span>Memory</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href="/settings">
              <Settings />
              <span>Settings</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarHeader>
      <SidebarContent>
        {/* PINNED CHAT  */}
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                Pinned
                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SessionMenuItems
                    emptyLabel={
                      isConnected ? "No pinned chats" : "Connect wallet first"
                    }
                    isLoading={isLoadingSessions}
                    onDelete={handleDeleteSession}
                    onTogglePin={handleTogglePinSession}
                    sessions={pinnedSessions}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* RECENTS CHAT  */}
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                Recents
                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SessionMenuItems
                    emptyLabel={
                      isConnected ? "No recent chats" : "Connect wallet first"
                    }
                    isLoading={isLoadingSessions}
                    onDelete={handleDeleteSession}
                    onTogglePin={handleTogglePinSession}
                    sessions={recentSessions}
                  />
                </SidebarMenu>
                {sessionsError && (
                  <p className="px-2 pt-2 text-xs text-destructive">
                    {sessionsError}
                  </p>
                )}
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>
      <SidebarFooter>
        {isConnected ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton className="bg-primary text-primary-foreground">
                    <User2 />
                    {address
                      ? `${address.slice(0, 6)}...${address.slice(-4)}`
                      : "Wallet"}
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>
                    <CreditCard />
                    <span>{balanceLabel ?? "—"}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => disconnect.mutate()}>
                    <LogOut />
                    <span>Disconnect Wallet</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          <SidebarMenu>
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <Button onClick={openConnectModal} type="button">
                  Connect Wallet
                </Button>
              )}
            </ConnectButton.Custom>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

function SessionMenuItems({
  emptyLabel,
  isLoading,
  onDelete,
  onTogglePin,
  sessions,
}: {
  emptyLabel: string;
  isLoading: boolean;
  onDelete: (sessionId: string) => Promise<void>;
  onTogglePin: (session: ChatSession) => Promise<void>;
  sessions: ChatSession[];
}) {
  if (isLoading) {
    return (
      <>
        <SidebarMenuSkeleton showIcon />
        <SidebarMenuSkeleton showIcon />
        <SidebarMenuSkeleton showIcon />
      </>
    );
  }

  if (!sessions.length) {
    return (
      <SidebarMenuItem>
        <p className="px-2 py-1 text-xs text-muted-foreground">{emptyLabel}</p>
      </SidebarMenuItem>
    );
  }

  return sessions.map((session) => (
    <SidebarMenuItem key={session.id}>
      <SidebarMenuButton asChild tooltip={session.title}>
        <Link href={`/chat/${session.id}`}>
          <MessagesSquare />
          <span>{session.title}</span>
        </Link>
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            aria-label={`Open actions for ${session.title}`}
            showOnHover
          >
            <MoreHorizontal />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="right">
          <DropdownMenuItem onClick={() => void onTogglePin(session)}>
            {session.pinned ? <PinOffIcon /> : <PinIcon />}
            <span>{session.pinned ? "Unpin" : "Pin"}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => void onDelete(session.id)}
            variant="destructive"
          >
            <Trash2 />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  ));
}
