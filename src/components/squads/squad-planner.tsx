// @ts-nocheck
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { squadStore } from "@/features/squads/store";
import { useCurrentPlayer } from "@/features/squads/hooks";
import { GAME_TYPES } from "@/constants/game-types";
import { gameLabel } from "./squad-ui";
import { CalendarPlus, CalendarClock, Check, HelpCircle, Trash2, X } from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { toast } from "sonner";

const TYPES = [
  { id: "tournament", label: "Tournament" },
  { id: "scrim", label: "Scrim" },
  { id: "practice", label: "Practice" },
];

export function SquadPlanner({ squad }: { squad: any }) {
  const me = useCurrentPlayer();
  const [title, setTitle] = useState("");
  const [game, setGame] = useState(squad.game ?? GAME_TYPES[0].id);
  const [type, setType] = useState("tournament");
  const [startsAt, setStartsAt] = useState("");
  const [notes, setNotes] = useState("");

  const events = [...squad.events].sort((a: any, b: any) => +new Date(a.startsAt) - +new Date(b.startsAt));

  const create = () => {
    if (!me) return toast.error("Sign in to plan sessions");
    if (title.trim().length < 3) return toast.error("Give the session a title");
    if (!startsAt) return toast.error("Pick a date and time");
    squadStore.addEvent(squad.id, {
      title,
      game,
      type,
      startsAt: new Date(startsAt).toISOString(),
      notes,
      createdBy: me.userId,
    });
    toast.success("Session added to the squad calendar");
    setTitle("");
    setNotes("");
    setStartsAt("");
  };

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
      <div className="space-y-3">
        {events.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
            <CalendarClock className="h-10 w-10 text-primary mx-auto mb-3" />
            <p className="font-display font-bold">No sessions planned yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Schedule your next tournament, scrim or practice block and collect RSVPs.
            </p>
          </div>
        )}
        {events.map((e: any) => {
          const counts = { in: 0, out: 0, maybe: 0 };
          Object.values(e.rsvps ?? {}).forEach((v: any) => (counts[v] = (counts[v] ?? 0) + 1));
          const mine = me ? e.rsvps?.[me.userId] : undefined;
          const past = isPast(new Date(e.startsAt));
          return (
            <div
              key={e.id}
              className={cn(
                "rounded-2xl border border-border/50 bg-card p-4",
                past && "opacity-60",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 border border-primary/25 px-3 py-2 text-center shrink-0">
                  <div className="font-display text-lg font-bold leading-none text-primary">
                    {format(new Date(e.startsAt), "dd")}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                    {format(new Date(e.startsAt), "MMM")}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-sm">{e.title}</h4>
                    <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {e.type}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {gameLabel(e.game)} · {format(new Date(e.startsAt), "EEE d MMM, HH:mm")} ·{" "}
                    {past ? "completed" : formatDistanceToNow(new Date(e.startsAt), { addSuffix: true })}
                  </p>
                  {e.notes && <p className="text-xs text-foreground/70 mt-2">{e.notes}</p>}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {[
                      { id: "in", label: "I'm in", icon: Check },
                      { id: "maybe", label: "Maybe", icon: HelpCircle },
                      { id: "out", label: "Can't", icon: X },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={!me || past}
                        onClick={() => squadStore.rsvp(squad.id, e.id, me.userId, opt.id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50",
                          mine === opt.id
                            ? "border-primary/50 bg-primary/15 text-primary"
                            : "border-border/50 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <opt.icon className="h-3 w-3" />
                        {opt.label}
                      </button>
                    ))}
                    <span className="text-[11px] text-muted-foreground ml-1">
                      {counts.in} in · {counts.maybe} maybe · {counts.out} out
                    </span>
                    {me?.userId === squad.ownerId && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Delete session"
                        className="h-7 w-7 ml-auto text-muted-foreground hover:text-destructive"
                        onClick={() => squadStore.removeEvent(squad.id, e.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3 lg:sticky lg:top-24">
        <h3 className="font-display text-sm font-bold uppercase tracking-wider flex items-center gap-2">
          <CalendarPlus className="h-4 w-4 text-primary" /> Plan a session
        </h3>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Friday cash cup" maxLength={60} />
        <div className="grid grid-cols-2 gap-2">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={game} onValueChange={setGame}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GAME_TYPES.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Lobby code, roles, warm-up plan…"
          rows={3}
          maxLength={280}
        />
        <Button className="w-full" onClick={create}>
          Add to calendar
        </Button>
      </div>
    </div>
  );
}
