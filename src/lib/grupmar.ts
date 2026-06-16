import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  employee_code: string | null;
  document_number: string | null;
  active: boolean;
  department_id: string | null;
  work_center_id: string | null;
};

export type Role = "admin" | "user";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return { session, loading };
}

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setRole(null);
      setLoading(false);
      return;
    }
    let cancel = false;
    (async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      ]);
      if (!cancel) {
        setProfile(p as Profile | null);
        setRole((r?.role as Role) ?? "user");
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [userId]);
  return { profile, role, loading };
}

export async function callRegisterEntry() {
  const { data, error } = await supabase.functions.invoke("register-entry-secure", { body: {} });
  if (error) throw error;
  return data;
}

export async function callRegisterEvent(event_type: string, notes?: string) {
  const { data, error } = await supabase.functions.invoke("register-attendance-event-secure", {
    body: { event_type, notes },
  });
  if (error) throw error;
  return data;
}

export function formatTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("es-ES");
}
