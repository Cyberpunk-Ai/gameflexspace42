// @ts-nocheck
import { useMemo, useState } from "react";
import { SocialLayout } from "@/components/social/social-nav";
import { Link } from "@/lib/router-compat";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { squadStore } from "@/features/squads/store";
import { useCurrentPlayer, useSquads } from "@/features/squads/hooks";
import { CreateSquadDialog, SquadCrest, StatPill, gameLabel, initials, useNextEvent } from "@/components/squads/squad-ui";
import { SquadInvitesPanel } from "@/components/squads/squad-invites";
import { CalendarClock, MessageSquare, Search, Shield, Users } from "lucide-react";
import { format } from "date-fns";

export default function Teams() {
  const me = useCurrentPlayer();
  const mySquads = useSquads();
  const [term, setTerm] = useState("");

  const discover = useMemo(() => {
    const all = squadStore.all();
    const mine = new Set(mySquads.map((s) => s.id));
    return all
      .filter((s) => !mine.has(s.id))
      .filter((s) =>
        term.trim()
          ? `${s.name} ${s.tag} ${gameLabel(s.game)}`.toLowerCase().includes(term.trim().toLowerCase())
          : true,
      );
  }, [mySquads, term]);

  const totalMates = mySquads.reduce((n, s) => n + s.members.length, 0);
  const totalEvents = mySquads.reduce((n, s) => n + s.events.length, 0);

  return (
    <SocialLayout title="Squads" subtitle="Squad up, plan tournaments and climb the ladder together">
      <div className="space-y-6">
        <SquadInvitesPanel />

        <section className="rounded-2xl border border-border/50 bg-gradient-to-br from-primary/[0.07] to-transparent p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                {me ? `Welcome back, ${me.username}` : "Build your squad"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-lg">
                Create a clan, invite players, chat in a private squad room, schedule tournaments and see
                every teammate's live leaderboard rank.
              </p>
            </div>
            <CreateSquadDialog />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-5 max-w-md">
            <StatPill label="Your squads" value={mySquads.length} accent />
            <StatPill label="Squadmates" value={totalMates} />
            <StatPill label="Planned sessions" value={totalEvents} />
          </div>
        </section>

        <section>
          <h3 className="font-display text-sm font-bold uppercase tracking-wider mb-3">My squads</h3>
          {mySquads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
              <Users className="h-10 w-10 text-primary mx-auto mb-3" />
              <p className="font-display font-bold">You're not in a squad yet</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Create one in seconds — invites, chat and planning are ready to go.
              </p>
              <CreateSquadDialog trigger={<Button variant="outline">Create your first squad</Button>} />
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {mySquads.map((squad) => (
                <SquadCard key={squad.id} squad={squad} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider">Discover squads</h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search squads or games…"
                className="pl-9"
              />
            </div>
          </div>
          {discover.length === 0 ? (
            <p className="rounded-2xl border border-border/50 bg-card p-6 text-sm text-muted-foreground text-center">
              No other squads to show yet. Invite friends and they'll appear here.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {discover.map((squad) => (
                <SquadCard key={squad.id} squad={squad} />
              ))}
            </div>
          )}
        </section>
      </div>
    </SocialLayout>
  );
}

function SquadCard({ squad }: { squad: any }) {
  const next = useNextEvent(squad.events);
  return (
    <Link
      to={`/teams/${squad.id}`}
      className="block rounded-2xl border border-border/50 bg-card p-4 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-start gap-3">
        <SquadCrest tag={squad.tag} color={squad.color} />
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold truncate">{squad.name}</p>
          <p className="text-xs text-muted-foreground">{gameLabel(squad.game)}</p>
          {squad.bio && <p className="text-xs text-foreground/70 mt-1.5 line-clamp-2">{squad.bio}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <div className="flex -space-x-2">
          {squad.members.slice(0, 5).map((m: any) => (
            <Avatar key={m.userId} className="h-7 w-7 border-2 border-card">
              <AvatarImage src={m.avatarUrl ?? undefined} loading="lazy" decoding="async" />
              <AvatarFallback className="text-[9px]">{initials(m.username)}</AvatarFallback>
            </Avatar>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{squad.members.length} members</span>
        <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            {squad.messages.length}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" />
            {squad.events.length}
          </span>
        </span>
      </div>
      {next && (
        <p className="mt-3 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-[11px] text-primary font-semibold">
          Next: {next.title} · {format(new Date(next.startsAt), "EEE d MMM HH:mm")}
        </p>
      )}
    </Link>
  );
}
