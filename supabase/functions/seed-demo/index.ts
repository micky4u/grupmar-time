// Edge Function: seed-demo
// Crea usuarios demo + estructura organizativa + marcaciones de prueba.
// Solo se ejecuta si no existen ya las cuentas. Idempotente.
//
// Usuarios creados:
//   admin@grupmar.test  / Admin123!Demo   (rol admin)
//   ana@grupmar.test    / Demo123!User    (sin tardanzas)
//   bruno@grupmar.test  / Demo123!User    (3 tardanzas)
//   carla@grupmar.test  / Demo123!User    (5 tardanzas -> alerta nivel 1 + carta)
//   diego@grupmar.test  / Demo123!User    (10 tardanzas -> 2 cartas)
//   elena@grupmar.test  / Demo123!User    (15 tardanzas -> alerta crítica + preaviso)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const COMPANY_IP = "80.24.218.227";
const OUTSIDE_IP = "200.10.10.10";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Seed = {
  email: string; password: string; full_name: string; code: string; doc: string;
  role: "admin" | "user"; tardiness: number;
};

const PEOPLE: Seed[] = [
  { email: "admin@grupmar.test", password: "Admin123!Demo", full_name: "Administrador GrupMar", code: "ADM-001", doc: "00000001", role: "admin", tardiness: 0 },
  { email: "ana@grupmar.test",   password: "Demo123!User", full_name: "Ana Pérez",        code: "EMP-001", doc: "11111111", role: "user", tardiness: 0 },
  { email: "bruno@grupmar.test", password: "Demo123!User", full_name: "Bruno López",      code: "EMP-002", doc: "22222222", role: "user", tardiness: 3 },
  { email: "carla@grupmar.test", password: "Demo123!User", full_name: "Carla Ruiz",       code: "EMP-003", doc: "33333333", role: "user", tardiness: 5 },
  { email: "diego@grupmar.test", password: "Demo123!User", full_name: "Diego Castro",     code: "EMP-004", doc: "44444444", role: "user", tardiness: 10 },
  { email: "elena@grupmar.test", password: "Demo123!User", full_name: "Elena Vargas",     code: "EMP-005", doc: "55555555", role: "user", tardiness: 15 },
];

async function ensureUser(p: Seed): Promise<string> {
  // Buscar por email
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list.users.find((u) => u.email?.toLowerCase() === p.email.toLowerCase());
  if (existing) return existing.id;
  const { data, error } = await admin.auth.admin.createUser({
    email: p.email, password: p.password, email_confirm: true,
    user_metadata: { full_name: p.full_name },
  });
  if (error) throw error;
  return data.user!.id;
}

async function ensureRow<T extends Record<string, unknown>>(
  table: string, match: Record<string, unknown>, insert: T,
): Promise<any> {
  const q = admin.from(table).select("*");
  for (const [k, v] of Object.entries(match)) q.eq(k, v as never);
  const { data: found } = await q.maybeSingle();
  if (found) return found;
  const { data, error } = await admin.from(table).insert(insert).select("*").single();
  if (error) throw error;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Departamentos / Centros
    const deptOps = await ensureRow("departments", { name: "Operaciones" }, { name: "Operaciones" });
    const deptAdm = await ensureRow("departments", { name: "Administración" }, { name: "Administración" });
    const wcCentral = await ensureRow("work_centers", { name: "Oficina Central" }, { name: "Oficina Central", address: "Av. Principal 123" });
    const wcSucursal = await ensureRow("work_centers", { name: "Sucursal Norte" }, { name: "Sucursal Norte", address: "Calle Norte 45" });

    // Turnos
    const shMorning = await ensureRow("shifts", { name: "Turno Mañana" }, { name: "Turno Mañana", start_time: "08:00", end_time: "16:00", lunch_minutes: 60, tolerance_minutes: 10 });
    const shOffice  = await ensureRow("shifts", { name: "Turno Oficina" }, { name: "Turno Oficina", start_time: "09:00", end_time: "18:00", lunch_minutes: 60, tolerance_minutes: 10 });
    const shAfter   = await ensureRow("shifts", { name: "Turno Tarde" }, { name: "Turno Tarde", start_time: "14:00", end_time: "22:00", lunch_minutes: 60, tolerance_minutes: 10 });
    const shifts = [shMorning, shOffice, shAfter];

    const today = new Date();
    const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

    const results: any[] = [];
    for (let i = 0; i < PEOPLE.length; i++) {
      const p = PEOPLE[i];
      const userId = await ensureUser(p);
      // role
      await admin.from("user_roles").upsert({ user_id: userId, role: p.role }, { onConflict: "user_id,role" });
      // profile
      await admin.from("profiles").upsert({
        id: userId, full_name: p.full_name, email: p.email,
        employee_code: p.code, document_number: p.doc,
        department_id: (i % 2 === 0 ? deptOps.id : deptAdm.id),
        work_center_id: (i % 2 === 0 ? wcCentral.id : wcSucursal.id),
        active: true,
      }, { onConflict: "id" });

      if (p.role === "admin") {
        results.push({ user: p.email, role: "admin" });
        continue;
      }

      // shift assignment (rotando)
      const shift = shifts[i % shifts.length];
      const startDate = fmtDate(new Date(today.getFullYear(), today.getMonth(), 1));
      const { data: existAssign } = await admin.from("employee_shift_assignments")
        .select("id").eq("employee_id", userId).eq("active", true).maybeSingle();
      if (!existAssign) {
        await admin.from("employee_shift_assignments").insert({
          employee_id: userId, shift_id: shift.id, start_date: startDate, active: true,
        });
      }

      // Marcaciones históricas: una entrada por día laboral del mes pasado y este mes.
      // Para los primeros `p.tardiness` días, marcar tarde (12+ min después del shift start).
      const events: any[] = [];
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const daysSoFar = today.getDate() - 1;
      let lateCount = 0;
      for (let d = 0; d < daysSoFar; d++) {
        const day = new Date(monthStart);
        day.setDate(monthStart.getDate() + d);
        if (day.getDay() === 0 || day.getDay() === 6) continue; // skip weekend
        const [sh, sm] = shift.start_time.split(":").map(Number);
        const eventDate = fmtDate(day);
        let entry = new Date(day);
        const isLate = lateCount < p.tardiness;
        if (isLate) {
          entry.setHours(sh, sm + 20, 0, 0); // 20 min tarde -> 10 sancionables
          lateCount++;
        } else {
          entry.setHours(sh, sm - 3, 0, 0);  // a tiempo
        }
        const ip = (d % 7 === 0) ? OUTSIDE_IP : COMPANY_IP;
        const status = (d % 7 === 0) ? "outside_company_network" : "company_network";
        events.push({
          employee_id: userId, event_type: "ENTRY", event_time: entry.toISOString(),
          event_date: eventDate, source: "seed", ip_address: ip,
          user_agent: "Seed/1.0", browser_info: "Chrome", device_info: "Mac",
          connection_location_status: status, is_company_network: ip === COMPANY_IP,
          security_flag: ip !== COMPANY_IP, created_by: userId,
        });
      }
      if (events.length) {
        // Saltarse si ya hay marcaciones para evitar duplicar
        const { count } = await admin.from("attendance_events").select("id", { count: "exact", head: true }).eq("employee_id", userId);
        if (!count || count === 0) {
          // insertar en lotes
          for (let i2 = 0; i2 < events.length; i2 += 50) {
            const chunk = events.slice(i2, i2 + 50);
            const { error } = await admin.from("attendance_events").insert(chunk);
            if (error) throw error;
          }
        }
      }
      results.push({ user: p.email, role: "user", tardiness_target: p.tardiness, events_inserted: events.length });
    }

    return new Response(JSON.stringify({ ok: true, results }, null, 2), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
