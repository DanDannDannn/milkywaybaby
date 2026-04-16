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
  const title = activeBaby?.name ? `${activeBaby.name}'s log` : "Little Logs";

  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-background/80 border-b border-border/40">
      <div className="mx-auto max-w-md px-4 h-16 flex items-center justify-between gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full pr-3 pl-1 py-1 hover:bg-muted transition-colors">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary grid place-items-center text-base font-extrabold text-primary-foreground shadow-sm">
              {initial}
            </div>
            <span className="font-extrabold text-lg text-foreground truncate max-w-[180px]">
              {title}
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60 rounded-2xl">
            <DropdownMenuLabel>Babies</DropdownMenuLabel>
            {babies.map((b) => (
              <DropdownMenuItem
                key={b.id}
                onClick={() => setActiveBabyId(b.id)}
                className={`text-base ${b.id === activeBaby?.id ? "font-extrabold" : "font-medium"}`}
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
              to="/settings"
              className="w-10 h-10 grid place-items-center rounded-full hover:bg-muted text-muted-foreground"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
            </Link>
          )}
          <button
            onClick={async () => {
              await signOut();
              router.navigate({ to: "/auth" });
            }}
            className="w-10 h-10 grid place-items-center rounded-full hover:bg-muted text-muted-foreground"
            aria-label="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
