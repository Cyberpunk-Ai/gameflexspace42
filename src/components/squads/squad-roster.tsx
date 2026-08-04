// @ts-nocheck
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { squadStore } from "@/features/squads/store";
import { useCurrentPlayer, useMemberStats } from "@/features/squads/hooks";
import { initials, RoleBadge } from "./squad-ui";
import { Link } from "@/lib/router-compat";
import { Check, Loader2, Trophy, UserMinus, X } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export function SquadRoster({ squad }: { squad: any }) {
  const me = useCurrentPlayer();
  const myRole = squad.members.find((m: any) => m.userId === me?.userId)?.role;
  const isOwner = me?.userId === squad.ownerId;
  const isLeader = isOwner || myRole === "captain" || myRole === "co_captain";
  const ids = squad.members.map((m: any) => m.userId);
  const { data: stats = {}, isLoading } = useMemberStats(ids);

  const ranked = [...squad.members].sort((a: any, b: any) => {
    const ra = stats[a.userId]?.rating ?? -1;
    const rb = stats[b.userId]?.rating ?? -1;
    return rb - ra;
  });

  const requests = squad.joinRequests ?? [];

  const respond = async (req: any, approve: boolean) => {
    const { error } = await squadStore.respondToJoinRequest(req.id, approve, me.userId);
    if (error) return toast.error(error);
    toast.success(approve ? `${req.username} joined the squad` : `Request from ${req.username} declined`);
  };

  return (
    <div className="space-y-4">
      {isLeader && requests.length > 0 && (
        <div className="rounded-2xl border border-primary/30 bg-primary/[0.04] overflow-hidden">
          <div className="px-4 py-3 border-b border-primary/20">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider">
              Join requests
              <span className="ml-2 rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[11px]">
                {requests.length}
              </span>
            </h3>
          </div>
          <ul className="divide-y divide-border/30">
            {requests.map((r: any) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={r.avatarUrl ?? undefined} loading="lazy" decoding="async" />
                  <AvatarFallback className="text-[10px]">{initials(r.username)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{r.username}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.message ? `“${r.message}” · ` : ""}
                    {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Button size="sm" className="gap-1.5" onClick={() => respond(r, true)}>
                    <Check className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => respond(r, false)}>
                    <X className="h-3.5 w-3.5" /> Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <h3 className="font-display text-sm font-bold uppercase tracking-wider">
            Roster · {squad.members.length}
          </h3>
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        <ul className="divide-y divide-border/30">
          {ranked.map((m: any, i: number) => {
            const s = stats[m.userId];
            const winRate = s && s.matchesPlayed ? Math.round((s.matchesWon / s.matchesPlayed) * 100) : null;
            return (
              <li key={m.userId} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={cn(
                    "w-6 text-center font-display text-sm font-bold",
                    i === 0 ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={m.avatarUrl ?? undefined} loading="lazy" decoding="async" />
                  <AvatarFallback>{initials(m.username)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/player/${m.userId}`}
                    className="text-sm font-semibold hover:text-primary transition-colors truncate block"
                  >
                    {m.username}
                    {me?.userId === m.userId && <span className="text-muted-foreground font-normal"> (you)</span>}
                  </Link>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                    <RoleBadge role={m.role} />
                    {s ? (
                      <>
                        <span className="inline-flex items-center gap-1 text-primary font-semibold">
                          <Trophy className="h-3 w-3" /> #{s.rank} global
                        </span>
                        <span>· {s.rating} rating</span>
                        {winRate !== null && <span>· {winRate}% WR</span>}
                      </>
                    ) : (
                      <span>No ranked matches yet</span>
                    )}
                  </div>
                </div>
                {isOwner && m.userId !== squad.ownerId && (
                  <div className="flex items-center gap-1.5">
                    <Select value={m.role} onValueChange={(v) => squadStore.setRole(squad.id, m.userId, v)}>
                      <SelectTrigger className="h-8 w-[118px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="co_captain">Co-captain</SelectItem>
                        <SelectItem value="player">Player</SelectItem>
                        <SelectItem value="sub">Sub</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${m.username}`}
                      onClick={async () => {
                        await squadStore.removeMember(squad.id, m.userId);
                        toast.success(`${m.username} removed from the squad`);
                      }}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {(squad.invites ?? []).filter((i: any) => i.status === "pending").length > 0 && (
          <div className="border-t border-border/40 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Pending invites</p>
            <div className="flex flex-wrap gap-2">
              {squad.invites
                .filter((i: any) => i.status === "pending")
                .map((i: any) => (
                  <span
                    key={i.id}
                    className="rounded-full border border-border/50 bg-secondary/40 px-3 py-1 text-xs text-muted-foreground"
                  >
                    {i.toUsername}
                    {isLeader && (
                      <button
                        type="button"
                        className="ml-2 hover:text-destructive"
                        onClick={() => squadStore.cancelInvite(i.id)}
                      >
                        cancel
                      </button>
                    )}
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
