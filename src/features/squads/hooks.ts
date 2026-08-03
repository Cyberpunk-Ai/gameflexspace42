import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { squadStore, type Squad } from "./store";

/** Re-renders whenever squad data changes (this tab or another one). */
function useSquadVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => squadStore.subscribe(() => setVersion((v) => v + 1)), []);
  return version;
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

export function useSquads() {
  const version = useSquadVersion();
  const me = useCurrentPlayer();
  return useMemo(
    () => squadStore.forUser(me?.userId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [me?.userId, version],
  );
}

export function useSquad(squadId?: string): Squad | undefined {
  const version = useSquadVersion();
  return useMemo(
    () => (squadId ? squadStore.get(squadId) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [squadId, version],
  );
}

export function useSquadInvites() {
  const version = useSquadVersion();
  const me = useCurrentPlayer();
  return useMemo(
    () => squadStore.invitesFor(me?.userId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [me?.userId, version],
  );
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
        .select("user_id, rating, matches_played, matches_won")
        .in("user_id", userIds);

      const out: Record<string, MemberStats> = {};
      await Promise.all(
        (data ?? []).map(async (row: any) => {
          const { count } = await supabase
            .from("leaderboard_stats")
            .select("*", { count: "exact", head: true })
            .gt("rating", row.rating ?? 0);
          out[row.user_id] = {
            userId: row.user_id,
            rating: row.rating ?? 0,
            matchesPlayed: row.matches_played ?? 0,
            matchesWon: row.matches_won ?? 0,
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
        .select("id, username, avatar_url")
        .ilike("username", `%${q}%`)
        .limit(8);
      return (data ?? []).filter((p: any) => p.id !== me?.userId);
    },
  });
}

/** Best-effort in-app notification for the invited player. */
export function useNotifyInvite() {
  return useCallback(
    async (toUserId: string, squadName: string, fromUsername: string) => {
      try {
        await supabase.from("notifications").insert({
          user_id: toUserId,
          type: "system",
          title: `Squad invite from ${fromUsername}`,
          message: `You've been invited to join ${squadName}. Open Squads to accept.`,
        } as any);
      } catch {
        /* notifications are best-effort */
      }
    },
    [],
  );
}
