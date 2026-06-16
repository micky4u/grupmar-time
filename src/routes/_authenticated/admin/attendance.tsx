import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { formatTime } from "@/lib/grupmar";

export const Route = createFileRoute("/_authenticated/admin/attendance")({
  head: () => ({ meta: [{ title: "Marcaciones — GrupMar Time" }] }),
  component: AttendancePage,
});

type Row = {
  employee_id: string; full_name: string; department: string | null; work_center: string | null;
  shift: string | null; attendance_date: string; expected_entry_time: string | null;
  actual_entry_time: string | null; status: string | null; has_tardiness: boolean;
  late_minutes_total: number; late_minutes_after_tolerance: number; ip_address: string | null;
  connection_location_status: string | null; security_flag: boolean; is_absent: boolean;
};

function NetBadge({ status }: { status: string | null }) {
  if (status === "company_network") return <Badge className="bg-success text-success-foreground gap-1"><ShieldCheck className="w-3 h-3" />Empresa</Badge>;
  if (status === "outside_company_network") return <Badge className="bg-warning text-warning-foreground gap-1"><ShieldAlert className="w-3 h-3" />Fuera</Badge>;
  if (status === "unknown") return <Badge variant="secondary" className="gap-1"><ShieldX className="w-3 h-3" />Desconocida</Badge>;
  return <Badge variant="outline">—</Badge>;
}

function AttendancePage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("v_daily_attendance_admin").select("*").eq("attendance_date", date).order("full_name");
      setRows((data ?? []) as Row[]);
    })();
  }, [date]);
  return (
    <div className="p-8">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Marcaciones</h1>
          <p className="text-sm text-muted-foreground">Resumen diario por trabajador.</p>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Fecha</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-48" />
        </div>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trabajador</TableHead>
              <TableHead>Depto</TableHead>
              <TableHead>Centro</TableHead>
              <TableHead>Turno</TableHead>
              <TableHead>Esperada</TableHead>
              <TableHead>Real</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Tarde (min)</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Red</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Sin datos para esta fecha.</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.employee_id}>
                <TableCell className="font-medium">{r.full_name}</TableCell>
                <TableCell>{r.department ?? "—"}</TableCell>
                <TableCell>{r.work_center ?? "—"}</TableCell>
                <TableCell>{r.shift ?? "—"}</TableCell>
                <TableCell>{r.expected_entry_time?.slice(0, 5) ?? "—"}</TableCell>
                <TableCell>{formatTime(r.actual_entry_time)}</TableCell>
                <TableCell>
                  {r.is_absent ? <Badge variant="secondary">Ausente</Badge> :
                   r.has_tardiness ? <Badge className="bg-destructive text-destructive-foreground">Tardanza</Badge> :
                   r.actual_entry_time ? <Badge className="bg-success text-success-foreground">A tiempo</Badge> :
                   <Badge variant="outline">Pendiente</Badge>}
                </TableCell>
                <TableCell>{r.late_minutes_after_tolerance > 0 ? `${r.late_minutes_after_tolerance}` : "—"}</TableCell>
                <TableCell className="font-mono text-xs">{r.ip_address ?? "—"}</TableCell>
                <TableCell><NetBadge status={r.connection_location_status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
