/**
 * Squad (team) data layer — backed by Lovable Cloud.
 *
 * Every squad, member, invite, join request, chat message and planned session
 * lives in the database so they are shared across users and devices.
 */
import { supabase } from "@/integrations/supabase/client";

export type SquadRole = "captain" | "co_captain" | "player" | "sub";
export type InviteStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type JoinStatus = "pending" | "approved" | "rejected";
export type RsvpStatus = "in" | "out" | "maybe";

export interface SquadMember {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  role: SquadRole;
  joinedAt: string;
}

export interface SquadInvite {
  id: string;
  squadId: string;
  toUserId: string;
  toUsername: string;
  fromUserId: string;
  fromUsername: string;
  role: SquadRole;
  message?: string;
  status: InviteStatus;
  createdAt: string;
}

export interface SquadJoinRequest {
  id: string;
  squadId: string;
  userId: string;
  username: string;
  avatarUrl?: string | null;
  message?: string;
  status: JoinStatus;
  createdAt: string;
}

export interface SquadMessage {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string | null;
  text: string;
  createdAt: string;
  pinned?: boolean;
}

export interface SquadEvent {
  id: string;
  title: string;
  game: string;
  startsAt: string;
  notes?: string;
  type: "tournament" | "scrim" | "practice";
  createdBy: string;
  rsvps: Record<string, RsvpStatus>;
}

export interface Squad {
  id: string;
  name: string;
  tag: string;
  game: string;
  bio: string;
  color: string;
  ownerId: string;
  isPublic: boolean;
  maxMembers: number;
  createdAt: string;
  members: SquadMember[];
  invites: SquadInvite[];
  joinRequests: SquadJoinRequest[];
  messages: SquadMessage[];
  events: SquadEvent[];
  /** True when the current viewer is a member (chat/planning are gated on it). */
  isMember: boolean;
}

export const SQUAD_COLORS = [
  { name: "Neon", value: "142 76% 45%" },
  { name: "Violet", value: "280 100% 60%" },
  { name: "Cyan", value: "190 95% 50%" },
  { name: "Amber", value: "38 95% 55%" },
  { name: "Rose", value: "347 90% 60%" },
];

const EVENT = "gameflex:squads-changed";

function emit() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

type ProfileLite = { username: string; avatar_url: string | null };

async function profilesFor(ids: string[]): Promise<Record<string, ProfileLite>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data } = await supabase
    .from("profiles")
    .select("user_id, username, avatar_url")
    .in("user_id", unique);
  const out: Record<string, ProfileLite> = {};
  for (const p of data ?? []) {
    out[(p as any).user_id] = { username: (p as any).username ?? "Player", avatar_url: (p as any).avatar_url };
  }
  return out;
}

function baseSquad(row: any, members: SquadMember[], viewerId?: string | null): Squad {
  return {
    id: row.id,
    name: row.name,
    tag: row.tag ?? "",
    game: row.game ?? "other",
    bio: row.description ?? "",
    color: row.color ?? SQUAD_COLORS[0].value,
    ownerId: row.captain_id,
    isPublic: row.is_public ?? true,
    maxMembers: row.max_members ?? 10,
    createdAt: row.created_at,
    members,
    invites: [],
    joinRequests: [],
    messages: [],
    events: [],
    isMember: !!viewerId && members.some((m) => m.userId === viewerId),
  };
}

async function membersBySquad(squadIds: string[]) {
  if (squadIds.length === 0) return {} as Record<string, SquadMember[]>;
  const { data } = await supabase
    .from("squad_members")
    .select("squad_id, user_id, role, joined_at")
    .in("squad_id", squadIds);
  const rows = data ?? [];
  const profiles = await profilesFor(rows.map((r: any) => r.user_id));
  const out: Record<string, SquadMember[]> = {};
  for (const r of rows as any[]) {
    (out[r.squad_id] ??= []).push({
      userId: r.user_id,
      username: profiles[r.user_id]?.username ?? "Player",
      avatarUrl: profiles[r.user_id]?.avatar_url ?? null,
      role: (r.role ?? "player") as SquadRole,
      joinedAt: r.joined_at,
    });
  }
  return out;
}

export const squadStore = {
  event: EVENT,
  emit,

  subscribe(listener: () => void) {
    if (typeof window === "undefined") return () => {};
    window.addEventListener(EVENT, listener);
    return () => window.removeEventListener(EVENT, listener);
  },

  /** Public squads for discovery (RLS also returns squads you belong to). */
  async listSquads(viewerId?: string | null): Promise<Squad[]> {
    const { data, error } = await supabase
      .from("squads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw error;
    const rows = data ?? [];
    const members = await membersBySquad(rows.map((r: any) => r.id));
    return rows.map((r: any) => baseSquad(r, members[r.id] ?? [], viewerId));
  },

  async listMySquads(userId?: string | null): Promise<Squad[]> {
    if (!userId) return [];
    const { data } = await supabase.from("squad_members").select("squad_id").eq("user_id", userId);
    const ids = (data ?? []).map((r: any) => r.squad_id);
    if (ids.length === 0) return [];
    const { data: rows } = await supabase.from("squads").select("*").in("id", ids);
    const members = await membersBySquad(ids);
    return (rows ?? []).map((r: any) => baseSquad(r, members[r.id] ?? [], userId));
  },

  /** Full squad detail. Chat / planning / requests only load for members. */
  async getSquad(squadId: string, viewerId?: string | null): Promise<Squad | null> {
    const { data: row } = await supabase.from("squads").select("*").eq("id", squadId).maybeSingle();
    if (!row) return null;
    const members = (await membersBySquad([squadId]))[squadId] ?? [];
    const squad = baseSquad(row, members, viewerId);
    if (!squad.isMember) return squad;

    const [{ data: msgs }, { data: invites }, { data: events }, { data: requests }] = await Promise.all([
      supabase
        .from("squad_messages")
        .select("*")
        .eq("squad_id", squadId)
        .order("created_at", { ascending: true })
        .limit(300),
      supabase.from("squad_invites").select("*").eq("squad_id", squadId),
      supabase.from("squad_events").select("*").eq("squad_id", squadId),
      supabase.from("squad_join_requests").select("*").eq("squad_id", squadId).eq("status", "pending"),
    ]);

    const extraIds = [
      ...(msgs ?? []).map((m: any) => m.user_id),
      ...(invites ?? []).flatMap((i: any) => [i.invitee_id, i.inviter_id]),
      ...(requests ?? []).map((r: any) => r.user_id),
    ].filter(Boolean);
    const profiles = { ...(await profilesFor(extraIds)) };
    for (const m of members) profiles[m.userId] ??= { username: m.username, avatar_url: m.avatarUrl ?? null };

    const eventIds = (events ?? []).map((e: any) => e.id);
    let rsvps: any[] = [];
    if (eventIds.length) {
      const { data } = await supabase.from("squad_event_rsvps").select("*").in("event_id", eventIds);
      rsvps = data ?? [];
    }

    squad.messages = (msgs ?? []).map((m: any) => ({
      id: m.id,
      userId: m.is_system ? "system" : m.user_id,
      username: m.is_system ? "GameFlex" : (profiles[m.user_id]?.username ?? "Player"),
      avatarUrl: m.is_system ? null : (profiles[m.user_id]?.avatar_url ?? null),
      text: m.content,
      createdAt: m.created_at,
      pinned: m.pinned,
    }));

    squad.invites = (invites ?? []).map((i: any) => ({
      id: i.id,
      squadId: i.squad_id,
      toUserId: i.invitee_id,
      toUsername: profiles[i.invitee_id]?.username ?? "Player",
      fromUserId: i.inviter_id,
      fromUsername: profiles[i.inviter_id]?.username ?? "Player",
      role: "player",
      message: i.message ?? undefined,
      status: i.status,
      createdAt: i.created_at,
    }));

    squad.joinRequests = (requests ?? []).map((r: any) => ({
      id: r.id,
      squadId: r.squad_id,
      userId: r.user_id,
      username: profiles[r.user_id]?.username ?? "Player",
      avatarUrl: profiles[r.user_id]?.avatar_url ?? null,
      message: r.message ?? undefined,
      status: r.status,
      createdAt: r.created_at,
    }));

    squad.events = (events ?? []).map((e: any) => ({
      id: e.id,
      title: e.title,
      game: e.game ?? squad.game,
      startsAt: e.starts_at,
      notes: e.notes ?? undefined,
      type: (e.type ?? "tournament") as SquadEvent["type"],
      createdBy: e.created_by,
      rsvps: Object.fromEntries(
        rsvps.filter((r) => r.event_id === e.id).map((r) => [r.user_id, r.status as RsvpStatus]),
      ),
    }));

    return squad;
  },

  /** Pending invites addressed to the user, with squad summary. */
  async invitesFor(userId?: string | null) {
    if (!userId) return [];
    const { data } = await supabase
      .from("squad_invites")
      .select("*")
      .eq("invitee_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    const rows = data ?? [];
    if (rows.length === 0) return [];
    const { data: squads } = await supabase
      .from("squads")
      .select("*")
      .in("id", rows.map((r: any) => r.squad_id));
    const profiles = await profilesFor(rows.map((r: any) => r.inviter_id));
    return rows.map((r: any) => {
      const s: any = (squads ?? []).find((x: any) => x.id === r.squad_id) ?? {};
      return {
        id: r.id,
        squadId: r.squad_id,
        toUserId: r.invitee_id,
        fromUserId: r.inviter_id,
        fromUsername: profiles[r.inviter_id]?.username ?? "A captain",
        role: "player" as SquadRole,
        message: r.message ?? undefined,
        status: r.status as InviteStatus,
        createdAt: r.created_at,
        squad: {
          id: s.id,
          name: s.name ?? "Squad",
          tag: s.tag ?? "",
          game: s.game ?? "other",
          color: s.color ?? SQUAD_COLORS[0].value,
        },
      };
    });
  },

  /** Join requests the user has sent that are still pending. */
  async myJoinRequests(userId?: string | null): Promise<Record<string, JoinStatus>> {
    if (!userId) return {};
    const { data } = await supabase
      .from("squad_join_requests")
      .select("squad_id, status")
      .eq("user_id", userId)
      .eq("status", "pending");
    return Object.fromEntries((data ?? []).map((r: any) => [r.squad_id, r.status as JoinStatus]));
  },

  async create(input: {
    name: string;
    tag: string;
    game: string;
    bio?: string;
    color?: string;
    isPublic?: boolean;
    owner: { userId: string; username: string };
  }): Promise<{ squad?: Squad; error?: string }> {
    const { data, error } = await supabase
      .from("squads")
      .insert({
        name: input.name.trim(),
        tag: input.tag.trim().toUpperCase().slice(0, 6),
        game: input.game,
        description: input.bio?.trim() || null,
        color: input.color ?? SQUAD_COLORS[0].value,
        captain_id: input.owner.userId,
        is_public: input.isPublic ?? true,
      } as any)
      .select()
      .single();
    if (error || !data) return { error: error?.message ?? "Could not create squad" };

    await supabase.from("squad_messages").insert({
      squad_id: (data as any).id,
      is_system: true,
      pinned: true,
      content: `${input.name.trim()} was created. Invite your squadmates and lock in your first tournament.`,
    } as any);

    emit();
    return { squad: baseSquad(data, [], input.owner.userId) };
  },

  async updateDetails(
    squadId: string,
    patch: Partial<{ name: string; tag: string; game: string; bio: string; color: string; isPublic: boolean }>,
  ) {
    const row: any = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.tag !== undefined) row.tag = patch.tag;
    if (patch.game !== undefined) row.game = patch.game;
    if (patch.bio !== undefined) row.description = patch.bio;
    if (patch.color !== undefined) row.color = patch.color;
    if (patch.isPublic !== undefined) row.is_public = patch.isPublic;
    await supabase.from("squads").update(row).eq("id", squadId);
    emit();
  },

  async remove(squadId: string) {
    await supabase.from("squads").delete().eq("id", squadId);
    emit();
  },

  async invite(
    squadId: string,
    input: { toUserId: string; toUsername: string; fromUserId: string; message?: string },
  ): Promise<{ error?: string }> {
    const { data: existingMember } = await supabase
      .from("squad_members")
      .select("id")
      .eq("squad_id", squadId)
      .eq("user_id", input.toUserId)
      .maybeSingle();
    if (existingMember) return { error: `${input.toUsername} is already in this squad` };

    const { error } = await supabase.from("squad_invites").insert({
      squad_id: squadId,
      inviter_id: input.fromUserId,
      invitee_id: input.toUserId,
      message: input.message ?? null,
      status: "pending",
    } as any);
    if (error) {
      return {
        error: error.code === "23505" ? `${input.toUsername} already has a pending invite` : error.message,
      };
    }
    emit();
    return {};
  },

  async cancelInvite(inviteId: string) {
    await supabase.from("squad_invites").update({ status: "cancelled" }).eq("id", inviteId);
    emit();
  },

  async respondToInvite(inviteId: string, accept: boolean) {
    const { error } = await supabase
      .from("squad_invites")
      .update({ status: accept ? "accepted" : "rejected" })
      .eq("id", inviteId);
    emit();
    return { error: error?.message };
  },

  async requestJoin(squadId: string, userId: string, message?: string): Promise<{ error?: string }> {
    const { error } = await supabase.from("squad_join_requests").insert({
      squad_id: squadId,
      user_id: userId,
      message: message?.trim() || null,
      status: "pending",
    } as any);
    emit();
    if (error) {
      return { error: error.code === "23505" ? "You already have a pending request" : error.message };
    }
    return {};
  },

  async respondToJoinRequest(requestId: string, approve: boolean, responderId: string) {
    const { error } = await supabase
      .from("squad_join_requests")
      .update({ status: approve ? "approved" : "rejected", responded_by: responderId })
      .eq("id", requestId);
    emit();
    return { error: error?.message };
  },

  async setRole(squadId: string, userId: string, role: SquadRole) {
    await supabase.from("squad_members").update({ role }).eq("squad_id", squadId).eq("user_id", userId);
    emit();
  },

  async removeMember(squadId: string, userId: string) {
    await supabase.from("squad_members").delete().eq("squad_id", squadId).eq("user_id", userId);
    emit();
  },

  async sendMessage(squadId: string, author: { userId: string }, text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    await supabase.from("squad_messages").insert({
      squad_id: squadId,
      user_id: author.userId,
      content: trimmed.slice(0, 1000),
    } as any);
    emit();
  },

  async togglePin(squadId: string, messageId: string, pinned: boolean) {
    await supabase.from("squad_messages").update({ pinned: !pinned }).eq("id", messageId);
    emit();
  },

  async addEvent(
    squadId: string,
    input: { title: string; game: string; startsAt: string; notes?: string; type?: SquadEvent["type"]; createdBy: string },
  ) {
    const { data } = await supabase
      .from("squad_events")
      .insert({
        squad_id: squadId,
        created_by: input.createdBy,
        title: input.title.trim(),
        game: input.game,
        type: input.type ?? "tournament",
        starts_at: input.startsAt,
        notes: input.notes?.trim() || null,
      } as any)
      .select()
      .single();
    if (data) {
      await supabase
        .from("squad_event_rsvps")
        .insert({ event_id: (data as any).id, user_id: input.createdBy, status: "in" } as any);
    }
    emit();
  },

  async removeEvent(_squadId: string, eventId: string) {
    await supabase.from("squad_events").delete().eq("id", eventId);
    emit();
  },

  async rsvp(_squadId: string, eventId: string, userId: string, status: RsvpStatus) {
    await supabase
      .from("squad_event_rsvps")
      .upsert({ event_id: eventId, user_id: userId, status } as any, { onConflict: "event_id,user_id" });
    emit();
  },
};
