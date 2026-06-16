import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, Shield } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ title: "Iniciar sesión — GrupMar Time" }] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message === "Invalid login credentials"
        ? "Credenciales incorrectas. Verifique su email y contraseña."
        : error.message);
      return;
    }
    nav({ to: "/" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4">
            <Clock className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">GrupMar Time</h1>
          <p className="text-sm text-muted-foreground mt-1">Control de marcaciones empresarial</p>
        </div>
        <Card className="p-6 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Correo</Label>
              <Input id="email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="usted@empresa.com" autoFocus />
            </div>
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>
          <div className="mt-6 text-xs text-muted-foreground flex items-start gap-2 border-t pt-4">
            <Shield className="w-4 h-4 mt-0.5 shrink-0" />
            <p>Su IP, navegador y dispositivo quedarán registrados con cada marcación, conforme a la política interna de la empresa.</p>
          </div>
        </Card>
        <details className="mt-6 text-xs text-muted-foreground">
          <summary className="cursor-pointer">Cuentas de prueba</summary>
          <ul className="mt-2 space-y-1 font-mono">
            <li>admin@grupmar.test / Admin123!Demo</li>
            <li>ana@grupmar.test / Demo123!User</li>
            <li>bruno@grupmar.test / Demo123!User</li>
            <li>carla@grupmar.test / Demo123!User</li>
            <li>diego@grupmar.test / Demo123!User</li>
            <li>elena@grupmar.test / Demo123!User</li>
          </ul>
        </details>
      </div>
    </div>
  );
}
