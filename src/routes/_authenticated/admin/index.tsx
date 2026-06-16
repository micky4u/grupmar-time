import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Users, Clock, AlertTriangle, ShieldAlert, FileText, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Dashboard — GrupMar Time" }] }),
  component: Dashboard,
});

type Stats = {
  active_employees: number; today_events: number; on_time: number; late: number;
  open_alerts: number; security_alerts: number; pending_letters: number; outside_today: number;
};

function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [emp, todayEv, summary, alerts, secAlerts, letters, outside] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("attendance_events").select("id", { count: "exact", head: true }).eq("event_date", today),
        supabase.from("daily_attendance_summary").select("status, has_tardiness").eq("attendance_date", today),
        supabase.from("alerts").select("id", { count: "exact", head: true }).eq("status", "pending").not("alert_type", "in", "(outside_company_clocking,unknown_ip_clocking)"),
        supabase.from("alerts").select("id", { count: "exact", head: true }).eq("status", "pending").in("alert_type", ["outside_company_clocking", "unknown_ip_clocking"]),
        supabase.from("disciplinary_letters").select("id", { count: "exact", head: true }).eq("status", "draft"),
        supabase.from("attendance_events").select("id", { count: "exact", head: true }).eq("event_date", today).neq("connection_location_status", "company_network"),
      ]);
      const sumArr = (summary.data ?? []) as Array<{ status: string; has_tardiness: boolean }>;
      setS({
        active_employees: emp.count ?? 0,
        today_events: todayEv.count ?? 0,
        on_time: sumArr.filter(r => r.status === "on_time").length,
        late: sumArr.filter(r => r.has_tardiness).length,
        open_alerts: alerts.count ?? 0,
        security_alerts: secAlerts.count ?? 0,
        pending_letters: letters.count ?? 0,
        outside_today: outside.count ?? 0,
      });
    })();
  }, []);

  const cards = [
    { label: "Trabajadores activos", value: s?.active_employees, icon: Users, color: "text-primary" },
    { label: "Marcaciones hoy", value: s?.today_events, icon: Clock, color: "text-info" },
    { label: "A tiempo hoy", value: s?.on_time, icon: CheckCircle2, color: "text-success" },
    { label: "Tardanzas hoy", value: s?.late, icon: AlertTriangle, color: "text-destructive" },
    { label: "Alertas laborales", value: s?.open_alerts, icon: AlertTriangle, color: "text-warning" },
    { label: "Alertas de seguridad", value: s?.security_alerts, icon: ShieldAlert, color: "text-warning" },
    { label: "Cartas en borrador", value: s?.pending_letters, icon: FileText, color: "text-info" },
    { label: "Marcaciones fuera de oficina hoy", value: s?.outside_today, icon: ShieldAlert, color: "text-warning" },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
      <p className="text-sm text-muted-foreground mb-6">Resumen operativo de hoy.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <div className="flex items-center justify-between">
              <c.icon className={`w-5 h-5 ${c.color}`} />
              <span className="text-xs text-muted-foreground">{c.label}</span>
            </div>
            <div className="mt-3 text-3xl font-bold">{c.value ?? "—"}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
