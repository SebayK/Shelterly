import { useState, useCallback, useId } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormErrorAlert } from "@/components/auth/FormErrorAlert";
import { getPostLoginDestination } from "@/lib/auth-access";
import type { LoginCommand, ErrorResponse, LoginResponseDTO } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoginFieldErrors {
  email?: string;
  password?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateEmail(value: string): string | undefined {
  if (!value.trim()) return "Adres e-mail jest wymagany.";
  if (!EMAIL_REGEX.test(value)) return "Podaj poprawny adres e-mail.";
  if (value.length > 255) return "Adres e-mail może mieć maksymalnie 255 znaków.";
  return undefined;
}

function validatePassword(value: string): string | undefined {
  if (!value) return "Hasło jest wymagane.";
  if (value.length > 128) return "Hasło może mieć maksymalnie 128 znaków.";
  return undefined;
}

function validateAll(email: string, password: string): LoginFieldErrors {
  return {
    email: validateEmail(email),
    password: validatePassword(password),
  };
}

function hasErrors(errors: LoginFieldErrors): boolean {
  return Boolean(errors.email || errors.password);
}

// ---------------------------------------------------------------------------
// API error mapping
// ---------------------------------------------------------------------------

function mapApiError(errorData: ErrorResponse): string {
  switch (errorData.error.code) {
    case "UNAUTHORIZED":
      return "Nieprawidłowy adres e-mail lub hasło.";
    case "ACCOUNT_SUSPENDED":
      return "Twoje konto zostało zawieszone. Skontaktuj się z administratorem.";
    case "RATE_LIMIT_EXCEEDED":
      return "Przekroczono limit prób logowania. Spróbuj ponownie za chwilę.";
    case "VALIDATION_ERROR":
    case "INVALID_REQUEST":
      return "Nieprawidłowe dane. Sprawdź wpisane informacje i spróbuj ponownie.";
    case "INTERNAL_ERROR":
    case "SERVICE_UNAVAILABLE":
      return "Wystąpił problem z serwerem. Spróbuj ponownie za chwilę.";
    default:
      return "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface LoginFormProps {
  returnUrl?: string;
}

export default function LoginForm({ returnUrl = "/dashboard" }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Stable IDs for form fields — safe for SSR and multiple mounts
  const baseId = useId();
  const emailId = `${baseId}-email`;
  const emailErrorId = `${baseId}-email-error`;
  const passwordId = `${baseId}-password`;
  const passwordErrorId = `${baseId}-password-error`;

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setEmail(value);
      if (hasSubmitted) {
        setFieldErrors((prev) => ({ ...prev, email: validateEmail(value) }));
      }
    },
    [hasSubmitted]
  );

  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setPassword(value);
      if (hasSubmitted) {
        setFieldErrors((prev) => ({ ...prev, password: validatePassword(value) }));
      }
    },
    [hasSubmitted]
  );

  const handleEmailBlur = useCallback(() => {
    setFieldErrors((prev) => ({ ...prev, email: validateEmail(email) }));
  }, [email]);

  const handlePasswordBlur = useCallback(() => {
    setFieldErrors((prev) => ({ ...prev, password: validatePassword(password) }));
  }, [password]);

  const handleTogglePassword = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      setHasSubmitted(true);
      const errors = validateAll(email, password);
      setFieldErrors(errors);

      if (hasErrors(errors)) return;

      setIsSubmitting(true);
      setApiError(null);

      try {
        const command: LoginCommand = { email, password };
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        });

        if (response.ok) {
          const result = (await response.json()) as Omit<LoginResponseDTO, "session">;
          window.location.href = getPostLoginDestination(result.profile.role, result.profile.status, returnUrl);
          return;
        }

        const errorData: ErrorResponse = await response.json();
        setApiError(mapApiError(errorData));
      } catch {
        setApiError("Nie można połączyć się z serwerem. Sprawdź połączenie internetowe.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, password, returnUrl]
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Zaloguj się</CardTitle>
        <CardDescription>Wpisz dane logowania, aby zarządzać schroniskiem</CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit} noValidate aria-label="Formularz logowania">
        <CardContent className="space-y-4">
          {apiError && <FormErrorAlert message={apiError} />}

          {/* Email field */}
          <div className="space-y-1">
            <label htmlFor={emailId} className="text-sm font-medium leading-none">
              Adres e-mail
            </label>
            <Input
              id={emailId}
              type="email"
              autoComplete="email"
              placeholder="shelter@example.com"
              value={email}
              onChange={handleEmailChange}
              onBlur={handleEmailBlur}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? emailErrorId : undefined}
              disabled={isSubmitting}
            />
            {fieldErrors.email && (
              <p id={emailErrorId} className="text-sm text-destructive" role="alert">
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password field */}
          <div className="space-y-1">
            <label htmlFor={passwordId} className="text-sm font-medium leading-none">
              Hasło
            </label>
            <div className="relative">
              <Input
                id={passwordId}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={handlePasswordChange}
                onBlur={handlePasswordBlur}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? passwordErrorId : undefined}
                disabled={isSubmitting}
                className="pr-10"
              />
              <button
                type="button"
                onClick={handleTogglePassword}
                aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={0}
              >
                {showPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z"
                      clipRule="evenodd"
                    />
                    <path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                    <path
                      fillRule="evenodd"
                      d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            </div>
            {fieldErrors.password && (
              <p id={passwordErrorId} className="text-sm text-destructive" role="alert">
                {fieldErrors.password}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Logowanie...
              </span>
            ) : (
              "Zaloguj się"
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Nie masz jeszcze konta?{" "}
            <a href="/auth/register" className="font-medium text-primary underline-offset-4 hover:underline">
              Zarejestruj się
            </a>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
