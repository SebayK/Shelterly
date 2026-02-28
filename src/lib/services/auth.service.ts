/**
 * Auth Service
 * Handles authentication business logic: sign-in, profile verification,
 * and account status checks.
 */

import type { SupabaseClient } from "@/db/supabase.client";
import type { LoginCommand, LoginResponseDTO } from "@/types";
import { UnauthorizedError, InternalError, AccountPendingError, AccountSuspendedError } from "@/lib/errors";

export class AuthService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Authenticates a user with email and password.
   *
   * Flow:
   * 1. Calls Supabase Auth `signInWithPassword` — throws UnauthorizedError on failure.
   * 2. Fetches the user's profile from the `profiles` table — throws InternalError if missing.
   * 3. Validates account status: throws AccountPendingError / AccountSuspendedError accordingly.
   * 4. Returns a LoginResponseDTO with user, session and profile data.
   *
   * @param command - Login credentials (email, password)
   * @returns LoginResponseDTO with user, session tokens and profile information
   * @throws UnauthorizedError if credentials are invalid or user/session is absent
   * @throws InternalError if the profile cannot be retrieved from the database
   * @throws AccountPendingError if the account is awaiting verification
   * @throws AccountSuspendedError if the account has been suspended
   */
  async login(command: LoginCommand): Promise<LoginResponseDTO> {
    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await this.supabase.auth.signInWithPassword({
      email: command.email,
      password: command.password,
    });

    // Generic error message — never reveal whether it's email or password that's wrong
    if (authError || !authData.user || !authData.session) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const { user, session } = authData;

    // 2. Fetch profile from the database (id, status, role only — minimal payload)
    const { data: profile, error: profileError } = await this.supabase
      .from("profiles")
      .select("id, status, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      throw new InternalError("Unable to retrieve user profile");
    }

    // 3. Validate account status — reject non-active accounts before issuing tokens
    if (profile.status === "pending") {
      throw new AccountPendingError();
    }

    if (profile.status === "suspended") {
      throw new AccountSuspendedError();
    }

    // 4. Build and return the response DTO
    return {
      user: {
        id: user.id,
        email: user.email ?? "",
      },
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at ?? 0,
      },
      profile: {
        id: profile.id,
        status: profile.status,
        role: profile.role,
      },
    };
  }
}
