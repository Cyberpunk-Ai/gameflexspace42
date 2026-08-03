// @ts-nocheck
import { SocialLayout } from "@/components/social/social-nav";
import { Link, useParams, useNavigate } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { squadStore } from "@/features/squads/store";
import { useCurrentPlayer, useSquad, useMemberStats } from "@/features/squads/hooks";
import { InvitePlayerDialog, SquadCrest, StatPill, gameLabel, useNextEvent } from "@/components/squads/squad-ui";
import { SquadChat } from "@/components/squads/squad-chat";
import { SquadRoster } from "@/components/squads/squad-roster";
import { SquadPlanner } from "@/components/squads/squad-planner";
import { ArrowLeft, CalendarClock, LogOut, MessageSquare, Trash2, Trophy, Users } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function SquadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const me = useCurrentPlayer();
  const squad = useSquad(id);
  const next = useNextEvent(squad?.events);
  const { data: stats = {} } = useMemberStats(squad?.members.map((m: any) => m.userId) ?? []);

  if (!squad) {
    return (
      <SocialLayout title="Squad" subtitle="This squad could not be found">
        <div className="rounded-2xl border border-border/50 bg-card p-8 text-center">
          <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-display font-bold">Squad not found</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            It may have been disbanded, or it lives on another device.
          </p>
          <Button asChild variant="outline">
            <Link to="/teams">Back to squads</Link>
          </Button>
        </div>
      </SocialLayout>
    );
  }

  const isMember = me && squad.members.some((m: any) => m.userId === me.userId);
  const isOwner = me?.userId === squad.ownerId;
  const ratings = squad.members.map((m: any) => stats[m.userId]?.rating ?? 0);
  const avgRating = ratings.length ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;
  const bestRank = Math.min(
    ...squad.members.map((m: any) => stats[m.userId]?.rank ?? Number.POSITIVE_INFINITY),
  );

  return (
    <SocialLayout title={squad.name} subtitle={`${squad.tag} · ${gameLabel(squad.game)}`}>
      <div className="space-y-5">
        <Link
          to="/teams"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All squads
        </Link>

        <section className="rounded-2xl border border-border/50 bg-card p-5">
          <div className="flex flex-wrap items-start gap-4">
            <SquadCrest tag={squad.tag} color={squad.color} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl font-bold">{squad.name}</h1>
              <p className="text-sm text-muted-foreground">
                {gameLabel(squad.game)} · created {format(new Date(squad.createdAt), "d MMM yyyy")}
              </p>
              {squad.bio && <p className="text-sm text-foreground/75 mt-2 max-w-2xl">{squad.bio}</p>}
            </div>
            <div className="flex items-center gap-2">
              {isMember && <InvitePlayerDialog squadId={squad.id} squadName={squad.name} />}
              {isOwner ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    squadStore.remove(squad.id);
                    toast.success("Squad disbanded");
                    navigate("/teams");
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Disband
                </Button>
              ) : (
                isMember && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      squadStore.removeMember(squad.id, me.userId);
                      toast.info("You left the squad");
                      navigate("/teams");
                    }}
                  >
                    <LogOut className="h-3.5 w-3.5" /> Leave
                  </Button>
                )
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <StatPill label="Members" value={squad.members.length} accent />
            <StatPill label="Avg rating" value={avgRating || "—"} />
            <StatPill label="Best global rank" value={Number.isFinite(bestRank) ? `#${bestRank}` : "—"} />
            <StatPill label="Sessions" value={squad.events.length} />
          </div>

          {next && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.07] px-4 py-3">
              <Trophy className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{next.title}</span>
              <span className="text-xs text-muted-foreground">
                {gameLabel(next.game)} · {format(new Date(next.startsAt), "EEE d MMM, HH:mm")}
              </span>
              <span className="ml-auto text-xs text-primary font-semibold">
                {Object.values(next.rsvps ?? {}).filter((v) => v === "in").length} confirmed
              </span>
            </div>
          )}
        </section>

        <Tabs defaultValue="chat">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="chat" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Squad room
            </TabsTrigger>
            <TabsTrigger value="roster" className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> Roster & ranks
            </TabsTrigger>
            <TabsTrigger value="plan" className="gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" /> Planning
            </TabsTrigger>
          </TabsList>
          <TabsContent value="chat" className="mt-4">
            <SquadChat squad={squad} />
          </TabsContent>
          <TabsContent value="roster" className="mt-4">
            <SquadRoster squad={squad} />
          </TabsContent>
          <TabsContent value="plan" className="mt-4">
            <SquadPlanner squad={squad} />
          </TabsContent>
        </Tabs>
      </div>
    </SocialLayout>
  );
}
