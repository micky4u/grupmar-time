import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/letters")({
  head: () => ({ meta: [{ title: "Cartas — GrupMar Time" }] }),
  component: LettersPage,
});

type Letter = {
  id: string; letter_type: string; month: number; year: number; threshold: number | null;
  tardiness_count: number; content: string; status: string; generated_at: string;
  profiles?: { full_name: string } | null;
};

function LettersPage() {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [open, setOpen] = useState<Letter | null>(null);
  const [content, setContent] = useState("");
  async function load() {
    const { data } = await supabase.from("disciplinary_letters")
      .select("*, profiles(full_name)").order("generated_at", { ascending: false });
    setLetters((data ?? []) as Letter[]);
  }
  useEffect(() => { load(); }, []);
  async function save() {
    if (!open) return;
    await supabase.from("disciplinary_letters").update({ content }).eq("id", open.id);
    toast.success("Carta actualizada");
    setOpen(null);
    load();
  }
  async function approve(id: string) {
    await supabase.from("disciplinary_letters").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", id);
    toast.success("Carta aprobada"); load();
  }
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-1">Cartas disciplinarias</h1>
      <p className="text-sm text-muted-foreground mb-6">Generadas automáticamente como borrador. Revise antes de aprobar.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {letters.length === 0 && <p className="text-muted-foreground text-sm">Sin cartas.</p>}
        {letters.map(l => (
          <Card key={l.id} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">{l.profiles?.full_name ?? "—"}</div>
              <Badge variant={l.status === "draft" ? "default" : "secondary"}>{l.status}</Badge>
            </div>
            <div className="text-xs text-muted-foreground mb-2">
              {l.letter_type} · {l.month}/{l.year} · umbral {l.threshold} · {l.tardiness_count} tardanzas
            </div>
            <p className="text-sm line-clamp-3 mb-3 whitespace-pre-line">{l.content}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setOpen(l); setContent(l.content); }}>Editar</Button>
              {l.status === "draft" && <Button size="sm" onClick={() => approve(l.id)}>Aprobar</Button>}
            </div>
          </Card>
        ))}
      </div>
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Editar carta</DialogTitle></DialogHeader>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={18} className="font-mono text-xs" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(null)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
