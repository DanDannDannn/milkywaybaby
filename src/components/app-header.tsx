import { Link, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useBaby } from "@/lib/baby-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, LogOut, Plus, ChevronDown } from "lucide-react";

export function AppHeader() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { babies, activeBaby, setActiveBabyId } = useBaby();

  const initial = activeBaby?.name?.[0]?.toUpperCase() ?? "?";

  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-background/80 border-b border-border/40">
      <div className="mx-auto max-w-md px-4 h-14 flex items-center justify-between gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full pr-3 pl-1 py-1 hover:bg-muted transition-colors">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-peach to-mint grid place-items-center text-base font-semibold text-foreground/80 shadow-sm">
              {initial}
            </div>
            <span className="font-semibold text-foreground truncate max-w-[140px]">
              {activeBaby?.name ?? "No baby"}
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 rounded-2xl">
            <DropdownMenuLabel>Babies</DropdownMenuLabel>
            {babies.map((b) => (
              <DropdownMenuItem
                key={b.id}
                onClick={() => setActiveBabyId(b.id)}
                className={b.id === activeBaby?.id ? "font-semibold" : ""}
              >
                {b.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/onboarding">
                <Plus className="w-4 h-4 mr-2" /> Add or join baby
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-1">
          {activeBaby && (
            <Link
              to="/baby-settings"
              className="w-9 h-9 grid place-items-center rounded-full hover:bg-muted text-muted-foreground"
              aria-label="Baby settings"
            >
              <Settings className="w-5 h-5" />
            </Link>
          )}
          <button
            onClick={async () => {
              await signOut();
              router.navigate({ to: "/auth" });
            }}
            className="w-9 h-9 grid place-items-center rounded-full hover:bg-muted text-muted-foreground"
            aria-label="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
