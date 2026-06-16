import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/employees")({
  head: () => ({ meta: [{ title: "Trabajadores — GrupMar Time" }] }),
  component: EmployeesPage,
});

type Row = {
  id: string; full_name: string; email: string; employee_code: string | null;
  document_number: string | null; active: boolean;
  departments?: { name: string } | null; work_centers?: { name: string } | null;
};

function EmployeesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Record<string, { tard: number; alerts: number; letters: number }>>({});
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles")
        .select("id, full_name, email, employee_code, document_number, active, departments(name), work_centers(name)")
        .order("full_name");
      setRows((data ?? []) as Row[]);
      const ids = (data ?? []).map(r => r.id);
      if (ids.length) {
        const [t, a, l] = await Promise.all([
          supabase.from("v_employee_attendance_stats").select("employee_id, current_month_tardiness, total_outside_company_clockings").in("employee_id", ids),
          supabase.from("alerts").select("employee_id").in("employee_id", ids).eq("status", "pending"),
          supabase.from("disciplinary_letters").select("employee_id").in("employee_id", ids),
        ]);
        const map: typeof stats = {};
        (t.data ?? []).forEach((r: any) => { map[r.employee_id] = { tard: r.current_month_tardiness ?? 0, alerts: 0, letters: 0 }; });
        (a.data ?? []).forEach((r: any) => { map[r.employee_id] = { ...(map[r.employee_id] ?? { tard: 0, alerts: 0, letters: 0 }), alerts: (map[r.employee_id]?.alerts ?? 0) + 1 }; });
        (l.data ?? []).forEach((r: any) => { map[r.employee_id] = { ...(map[r.employee_id] ?? { tard: 0, alerts: 0, letters: 0 }), letters: (map[r.employee_id]?.letters ?? 0) + 1 }; });
        setStats(map);
      }
    })();
  }, []);
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-1">Trabajadores</h1>
      <p className="text-sm text-muted-foreground mb-6">{rows.length} registrados.</p>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Centro</TableHead>
              <TableHead>Tard. mes</TableHead>
              <TableHead>Alertas</TableHead>
              <TableHead>Cartas</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => {
              const st = stats[r.id] ?? { tard: 0, alerts: 0, letters: 0 };
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.full_name}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </TableCell>
                  <TableCell>{r.employee_code ?? "—"}</TableCell>
                  <TableCell>{r.document_number ?? "—"}</TableCell>
                  <TableCell>{r.departments?.name ?? "—"}</TableCell>
                  <TableCell>{r.work_centers?.name ?? "—"}</TableCell>
                  <TableCell>{st.tard > 0 ? <Badge className="bg-destructive text-destructive-foreground">{st.tard}</Badge> : st.tard}</TableCell>
                  <TableCell>{st.alerts > 0 ? <Badge className="bg-warning text-warning-foreground">{st.alerts}</Badge> : 0}</TableCell>
                  <TableCell>{st.letters > 0 ? <Badge variant="secondary">{st.letters}</Badge> : 0}</TableCell>
                  <TableCell><Badge variant={r.active ? "default" : "secondary"}>{r.active ? "Activo" : "Inactivo"}</Badge></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
