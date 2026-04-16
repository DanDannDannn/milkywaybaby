import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useBaby } from "@/lib/baby-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Copy, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Little Logs" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { activeBaby, loading, refresh } = useBaby();
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (activeBaby) {
      setName(activeBaby.name);
      setBirth(activeBaby.birth_date ?? "");
    }
  }, [activeBaby]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeBaby) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        No baby selected
      </div>
    );
  }

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name can't be empty");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("babies")
      .update({ name: name.trim(), birth_date: birth || null })
      .eq("id", activeBaby.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
    toast.success("Saved");
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(activeBaby.invite_code);
      setCopied(true);
      toast.success("Invite code copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <div className="min-h-screen pb-12 bg-background">
      <header className="sticky top-0 z-30 backdrop-blur bg-background/80 border-b border-border/40">
        <div className="mx-auto max-w-md px-2 h-16 flex items-center gap-2">
          <Link
            to="/"
            className="w-11 h-11 grid place-items-center rounded-full hover:bg-muted text-foreground"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="font-extrabold text-lg">Settings</div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-4 space-y-4">
        <Card className="rounded-3xl p-5 border-0 shadow-sm">
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base font-bold">
                Baby's name
              </Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 rounded-2xl text-base"
              />
              <p className="text-xs text-muted-foreground">
                The home page will show "{name || "…"}'s log".
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="birth" className="text-base font-bold">
                Birth date
              </Label>
              <Input
                id="birth"
                type="date"
                value={birth}
                onChange={(e) => setBirth(e.target.value)}
                className="h-12 rounded-2xl text-base"
              />
            </div>
            <Button
              type="submit"
              disabled={saving}
              className="w-full h-12 rounded-full text-base font-extrabold"
            >
              <Save className="w-5 h-5" /> {saving ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </Card>

        <Card className="rounded-3xl p-5 border-0 shadow-sm space-y-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Invite code
            </div>
            <div className="mt-2 text-3xl font-mono tracking-[0.4em] font-extrabold text-foreground text-center py-4 rounded-2xl bg-muted">
              {activeBaby.invite_code}
            </div>
            <p className="mt-2 text-xs text-muted-foreground text-center">
              Share this code so another caregiver can join.
            </p>
          </div>
          <Button
            onClick={copyCode}
            variant="outline"
            className="w-full h-12 rounded-full font-bold border-2"
          >
            <Copy className="w-4 h-4" /> {copied ? "Copied!" : "Copy code"}
          </Button>
        </Card>
      </main>
    </div>
  );
}
