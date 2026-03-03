import { useState, useCallback } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserRole } from "@/types";

interface UserAvatarMenuProps {
  name: string | null;
  role: UserRole;
}

function getInitials(name: string | null, role: UserRole): string {
  if (!name) {
    return role === "super_admin" ? "SA" : "?";
  }
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function UserAvatarMenu({ name, role }: UserAvatarMenuProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Redirect regardless — server session may already be cleared
    } finally {
      window.location.href = "/auth/login";
    }
  }, []);

  const initials = getInitials(name, role);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Menu użytkownika"
          disabled={isLoggingOut}
        >
          <Avatar className="h-8 w-8 cursor-pointer">
            <AvatarFallback className="text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        {role === "shelter" && (
          <>
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => {
                window.location.href = "/dashboard";
              }}
            >
              Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => {
                window.location.href = "/dashboard/profile";
              }}
            >
              Profil
            </DropdownMenuItem>
          </>
        )}

        {role === "super_admin" && (
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => {
              window.location.href = "/admin";
            }}
          >
            Panel admina
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onSelect={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? "Wylogowywanie…" : "Wyloguj się"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
