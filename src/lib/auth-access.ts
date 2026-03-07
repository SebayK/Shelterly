import type { ShelterStatus, UserRole } from "@/types";

function sanitizeReturnPath(path: string): string {
  const trimmed = path.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }

  return "/dashboard";
}

export function isSuspendedShelterSession(role: UserRole, status: ShelterStatus): boolean {
  return role === "shelter" && status === "suspended";
}

export function getPostLoginDestination(role: UserRole, status: ShelterStatus, requestedPath: string): string {
  if (role === "super_admin") {
    return "/admin";
  }

  if (status === "verified") {
    return sanitizeReturnPath(requestedPath);
  }

  return "/dashboard/profile";
}

export function shouldRedirectShelterDashboard(role: UserRole, status: ShelterStatus, currentPath: string): boolean {
  return role === "shelter" && status !== "verified" && currentPath === "/dashboard";
}
