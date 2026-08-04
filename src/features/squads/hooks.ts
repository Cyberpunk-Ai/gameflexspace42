import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { squadStore, type Squad } from "./store";

/** Invalidate squad queries whenever the store mutates (this tab or realtime). */
function useSquadSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const refresh = () => qc.invalidateQueries({ queryKey: ["squads"] });
    const off = squadStore.subscribe(refresh);
    const channel = supabase
      .channel("squads-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "squad_messages" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "squad_members" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "squad_invites" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "squad_join_requests" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "squad_events" }, refresh)
      .subscribe();
    return () => {
      off();
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

export function useCurrentPlayer() {
  const { user, profile } = useAuth();
  return useMemo(
    () =>
      user
        ? {
            userId: user.id,
            username: profile?.username ?? user.email?.split("@")[0] ?? "Player",
            avatarUrl: profile?.avatar_url ?? null,
          }
        : null,
    [user, profile],
  );
}

/** Squads the signed-in player belongs to. */
export function useSquads() {
  useSquadSync();
  const me = useCurrentPlayer();
  const { data = [] } = useQuery({
    queryKey: ["squads", "mine", me?.userId],
    enabled: !!me?.userId,
    queryFn: () => squadStore.listMySquads(me!.userId),
  });
  return data as Squad[];
}

/** Public squads available to discover and request to join. */
export function useDiscoverSquads() {
  useSquadSync();
  const me = useCurrentPlayer();
  return useQuery({
    queryKey: ["squads", "discover", me?.userId ?? "guest"],
    queryFn: () => squadStore.listSquads(me?.userId),
  });
}

export function useSquad(squadId?: string) {
  useSquadSync();
  const me = useCurrentPlayer();
  return useQuery({
    queryKey: ["squads", "detail", squadId, me?.userId ?? "guest"],
    enabled: !!squadId,
    queryFn: () => squadStore.getSquad(squadId!, me?.userId),
  });
}

export function useSquadInvites() {
  useSquadSync();
  const me = useCurrentPlayer();
  const { data = [] } = useQuery({
    queryKey: ["squads", "invites", me?.userId],
    enabled: !!me?.userId,
    queryFn: () => squadStore.invitesFor(me!.userId),
  });
  return data as Awaited<ReturnType<typeof squadStore.invitesFor>>;
}

export function useMyJoinRequests() {
  const me = useCurrentPlayer();
  const { data = {} } = useQuery({
    queryKey: ["squads", "my-join-requests", me?.userId],
    enabled: !!me?.userId,
    queryFn: () => squadStore.myJoinRequests(me!.userId),
  });
  return data as Record<string, string>;
}

export interface MemberStats {
  userId: string;
  rating: number;
  matchesPlayed: number;
  matchesWon: number;
  rank: number;
}

/** Live leaderboard rating + global rank for every member of a squad. */
export function useMemberStats(userIds: string[]) {
  const key = [...userIds].sort().join(",");
  return useQuery({
    queryKey: ["squads", "member-stats", key],
    enabled: userIds.length > 0,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Record<string, MemberStats>> => {
      const { data } = await supabase
        .from("leaderboard_stats")
        .select("user_id, points, wins, losses, tournaments_played")
        .in("user_id", userIds);

      const out: Record<string, MemberStats> = {};
      await Promise.all(
        (data ?? []).map(async (row: any) => {
          const { count } = await supabase
            .from("leaderboard_stats")
            .select("*", { count: "exact", head: true })
            .gt("points", row.points ?? 0);
          out[row.user_id] = {
            userId: row.user_id,
            rating: row.points ?? 0,
            matchesPlayed: (row.wins ?? 0) + (row.losses ?? 0),
            matchesWon: row.wins ?? 0,
            rank: (count ?? 0) + 1,
          };
        }),
      );
      return out;
    },
  });
}

/** Username search used by the invite flow. */
export function usePlayerSearch(term: string) {
  const me = useCurrentPlayer();
  const q = term.trim();
  return useQuery({
    queryKey: ["squads", "player-search", q],
    enabled: q.length >= 2,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url")
        .ilike("username", `%${q}%`)
        .limit(8);
      return (data ?? [])
        .map((p: any) => ({ id: p.user_id, username: p.username, avatar_url: p.avatar_url }))
        .filter((p) => p.id !== me?.userId);
    },
  });
}

/** Best-effort in-app notification (invite notifications also fire in the DB). */
export function useNotifyInvite() {
  return useCallback(async (_toUserId: string, _squadName: string, _fromUsername: string) => {
    /* handled by database trigger */
  }, []);
}

