import { useState, useCallback } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { NavbarUser } from "@/types";

interface MobileNavMenuProps {
  user: NavbarUser | null;
}

export function MobileNavMenu({ user }: MobileNavMenuProps) {
  const [open, setOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const closeAndNavigate = useCallback((href: string) => {
    setOpen(false);
    window.location.href = href;
  }, []);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    setOpen(false);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Redirect regardless — server session may already be cleared
    } finally {
      window.location.href = "/auth/login";
    }
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Otwórz menu" data-test-id="mobile-nav-trigger">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-72" data-test-id="mobile-nav-panel" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>Shelterly</SheetTitle>
        </SheetHeader>

        <nav aria-label="Nawigacja mobilna" className="mt-6 flex flex-col gap-1">
          {!user && (
            <>
              <button
                className="flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent"
                onClick={() => closeAndNavigate("/auth/login")}
                data-test-id="mobile-nav-login-button"
              >
                Zaloguj się
              </button>
              <button
                className="flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent"
                onClick={() => closeAndNavigate("/auth/register")}
              >
                Zarejestruj schronisko
              </button>
            </>
          )}

          {user?.role === "shelter" && (
            <>
              <button
                className="flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent"
                onClick={() => closeAndNavigate("/dashboard")}
              >
                Dashboard
              </button>
              <button
                className="flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent"
                onClick={() => closeAndNavigate("/dashboard/profile")}
              >
                Profil
              </button>
              <div className="my-2 h-px bg-border" role="separator" />
              <button
                className="flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-accent"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? "Wylogowywanie…" : "Wyloguj się"}
              </button>
            </>
          )}

          {user?.role === "super_admin" && (
            <>
              <button
                className="flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent"
                onClick={() => closeAndNavigate("/admin")}
              >
                Panel admina
              </button>
              <div className="my-2 h-px bg-border" role="separator" />
              <button
                className="flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-accent"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? "Wylogowywanie…" : "Wyloguj się"}
              </button>
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
