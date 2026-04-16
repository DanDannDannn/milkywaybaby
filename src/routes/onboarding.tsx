import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useBaby } from "@/lib/baby-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Set up your baby — Little Logs" }] }),
  component: Onboarding,
});

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refresh, setActiveBabyId } = useBaby();
  const [tab, setTab] = useState<"create" | "join">("create");

  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("babies")
        .insert({
          name: name.trim(),
          birth_date: birth || null,
          invite_code: genCode(),
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      await refresh();
      if (data) setActiveBabyId(data.id);
      toast.success(`Welcome, ${data?.name}!`);
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create baby");
    } finally {
      setLoading(false);
    }
  };

  const join = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("join_baby_by_code", {
        _code: code.trim().toUpperCase(),
      });
      if (error) throw error;
      await refresh();
      if (typeof data === "string") setActiveBabyId(data);
      toast.success("Joined!");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-background">
      <Card className="w-full max-w-md rounded-3xl shadow-lg border-border/60">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 text-4xl">👶</div>
          <CardTitle className="text-2xl">Let's set things up</CardTitle>
          <CardDescription>Add your baby or join with an invite code</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 p-1 mb-6 rounded-2xl bg-muted">
            <button
              type="button"
              onClick={() => setTab("create")}
              className={`h-10 rounded-xl text-sm font-medium transition-colors ${
                tab === "create" ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
            >
              Add baby
            </button>
            <button
              type="button"
              onClick={() => setTab("join")}
              className={`h-10 rounded-xl text-sm font-medium transition-colors ${
                tab === "join" ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
            >
              Join with code
            </button>
          </div>

          {tab === "create" ? (
            <form onSubmit={create} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Baby's name</Label>
                <Input
                  id="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 rounded-xl"
                  placeholder="e.g. Olivia"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birth">Birth date (optional)</Label>
                <Input
                  id="birth"
                  type="date"
                  value={birth}
                  onChange={(e) => setBirth(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl">
                {loading ? "Creating…" : "Create"}
              </Button>
            </form>
          ) : (
            <form onSubmit={join} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Invite code</Label>
                <Input
                  id="code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="h-11 rounded-xl text-center text-lg tracking-[0.4em] font-mono"
                  maxLength={6}
                  placeholder="ABC123"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl">
                {loading ? "Joining…" : "Join"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
