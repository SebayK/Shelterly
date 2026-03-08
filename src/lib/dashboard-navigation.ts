import type { UserRole } from "@/types";

export interface DashboardNavigationItem {
  href: string;
  label: string;
  mobileLabel: string;
  isCurrent: boolean;
}

export interface DashboardNavigationModel {
  ariaLabel: string;
  items: DashboardNavigationItem[];
}

export function getDashboardNavigation(role: UserRole, currentPath: string): DashboardNavigationModel {
  if (role === "super_admin") {
    return {
      ariaLabel: "Nawigacja panelu administracyjnego",
      items: [
        {
          href: "/admin",
          label: "Panel admina",
          mobileLabel: "Admin",
          isCurrent: currentPath.startsWith("/admin"),
        },
      ],
    };
  }

  const isNeeds = currentPath === "/dashboard";
  const isProfile = currentPath.startsWith("/dashboard/profile");

  return {
    ariaLabel: "Nawigacja dashboardu",
    items: [
      {
        href: "/dashboard",
        label: "Potrzeby",
        mobileLabel: "Potrzeby",
        isCurrent: isNeeds,
      },
      {
        href: "/dashboard/profile",
        label: "Profil",
        mobileLabel: "Profil",
        isCurrent: isProfile,
      },
    ],
  };
}
