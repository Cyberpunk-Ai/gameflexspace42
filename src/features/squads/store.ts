/**
 * Squad (team) data layer.
 *
 * Persisted locally so squads, invites, chat and tournament plans survive
 * reloads. The API surface is intentionally async + service-shaped so it can be
 * swapped for database-backed calls later without touching the UI.
 */

export type SquadRole = "captain" | "player" | "sub";
export type InviteStatus = "pending" | "accepted" | "declined";
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
  createdAt: string;
  members: SquadMember[];
  invites: SquadInvite[];
  messages: SquadMessage[];
  events: SquadEvent[];
}

const KEY = "gameflex_squads_v1";
const EVENT = "gameflex:squads-changed";

export const SQUAD_COLORS = [
  { name: "Neon", value: "142 76% 45%" },
  { name: "Violet", value: "280 100% 60%" },
  { name: "Cyan", value: "190 95% 50%" },
  { name: "Amber", value: "38 95% 55%" },
  { name: "Rose", value: "347 90% 60%" },
];

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function read(): Squad[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Squad[]) : [];
  } catch {
    return [];
  }
}

function write(squads: Squad[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(squads));
  } catch {
    /* storage full / blocked */
  }
  window.dispatchEvent(new Event(EVENT));
}

function mutate(fn: (squads: Squad[]) => Squad[]) {
  write(fn(read()));
}

function updateSquad(squadId: string, fn: (squad: Squad) => Squad) {
  mutate((squads) => squads.map((s) => (s.id === squadId ? fn(s) : s)));
}

export const squadStore = {
  key: KEY,
  event: EVENT,

  subscribe(listener: () => void) {
    if (typeof window === "undefined") return () => {};
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === KEY) listener();
    };
    window.addEventListener(EVENT, listener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, listener);
      window.removeEventListener("storage", onStorage);
    };
  },

  all(): Squad[] {
    return read();
  },

  get(squadId: string): Squad | undefined {
    return read().find((s) => s.id === squadId);
  },

  /** Squads the user is already a member of. */
  forUser(userId?: string | null): Squad[] {
    if (!userId) return [];
    return read().filter((s) => s.members.some((m) => m.userId === userId));
  },

  /** Pending invites addressed to the user. */
  invitesFor(userId?: string | null): Array<SquadInvite & { squad: Squad }> {
    if (!userId) return [];
    return read().flatMap((squad) =>
      squad.invites
        .filter((i) => i.toUserId === userId && i.status === "pending")
        .map((i) => ({ ...i, squad })),
    );
  },

  create(input: {
    name: string;
    tag: string;
    game: string;
    bio?: string;
    color?: string;
    owner: { userId: string; username: string; avatarUrl?: string | null };
  }): Squad {
    const now = new Date().toISOString();
    const squad: Squad = {
      id: uid("sq"),
      name: input.name.trim(),
      tag: input.tag.trim().toUpperCase().slice(0, 6),
      game: input.game,
      bio: input.bio?.trim() ?? "",
      color: input.color ?? SQUAD_COLORS[0].value,
      ownerId: input.owner.userId,
      createdAt: now,
      members: [
        {
          userId: input.owner.userId,
          username: input.owner.username,
          avatarUrl: input.owner.avatarUrl ?? null,
          role: "captain",
          joinedAt: now,
        },
      ],
      invites: [],
      messages: [
        {
          id: uid("msg"),
          userId: "system",
          username: "GameFlex",
          text: `${input.name} was created. Invite your squadmates and lock in your first tournament.`,
          createdAt: now,
          pinned: true,
        },
      ],
      events: [],
    };
    mutate((squads) => [squad, ...squads]);
    return squad;
  },

  updateDetails(squadId: string, patch: Partial<Pick<Squad, "name" | "tag" | "game" | "bio" | "color">>) {
    updateSquad(squadId, (s) => ({ ...s, ...patch }));
  },

  remove(squadId: string) {
    mutate((squads) => squads.filter((s) => s.id !== squadId));
  },

  invite(
    squadId: string,
    input: {
      toUserId: string;
      toUsername: string;
      fromUserId: string;
      fromUsername: string;
      role?: SquadRole;
      message?: string;
    },
  ): { error?: string } {
    const squad = squadStore.get(squadId);
    if (!squad) return { error: "Squad not found" };
    if (squad.members.some((m) => m.userId === input.toUserId))
      return { error: `${input.toUsername} is already in this squad` };
    if (squad.invites.some((i) => i.toUserId === input.toUserId && i.status === "pending"))
      return { error: `${input.toUsername} already has a pending invite` };

    const invite: SquadInvite = {
      id: uid("inv"),
      squadId,
      toUserId: input.toUserId,
      toUsername: input.toUsername,
      fromUserId: input.fromUserId,
      fromUsername: input.fromUsername,
      role: input.role ?? "player",
      message: input.message,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    updateSquad(squadId, (s) => ({ ...s, invites: [invite, ...s.invites] }));
    return {};
  },

  cancelInvite(squadId: string, inviteId: string) {
    updateSquad(squadId, (s) => ({ ...s, invites: s.invites.filter((i) => i.id !== inviteId) }));
  },

  respondToInvite(
    squadId: string,
    inviteId: string,
    accept: boolean,
    user: { userId: string; username: string; avatarUrl?: string | null },
  ) {
    updateSquad(squadId, (s) => {
      const invite = s.invites.find((i) => i.id === inviteId);
      if (!invite) return s;
      const now = new Date().toISOString();
      const invites = s.invites.map((i) =>
        i.id === inviteId ? { ...i, status: accept ? "accepted" : "declined" } : i,
      ) as SquadInvite[];
      if (!accept) return { ...s, invites };
      const already = s.members.some((m) => m.userId === user.userId);
      return {
        ...s,
        invites,
        members: already
          ? s.members
          : [
              ...s.members,
              {
                userId: user.userId,
                username: user.username,
                avatarUrl: user.avatarUrl ?? null,
                role: invite.role,
                joinedAt: now,
              },
            ],
        messages: [
          ...s.messages,
          {
            id: uid("msg"),
            userId: "system",
            username: "GameFlex",
            text: `${user.username} joined the squad as ${invite.role}.`,
            createdAt: now,
          },
        ],
      };
    });
  },

  setRole(squadId: string, userId: string, role: SquadRole) {
    updateSquad(squadId, (s) => ({
      ...s,
      members: s.members.map((m) => (m.userId === userId ? { ...m, role } : m)),
    }));
  },

  removeMember(squadId: string, userId: string) {
    updateSquad(squadId, (s) => ({
      ...s,
      members: s.members.filter((m) => m.userId !== userId),
      events: s.events.map((e) => {
        const rsvps = { ...e.rsvps };
        delete rsvps[userId];
        return { ...e, rsvps };
      }),
    }));
  },

  sendMessage(
    squadId: string,
    author: { userId: string; username: string; avatarUrl?: string | null },
    text: string,
  ) {
    const trimmed = text.trim();
    if (!trimmed) return;
    updateSquad(squadId, (s) => ({
      ...s,
      messages: [
        ...s.messages,
        {
          id: uid("msg"),
          userId: author.userId,
          username: author.username,
          avatarUrl: author.avatarUrl ?? null,
          text: trimmed.slice(0, 1000),
          createdAt: new Date().toISOString(),
        },
      ].slice(-300),
    }));
  },

  togglePin(squadId: string, messageId: string) {
    updateSquad(squadId, (s) => ({
      ...s,
      messages: s.messages.map((m) => (m.id === messageId ? { ...m, pinned: !m.pinned } : m)),
    }));
  },

  addEvent(
    squadId: string,
    input: {
      title: string;
      game: string;
      startsAt: string;
      notes?: string;
      type?: SquadEvent["type"];
      createdBy: string;
    },
  ) {
    const event: SquadEvent = {
      id: uid("evt"),
      title: input.title.trim(),
      game: input.game,
      startsAt: input.startsAt,
      notes: input.notes?.trim(),
      type: input.type ?? "tournament",
      createdBy: input.createdBy,
      rsvps: { [input.createdBy]: "in" },
    };
    updateSquad(squadId, (s) => ({ ...s, events: [...s.events, event] }));
  },

  removeEvent(squadId: string, eventId: string) {
    updateSquad(squadId, (s) => ({ ...s, events: s.events.filter((e) => e.id !== eventId) }));
  },

  rsvp(squadId: string, eventId: string, userId: string, status: RsvpStatus) {
    updateSquad(squadId, (s) => ({
      ...s,
      events: s.events.map((e) =>
        e.id === eventId ? { ...e, rsvps: { ...e.rsvps, [userId]: status } } : e,
      ),
    }));
  },
};
