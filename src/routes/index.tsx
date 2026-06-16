import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, callRegisterEntry, formatTime } from "@/lib/grupmar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Clock, LogOut, ShieldAlert, ShieldCheck, ShieldX,
  UtensilsCrossed, FileText, DoorOpen, DoorClosed, PauseCircle, PlayCircle, Loader2
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  head: () => ({ meta: [{ title: "Mi jornada — GrupMar Time" }] }),
  component: Home,
});

type EntryResult = {
  full_name?: string;
  event_time?: string;
  expected_time?: string;
  is_late?: boolean;
  late_minutes_total?: number;
  late_minutes_after_tolerance?: number;
  ip_address?: string;
  is_company_network?: boolean;
  connection_location_status?: "company_network" | "outside_company_network" | "unknown";
  security_flag?: boolean;
  message?: string;
  blocked?: boolean;
  error?: string;
};

type EventRow = {
  id: string; event_type: string; event_time: string;
  connection_location_status: string | null; ip_address: string | null;
};

const EVENT_LABEL: Record<string, string> = {
  ENTRY: "Entrada", LUNCH_START: "Inicio almuerzo", LUNCH_END: "Fin almuerzo",
  PERMISSION_START: "Salida por permiso", PERMISSION_END: "Retorno de permiso",
  EXTRA_EXIT_START: "Salida extraordinaria", EXTRA_EXIT_END: "Retorno salida extra",
  EXIT: "Salida final",
};

function Home() {
  const [userId, setUserId] = useState<string>();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);
  const { profile, role, loading: pLoading } = useProfile(userId);
  const [entry, setEntry] = useState<EntryResult | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Si admin, mostrar acceso a panel; igual ejecutamos registro de entrada (admin también marca).
  useEffect(() => {
    if (!profile) return;
    (async () => {
      try {
        const result = (await callRegisterEntry()) as EntryResult;
        setEntry(result);
        if (result.blocked) toast.error(result.message ?? "Marcación bloqueada");
      } catch (e) {
        toast.error("No se pudo registrar la entrada: " + (e as Error).message);
      } finally {
        setLoaded(true);
        await reloadEvents();
      }
    })();
  }, [profile?.id]); // eslint-disable-line

  async function reloadEvents() {
    if (!userId) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase.from("attendance_events")
      .select("id, event_type, event_time, connection_location_status, ip_address")
      .eq("employee_id", userId).eq("event_date", today).order("event_time", { ascending: true });
    setEvents((data ?? []) as EventRow[]);
  }

  async function trigger(event_type: string) {
    setBusy(event_type);
    try {
      const { data, error } = await supabase.functions.invoke("register-attendance-event-secure", {
        body: { event_type },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error("No se pudo registrar: " + data.error);
      } else if (data?.blocked) {
        toast.error(data.message ?? "Marcación bloqueada");
      } else {
        toast.success(EVENT_LABEL[event_type] + " registrado");
      }
      await reloadEvents();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  if (pLoading || !loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const has = (t: string) => events.some((e) => e.event_type === t);
  const openLunch = has("LUNCH_START") && !events.some(e => e.event_type === "LUNCH_END" && e.event_time > (events.find(x => x.event_type === "LUNCH_START")!.event_time));
  const openPerm = events.filter(e => e.event_type === "PERMISSION_START").length > events.filter(e => e.event_type === "PERMISSION_END").length;
  const openExtra = events.filter(e => e.event_type === "EXTRA_EXIT_START").length > events.filter(e => e.event_type === "EXTRA_EXIT_END").length;
  const exited = has("EXIT");
  const blockExit = openLunch || openPerm || openExtra || exited;

  const loc = entry?.connection_location_status;
  const locBadge = loc === "company_network"
    ? { variant: "default" as const, cls: "bg-success text-success-foreground", icon: ShieldCheck, label: "Conectado desde la red de la empresa" }
    : loc === "outside_company_network"
    ? { variant: "default" as const, cls: "bg-warning text-warning-foreground", icon: ShieldAlert, label: "Marcación fuera de la oficina — pendiente de revisión" }
    : { variant: "secondary" as const, cls: "bg-muted text-muted-foreground", icon: ShieldX, label: "No se pudo detectar la red — pendiente de revisión" };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <span className="font-semibold">GrupMar Time</span>
          </div>
          <div className="flex items-center gap-2">
            {role === "admin" && (
              <Button asChild variant="outline" size="sm">
                <a href="/admin">Panel administrador</a>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-1" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{greeting}, {profile?.full_name?.split(" ")[0]}</h1>
          <p className="text-muted-foreground">{new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>

        {entry?.blocked ? (
          <Alert variant="destructive">
            <ShieldX className="w-4 h-4" />
            <AlertTitle>Marcación bloqueada</AlertTitle>
            <AlertDescription>{entry.message}</AlertDescription>
          </Alert>
        ) : (
          <>
            <Card className={`p-6 border-l-4 ${entry?.is_late ? "border-l-destructive" : "border-l-success"}`}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Hora de entrada registrada</div>
                  <div className="text-4xl font-bold tracking-tight">{formatTime(entry?.event_time)}</div>
                  {entry?.expected_time && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Turno inicia a las {entry.expected_time.slice(0, 5)}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  {entry?.is_late ? (
                    <Badge className="bg-destructive text-destructive-foreground text-sm py-1 px-3">Tardanza</Badge>
                  ) : (
                    <Badge className="bg-success text-success-foreground text-sm py-1 px-3">A tiempo</Badge>
                  )}
                </div>
              </div>
              {entry?.is_late && (
                <div className="mt-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm">
                  <div className="font-semibold text-destructive">Usted ha llegado tarde.</div>
                  <div className="text-muted-foreground">
                    Tardanza total: {entry.late_minutes_total} min · Fuera de tolerancia: {entry.late_minutes_after_tolerance} min.
                  </div>
                  <div className="mt-2 text-xs">Evite llegar tarde continuamente. La acumulación de tardanzas puede generar medidas laborales internas.</div>
                </div>
              )}
            </Card>

            <Card className={`p-4 flex items-center gap-3 ${locBadge.cls}`}>
              <locBadge.icon className="w-5 h-5" />
              <div className="flex-1">
                <div className="font-medium">{locBadge.label}</div>
                <div className="text-xs opacity-80">IP detectada: {entry?.ip_address || "no detectada"}</div>
              </div>
            </Card>
          </>
        )}

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Marcaciones del día</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <ActionButton label="Iniciar almuerzo" icon={UtensilsCrossed} onClick={() => trigger("LUNCH_START")}
              disabled={!has("ENTRY") || openLunch || exited || busy !== null} busy={busy === "LUNCH_START"} />
            <ActionButton label="Fin de almuerzo" icon={PauseCircle} onClick={() => trigger("LUNCH_END")}
              disabled={!openLunch || busy !== null} busy={busy === "LUNCH_END"} />
            <ActionButton label="Salida por permiso" icon={FileText} onClick={() => trigger("PERMISSION_START")}
              disabled={!has("ENTRY") || openPerm || exited || busy !== null} busy={busy === "PERMISSION_START"} />
            <ActionButton label="Retorno de permiso" icon={PlayCircle} onClick={() => trigger("PERMISSION_END")}
              disabled={!openPerm || busy !== null} busy={busy === "PERMISSION_END"} />
            <ActionButton label="Salida extraordinaria" icon={DoorOpen} onClick={() => trigger("EXTRA_EXIT_START")}
              disabled={!has("ENTRY") || openExtra || exited || busy !== null} busy={busy === "EXTRA_EXIT_START"} />
            <ActionButton label="Retorno salida extra" icon={PlayCircle} onClick={() => trigger("EXTRA_EXIT_END")}
              disabled={!openExtra || busy !== null} busy={busy === "EXTRA_EXIT_END"} />
            <ActionButton label="Salida final" icon={DoorClosed} variant="destructive"
              onClick={() => trigger("EXIT")} disabled={!has("ENTRY") || blockExit || busy !== null} busy={busy === "EXIT"} />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Eventos registrados hoy</h2>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin marcaciones aún.</p>
          ) : (
            <ul className="space-y-2">
              {events.map((e) => (
                <li key={e.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                  <span className="font-medium">{EVENT_LABEL[e.event_type] ?? e.event_type}</span>
                  <span className="text-muted-foreground">{formatTime(e.event_time)} · {e.ip_address ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}

function ActionButton({ label, icon: Icon, onClick, disabled, busy, variant = "secondary" as const }: {
  label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void;
  disabled?: boolean; busy?: boolean; variant?: "secondary" | "destructive";
}) {
  return (
    <Button variant={variant} size="lg" disabled={disabled} onClick={onClick}
      className="h-auto py-4 flex-col gap-2 whitespace-normal">
      {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
      <span className="text-sm">{label}</span>
    </Button>
  );
}
