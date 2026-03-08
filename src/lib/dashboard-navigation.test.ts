import { describe, expect, it } from "vitest";

import { getDashboardNavigation } from "./dashboard-navigation";

describe("getDashboardNavigation", () => {
  it("returns the admin entry point for super_admin and marks it as current on /admin", () => {
    const navigation = getDashboardNavigation("super_admin", "/admin");

    expect(navigation.ariaLabel).toBe("Nawigacja panelu administracyjnego");
    expect(navigation.items).toEqual([
      {
        href: "/admin",
        label: "Panel admina",
        mobileLabel: "Admin",
        isCurrent: true,
      },
    ]);
  });

  it("returns shelter navigation without admin entry for shelter users", () => {
    const navigation = getDashboardNavigation("shelter", "/dashboard/profile");

    expect(navigation.ariaLabel).toBe("Nawigacja dashboardu");
    expect(navigation.items).toEqual([
      {
        href: "/dashboard",
        label: "Potrzeby",
        mobileLabel: "Potrzeby",
        isCurrent: false,
      },
      {
        href: "/dashboard/profile",
        label: "Profil",
        mobileLabel: "Profil",
        isCurrent: true,
      },
    ]);
  });
});
