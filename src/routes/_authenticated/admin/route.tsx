import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Clock, Home, Users, Calendar, Bell, Shield, FileText, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setIsAdmin(false); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data);
    })();
  }, []);
  if (isAdmin === null) return <div className="p-8 text-muted-foreground">Cargando…</div>;
  if (!isAdmin) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Shield className="w-12 h-12 mx-auto text-destructive mb-2" />
        <p className="font-semibold">Acceso restringido</p>
        <p className="text-sm text-muted-foreground mb-4">Esta sección es solo para administradores.</p>
        <Button asChild><Link to="/">Volver</Link></Button>
      </div>
    </div>
  );

  const links = [
    { to: "/admin", label: "Dashboard", icon: Home },
    { to: "/admin/attendance", label: "Marcaciones", icon: Calendar },
    { to: "/admin/alerts", label: "Alertas", icon: Bell },
    { to: "/admin/security", label: "Seguridad", icon: Shield },
    { to: "/admin/letters", label: "Cartas", icon: FileText },
    { to: "/admin/employees", label: "Trabajadores", icon: Users },
  ];

  async function signOut() { await supabase.auth.signOut(); window.location.href = "/auth"; }

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="px-5 py-4 border-b border-sidebar-border flex items-center gap-2">
          <Clock className="w-5 h-5 text-sidebar-primary" />
          <span className="font-semibold">GrupMar Time</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {links.map((l) => (
            <Link key={l.to} to={l.to} activeOptions={{ exact: l.to === "/admin" }}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent transition"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}>
              <l.icon className="w-4 h-4" /> {l.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-1">
          <Link to="/" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent">
            <Home className="w-4 h-4" /> Mi jornada
          </Link>
          <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent">
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-background overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
