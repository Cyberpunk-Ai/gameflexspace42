// @ts-nocheck
import { useState } from "react";
import { SocialLayout } from "@/components/social/social-nav";
import { Link, useParams, useNavigate } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { squadStore } from "@/features/squads/store";
import {
  useCurrentPlayer,
  useSquad,
  useMemberStats,
  useMyJoinRequests,
} from "@/features/squads/hooks";
import { InvitePlayerDialog, SquadCrest, StatPill, gameLabel, useNextEvent } from "@/components/squads/squad-ui";
import { SquadChat } from "@/components/squads/squad-chat";
import { SquadRoster } from "@/components/squads/squad-roster";
import { SquadPlanner } from "@/components/squads/squad-planner";
import {
  ArrowLeft,
  CalendarClock,
  Loader2,
  Lock,
  LogOut,
  MessageSquare,
  Trash2,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function SquadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const me = useCurrentPlayer();
  const { data: squad, isLoading } = useSquad(id);
  const requested = useMyJoinRequests();
  const [sending, setSending] = useState(false);
  const next = useNextEvent(squad?.events);
  const { data: stats = {} } = useMemberStats(squad?.members.map((m: any) => m.userId) ?? []);

  if (isLoading) {
    return (
      <SocialLayout title="Squad" subtitle="Loading squad room…">
        <div className="rounded-2xl border border-border/50 bg-card p-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </SocialLayout>
    );
  }

  if (!squad) {
    return (
      <SocialLayout title="Squad" subtitle="This squad could not be found">
        <div className="rounded-2xl border border-border/50 bg-card p-8 text-center">
          <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-display font-bold">Squad not found</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            It may have been disbanded, or it is a private squad you're not part of.
          </p>
          <Button asChild variant="outline">
            <Link to="/teams">Back to squads</Link>
          </Button>
        </div>
      </SocialLayout>
    );
  }

  const isMember = squad.isMember;
  const isOwner = me?.userId === squad.ownerId;
  const myRole = squad.members.find((m: any) => m.userId === me?.userId)?.role;
  const isLeader = isOwner || myRole === "captain" || myRole === "co_captain";
  const ratings = squad.members.map((m: any) => stats[m.userId]?.rating ?? 0);
  const avgRating = ratings.length ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;
  const bestRank = Math.min(
    ...squad.members.map((m: any) => stats[m.userId]?.rank ?? Number.POSITIVE_INFINITY),
  );
  const pending = !!requested[squad.id];
  const full = squad.members.length >= squad.maxMembers;

  const requestJoin = async () => {
    if (!me) return toast.error("Sign in to request a spot");
    setSending(true);
    const { error } = await squadStore.requestJoin(squad.id, me.userId);
    setSending(false);
    if (error) return toast.error(error);
    toast.success("Request sent. A captain will review it.");
  };

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
              {isLeader && <InvitePlayerDialog squadId={squad.id} squadName={squad.name} />}
              {isOwner ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-muted-foreground hover:text-destructive"
                  onClick={async () => {
                    await squadStore.remove(squad.id);
                    toast.success("Squad disbanded");
                    navigate("/teams");
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Disband
                </Button>
              ) : isMember ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={async () => {
                    await squadStore.removeMember(squad.id, me.userId);
                    toast.info("You left the squad");
                    navigate("/teams");
                  }}
                >
                  <LogOut className="h-3.5 w-3.5" /> Leave
                </Button>
              ) : (
                squad.isPublic && (
                  <Button size="sm" className="gap-1.5" disabled={pending || sending || full} onClick={requestJoin}>
                    <UserPlus className="h-3.5 w-3.5" />
                    {full ? "Squad full" : pending ? "Request pending" : "Request to join"}
                  </Button>
                )
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <StatPill label="Members" value={`${squad.members.length}/${squad.maxMembers}`} accent />
            <StatPill label="Avg rating" value={avgRating || "—"} />
            <StatPill label="Best global rank" value={Number.isFinite(bestRank) ? `#${bestRank}` : "—"} />
            <StatPill label="Sessions" value={isMember ? squad.events.length : "—"} />
          </div>

          {isMember && next && (
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

        {isMember ? (
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
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
            <Lock className="h-10 w-10 text-primary mx-auto mb-3" />
            <p className="font-display font-bold">Members only</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              The squad room, roster management and session planning are private to squad members.
              {squad.isPublic ? " Request to join and a captain will review it." : " You need an invite from a captain."}
            </p>
          </div>
        )}
      </div>
    </SocialLayout>
  );
}
