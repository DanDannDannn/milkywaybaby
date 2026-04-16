import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";

export interface Baby {
  id: string;
  name: string;
  birth_date: string | null;
  invite_code: string;
  created_by: string;
}

interface BabyContextValue {
  babies: Baby[];
  activeBaby: Baby | null;
  setActiveBabyId: (id: string) => void;
  refresh: () => Promise<void>;
  loading: boolean;
}

const BabyContext = createContext<BabyContextValue | undefined>(undefined);
const ACTIVE_KEY = "active-baby-id";

export function BabyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [babies, setBabies] = useState<Baby[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) {
      setBabies([]);
      setActiveId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: members } = await supabase
      .from("baby_members")
      .select("baby_id")
      .eq("user_id", user.id);
    const ids = (members ?? []).map((m) => m.baby_id);
    if (ids.length === 0) {
      setBabies([]);
      setActiveId(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("babies")
      .select("*")
      .in("id", ids)
      .order("created_at", { ascending: true });
    const list = (data ?? []) as Baby[];
    setBabies(list);
    const stored = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_KEY) : null;
    const next = list.find((b) => b.id === stored)?.id ?? list[0]?.id ?? null;
    setActiveId(next);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const setActiveBabyId = (id: string) => {
    setActiveId(id);
    if (typeof window !== "undefined") localStorage.setItem(ACTIVE_KEY, id);
  };

  const activeBaby = babies.find((b) => b.id === activeId) ?? null;

  return (
    <BabyContext.Provider value={{ babies, activeBaby, setActiveBabyId, refresh, loading }}>
      {children}
    </BabyContext.Provider>
  );
}

export function useBaby() {
  const ctx = useContext(BabyContext);
  if (!ctx) throw new Error("useBaby must be used within BabyProvider");
  return ctx;
}
