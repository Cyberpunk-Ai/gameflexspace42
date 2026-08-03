// @ts-nocheck
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { squadStore } from "@/features/squads/store";
import { useCurrentPlayer, useMemberStats } from "@/features/squads/hooks";
import { initials, RoleBadge } from "./squad-ui";
import { Link } from "@/lib/router-compat";
import { Loader2, Trophy, UserMinus } from "lucide-react";
import { toast } from "sonner";

export function SquadRoster({ squad }: { squad: any }) {
  const me = useCurrentPlayer();
  const isOwner = me?.userId === squad.ownerId;
  const ids = squad.members.map((m: any) => m.userId);
  const { data: stats = {}, isLoading } = useMemberStats(ids);

  const ranked = [...squad.members].sort((a: any, b: any) => {
    const ra = stats[a.userId]?.rating ?? -1;
    const rb = stats[b.userId]?.rating ?? -1;
    return rb - ra;
  });

  return (
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
                  <Select
                    value={m.role}
                    onValueChange={(v) => squadStore.setRole(squad.id, m.userId, v)}
                  >
                    <SelectTrigger className="h-8 w-[104px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="captain">Captain</SelectItem>
                      <SelectItem value="player">Player</SelectItem>
                      <SelectItem value="sub">Sub</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${m.username}`}
                    onClick={() => {
                      squadStore.removeMember(squad.id, m.userId);
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

      {squad.invites.filter((i: any) => i.status === "pending").length > 0 && (
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
                  {i.toUsername} · {i.role}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
