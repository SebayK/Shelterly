/**
 * Auth Service
 * Handles authentication business logic: sign-in, sign-up, profile verification,
 * and account status checks.
 */

import type { SupabaseClient } from "@/db/supabase.client";
import type {
  LoginCommand,
  LoginResponseDTO,
  SignupCommand,
  SignupResponseDTO,
  LogoutResponseDTO,
  RefreshTokenCommand,
  RefreshTokenResponseDTO,
} from "@/types";
import {
  UnauthorizedError,
  InternalError,
  AccountPendingError,
  AccountSuspendedError,
  ConflictError,
} from "@/lib/errors";

export class AuthService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Authenticates a user with email and password.
   *
   * Flow:
   * 1. Calls Supabase Auth `signInWithPassword` — throws UnauthorizedError on failure.
   * 2. Fetches the user's profile from the `profiles` table — throws InternalError if missing.
   * 3. Validates account status: throws AccountPendingError / AccountSuspendedError accordingly.
   *    Calls signOut() first to invalidate the session before rejecting — prevents active
   *    sessions from remaining open for non-active accounts.
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

    // 3. Validate account status — reject non-active accounts before issuing tokens.
    // signOut() is called first to invalidate the Supabase session that was just created,
    // preventing pending/suspended accounts from holding active JWT sessions.
    if (profile.status === "pending") {
      await this.supabase.auth.signOut();
      throw new AccountPendingError();
    }

    if (profile.status === "suspended") {
      await this.supabase.auth.signOut();
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

  /**
   * Registers a new shelter account.
   *
   * Flow:
   * 1. Passes all profile data as `options.data` (raw_user_meta_data) to Supabase Auth `signUp`.
   * 2. The DB trigger `handle_new_user` atomically inserts the profile row in the same
   *    transaction as the auth.users row — eliminating zombie user risk on DB errors.
   * 3. On auth error: maps "User already registered" to ConflictError.
   *    Maps unique constraint violation from the trigger to ConflictError (NIP duplicate).
   * 4. Fetches the newly created profile to build the response DTO.
   *
   * @param command - Registration data (email, password, profile fields)
   * @returns SignupResponseDTO with message, user and profile summary
   * @throws ConflictError if the email or NIP already exists
   * @throws InternalError if Supabase Auth or DB operation fails unexpectedly
   */
  async signup(command: SignupCommand): Promise<SignupResponseDTO> {
    // 1. Create user in Supabase Auth, passing profile fields as user metadata.
    //    The DB trigger handle_new_user() reads these and inserts the profiles row
    //    atomically within the same transaction — no separate INSERT needed.
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email: command.email,
      password: command.password,
      options: {
        data: {
          name: command.profile.name,
          nip: command.profile.nip,
          city: command.profile.city,
          address: command.profile.address,
          phone_number: command.profile.phone_number ?? null,
          website_url: command.profile.website_url ?? null,
        },
      },
    });

    // 2. Handle auth errors
    if (authError) {
      // Supabase wraps trigger exceptions and surfaces them as auth errors.
      // A UNIQUE constraint violation on profiles.nip (or auth.users.email)
      // appears here as a message containing "already registered" or "duplicate".
      if (
        authError.message.includes("User already registered") ||
        authError.message.includes("duplicate") ||
        authError.message.includes("unique")
      ) {
        throw new ConflictError("An account with this email or NIP already exists");
      }
      throw new InternalError("Registration failed");
    }

    // 3. Guard: user must be present after successful signUp
    if (!authData.user) {
      throw new InternalError("Registration failed");
    }

    const { user } = authData;

    // 4. Fetch the newly created profile — inserted atomically by the DB trigger
    const { data: profile, error: profileError } = await this.supabase
      .from("profiles")
      .select("id, status, name")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      throw new InternalError("Failed to retrieve profile after registration");
    }

    // 5. Build and return the response DTO
    return {
      message: "Registration successful. Please wait for verification.",
      user: {
        id: user.id,
        email: user.email ?? "",
      },
      profile: {
        id: profile.id,
        status: profile.status,
        name: profile.name ?? "",
      },
    };
  }

  /**
   * Ends the current user session.
   *
   * Flow:
   * 1. Verifies the user is authenticated via `supabase.auth.getUser()`.
   *    Note: Supabase SDK v2 signOut() is best-effort and does not throw for
   *    unauthenticated requests, so we must check authentication first.
   * 2. Calls `supabase.auth.signOut()` to invalidate the session.
   * 3. Returns a LogoutResponseDTO with confirmation message.
   *
   * @returns LogoutResponseDTO with success message
   * @throws UnauthorizedError if no valid user session exists
   * @throws InternalError if Supabase signOut fails
   */
  async logout(): Promise<LogoutResponseDTO> {
    // 1. Verify the user is authenticated.
    //    Supabase SDK v2 signOut() is best-effort — it clears the local session
    //    even when the token is invalid, so we must explicitly check auth status first.
    const {
      data: { user },
    } = await this.supabase.auth.getUser();

    if (!user) {
      throw new UnauthorizedError("Authentication required");
    }

    // 2. Sign out — invalidate the session on Supabase's side
    const { error: signOutError } = await this.supabase.auth.signOut();

    if (signOutError) {
      throw new InternalError("Logout failed");
    }

    // 3. Return confirmation
    return { message: "Logout successful" };
  }

  /**
   * Refreshes the access token using a valid refresh token.
   *
   * Flow:
   * 1. Calls Supabase Auth `refreshSession` with the provided refresh token.
   * 2. If authError or session is null — throws UnauthorizedError.
   * 3. Returns RefreshTokenResponseDTO with new access_token and expires_at.
   *
   * @param command - Refresh token command ({ refresh_token })
   * @returns RefreshTokenResponseDTO with new access token and expiry
   * @throws UnauthorizedError if refresh token is invalid or expired
   */
  async refreshToken(command: RefreshTokenCommand): Promise<RefreshTokenResponseDTO> {
    const { data, error: authError } = await this.supabase.auth.refreshSession({
      refresh_token: command.refresh_token,
    });

    if (authError || !data.session) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    return {
      access_token: data.session.access_token,
      expires_at: data.session.expires_at ?? 0,
    };
  }
}
