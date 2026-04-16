import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useBaby } from "@/lib/baby-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Copy, Loader2, Save, Download, LogOut, User } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Little Logs" }] }),
  component: SettingsPage,
});

function csvEscape(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  return lines.join("\n");
}

function SettingsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { activeBaby, loading, refresh } = useBaby();
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [downloading, setDownloading] = useState(false);
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

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("user_id", user.id)
        .maybeSingle();
      setDisplayName(data?.display_name ?? "");
      setEmail(data?.email ?? user.email ?? "");
    })();
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeBaby || !user) {
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

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("Your name can't be empty");
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          display_name: displayName.trim(),
          email: email.trim() || user.email,
        },
        { onConflict: "user_id" },
      );
    setSavingProfile(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile saved");
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

  const downloadAll = async () => {
    setDownloading(true);
    try {
      const [{ data: feeds }, { data: diapers }, { data: temps }, { data: sleeps }] =
        await Promise.all([
          supabase
            .from("feedings")
            .select("occurred_at, amount, unit, type, note, logged_by")
            .eq("baby_id", activeBaby.id)
            .order("occurred_at", { ascending: false }),
          supabase
            .from("diapers")
            .select("occurred_at, type, note, logged_by")
            .eq("baby_id", activeBaby.id)
            .order("occurred_at", { ascending: false }),
          supabase
            .from("temperatures")
            .select("occurred_at, value_c, note, logged_by")
            .eq("baby_id", activeBaby.id)
            .order("occurred_at", { ascending: false }),
          supabase
            .from("sleeps")
            .select("started_at, ended_at, note, logged_by")
            .eq("baby_id", activeBaby.id)
            .order("started_at", { ascending: false }),
        ]);

      const userIds = new Set<string>();
      for (const r of [
        ...(feeds ?? []),
        ...(diapers ?? []),
        ...(temps ?? []),
        ...(sleeps ?? []),
      ]) {
        if ((r as { logged_by?: string }).logged_by) userIds.add((r as { logged_by: string }).logged_by);
      }
      const profMap: Record<string, string> = {};
      if (userIds.size > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, email")
          .in("user_id", Array.from(userIds));
        for (const p of (profs ?? []) as { user_id: string; display_name: string | null; email: string | null }[]) {
          profMap[p.user_id] = p.display_name || p.email || p.user_id;
        }
      }
      const named = <T extends { logged_by: string }>(rows: T[] | null) =>
        (rows ?? []).map((r) => ({ ...r, logged_by_name: profMap[r.logged_by] ?? r.logged_by }));

      const payload = {
        baby: { name: activeBaby.name, birth_date: activeBaby.birth_date },
        exported_at: new Date().toISOString(),
        feedings: named(feeds as { logged_by: string }[] | null),
        diapers: named(diapers as { logged_by: string }[] | null),
        temperatures: named(temps as { logged_by: string }[] | null),
        sleeps: named(sleeps as { logged_by: string }[] | null),
      };

      const slug = activeBaby.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const stamp = new Date().toISOString().slice(0, 10);

      // JSON
      const jsonBlob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(jsonBlob);
      a.download = `${slug}-log-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(a.href);

      // CSVs
      const csvParts: string[] = [];
      const sections: [string, Record<string, unknown>[]][] = [
        ["FEEDINGS", payload.feedings],
        ["DIAPERS", payload.diapers],
        ["TEMPERATURES", payload.temperatures],
        ["SLEEPS", payload.sleeps],
      ];
      for (const [title, rows] of sections) {
        csvParts.push(`# ${title}`);
        csvParts.push(rows.length ? toCsv(rows) : "(empty)");
        csvParts.push("");
      }
      const csvBlob = new Blob([csvParts.join("\n")], { type: "text/csv" });
      const b = document.createElement("a");
      b.href = URL.createObjectURL(csvBlob);
      b.download = `${slug}-log-${stamp}.csv`;
      b.click();
      URL.revokeObjectURL(b.href);

      toast.success("Download started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
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
        {/* Your profile */}
        <Card className="rounded-3xl p-5 border-0 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-base font-extrabold">Your profile</h2>
          </div>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dname" className="text-base font-bold">
                Your name
              </Label>
              <Input
                id="dname"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Mom, Dad, Grandma"
                className="h-12 rounded-2xl text-base"
              />
              <p className="text-xs text-muted-foreground">
                Shown next to entries you log in the history.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base font-bold">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-2xl text-base"
              />
            </div>
            <Button
              type="submit"
              disabled={savingProfile}
              className="w-full h-12 rounded-full text-base font-extrabold"
            >
              <Save className="w-5 h-5" /> {savingProfile ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </Card>

        {/* Baby */}
        <Card className="rounded-3xl p-5 border-0 shadow-sm">
          <h2 className="text-base font-extrabold mb-3">Baby</h2>
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

        {/* Invite */}
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

        {/* Data export */}
        <Card className="rounded-3xl p-5 border-0 shadow-sm space-y-3">
          <h2 className="text-base font-extrabold">Your data</h2>
          <p className="text-sm text-muted-foreground">
            Download every feeding, diaper, sleep, and temperature record for {activeBaby.name} as
            JSON and CSV.
          </p>
          <Button
            onClick={downloadAll}
            disabled={downloading}
            variant="outline"
            className="w-full h-12 rounded-full font-bold border-2"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}{" "}
            {downloading ? "Preparing…" : "Download all data"}
          </Button>
        </Card>

        {/* Sign out */}
        <Card className="rounded-3xl p-5 border-0 shadow-sm">
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="w-full h-12 rounded-full font-bold border-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </Button>
        </Card>
      </main>
    </div>
  );
}
