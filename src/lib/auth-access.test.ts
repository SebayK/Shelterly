import { describe, expect, it } from "vitest";

import { getPostLoginDestination, isSuspendedShelterSession, shouldRedirectShelterDashboard } from "./auth-access";

describe("auth access helpers", () => {
  it("redirects super admins to the admin panel after login", () => {
    expect(getPostLoginDestination("super_admin", "verified", "/dashboard")).toBe("/admin");
  });

  it("keeps verified shelters on the requested relative path", () => {
    expect(getPostLoginDestination("shelter", "verified", "/dashboard")).toBe("/dashboard");
    expect(getPostLoginDestination("shelter", "verified", "/dashboard/profile")).toBe("/dashboard/profile");
  });

  it("redirects pending and rejected shelters to profile remediation", () => {
    expect(getPostLoginDestination("shelter", "pending", "/dashboard")).toBe("/dashboard/profile");
    expect(getPostLoginDestination("shelter", "rejected", "/dashboard")).toBe("/dashboard/profile");
  });

  it("sanitizes unsafe requested paths for verified shelters", () => {
    expect(getPostLoginDestination("shelter", "verified", "https://evil.example")).toBe("/dashboard");
    expect(getPostLoginDestination("shelter", "verified", "//evil.example")).toBe("/dashboard");
    expect(getPostLoginDestination("shelter", "verified", "   ")).toBe("/dashboard");
    expect(getPostLoginDestination("shelter", "verified", "/dashboard\\profile")).toBe("/dashboard");
    expect(getPostLoginDestination("shelter", "verified", "/dashboard\r\nSet-Cookie:test")).toBe("/dashboard");
    expect(getPostLoginDestination("shelter", "verified", "/dashboardprofile")).toBe("/dashboard");
  });

  it("treats only suspended shelter sessions as blocked", () => {
    expect(isSuspendedShelterSession("shelter", "suspended")).toBe(true);
    expect(isSuspendedShelterSession("shelter", "pending")).toBe(false);
    expect(isSuspendedShelterSession("shelter", "rejected")).toBe(false);
    expect(isSuspendedShelterSession("super_admin", "suspended")).toBe(false);
  });

  it("redirects non-verified shelters away from the main dashboard route only", () => {
    expect(shouldRedirectShelterDashboard("shelter", "pending", "/dashboard")).toBe(true);
    expect(shouldRedirectShelterDashboard("shelter", "rejected", "/dashboard")).toBe(true);
    expect(shouldRedirectShelterDashboard("shelter", "verified", "/dashboard")).toBe(false);
    expect(shouldRedirectShelterDashboard("shelter", "pending", "/dashboard/profile")).toBe(false);
    expect(shouldRedirectShelterDashboard("super_admin", "pending", "/dashboard")).toBe(false);
  });
});
