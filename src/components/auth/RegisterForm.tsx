import { useState, useCallback, useMemo, useId } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormErrorAlert } from "@/components/auth/FormErrorAlert";
import PasswordStrengthIndicator from "@/components/auth/PasswordStrengthIndicator";
import FileUploadDropzone, { ACCEPTED_TYPES, MAX_SIZE_BYTES } from "@/components/auth/FileUploadDropzone";
import type { SignupCommand, ErrorResponse } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  nip: string;
  city: string;
  address: string;
  phone_number: string;
  website_url: string;
  file: File | null;
}

interface RegisterFieldErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  name?: string;
  nip?: string;
  city?: string;
  address?: string;
  phone_number?: string;
  website_url?: string;
  file?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s-]{7,20}$/;

const INITIAL_FORM_DATA: RegisterFormData = {
  email: "",
  password: "",
  confirmPassword: "",
  name: "",
  nip: "",
  city: "",
  address: "",
  phone_number: "",
  website_url: "",
  file: null,
};

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
  if (value.length < 8) return "Hasło musi mieć co najmniej 8 znaków.";
  if (value.length > 128) return "Hasło może mieć maksymalnie 128 znaków.";
  if (!/[a-z]/.test(value)) return "Hasło musi zawierać co najmniej jedną małą literę.";
  if (!/[A-Z]/.test(value)) return "Hasło musi zawierać co najmniej jedną wielką literę.";
  if (!/[0-9]/.test(value)) return "Hasło musi zawierać co najmniej jedną cyfrę.";
  if (!/[^a-zA-Z0-9]/.test(value)) return "Hasło musi zawierać co najmniej jeden znak specjalny.";
  return undefined;
}

function validateConfirmPassword(password: string, confirm: string): string | undefined {
  if (!confirm) return "Powtórzenie hasła jest wymagane.";
  if (password !== confirm) return "Hasła nie są identyczne.";
  return undefined;
}

function validateName(value: string): string | undefined {
  if (!value.trim()) return "Nazwa schroniska jest wymagana.";
  if (value.trim().length < 2) return "Nazwa schroniska musi mieć co najmniej 2 znaki.";
  if (value.length > 255) return "Nazwa schroniska może mieć maksymalnie 255 znaków.";
  return undefined;
}

function validateNip(value: string): string | undefined {
  if (!value.trim()) return "NIP jest wymagany.";
  if (!/^\d{10}$/.test(value)) return "NIP musi składać się z dokładnie 10 cyfr.";

  // Checksum validation: weights [6,5,7,2,3,4,5,6,7]
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const digits = value.split("").map(Number);
  const sum = weights.reduce((acc, w, i) => acc + w * digits[i], 0);
  if (sum % 11 !== digits[9]) return "Podany NIP jest nieprawidłowy (błąd sumy kontrolnej).";

  return undefined;
}

function validateCity(value: string): string | undefined {
  if (!value.trim()) return "Miasto jest wymagane.";
  if (value.trim().length < 2) return "Miasto musi mieć co najmniej 2 znaki.";
  if (value.length > 100) return "Nazwa miasta może mieć maksymalnie 100 znaków.";
  return undefined;
}

function validateAddress(value: string): string | undefined {
  if (!value.trim()) return "Adres jest wymagany.";
  if (value.trim().length < 5) return "Adres musi mieć co najmniej 5 znaków.";
  if (value.length > 255) return "Adres może mieć maksymalnie 255 znaków.";
  return undefined;
}

function validatePhone(value: string): string | undefined {
  if (!value.trim()) return undefined; // optional
  if (!PHONE_REGEX.test(value.trim())) return "Podaj poprawny numer telefonu.";
  return undefined;
}

function validateWebsite(value: string): string | undefined {
  if (!value.trim()) return undefined; // optional
  try {
    new URL(value.trim());
    return undefined;
  } catch {
    return "Podaj poprawny adres URL.";
  }
}

function validateFile(file: File | null): string | undefined {
  if (!file) return "Dokument weryfikacyjny jest wymagany.";
  if (!ACCEPTED_TYPES.includes(file.type)) return "Akceptowane formaty: PDF, JPG, PNG.";
  if (file.size > MAX_SIZE_BYTES) return "Plik nie może przekraczać 5 MB.";
  return undefined;
}

function validateAll(data: RegisterFormData): RegisterFieldErrors {
  return {
    email: validateEmail(data.email),
    password: validatePassword(data.password),
    confirmPassword: validateConfirmPassword(data.password, data.confirmPassword),
    name: validateName(data.name),
    nip: validateNip(data.nip),
    city: validateCity(data.city),
    address: validateAddress(data.address),
    phone_number: validatePhone(data.phone_number),
    website_url: validateWebsite(data.website_url),
    file: validateFile(data.file),
  };
}

function hasErrors(errors: RegisterFieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}

// ---------------------------------------------------------------------------
// API error mapping
// ---------------------------------------------------------------------------

function mapApiError(errorData: ErrorResponse): string {
  switch (errorData.error.code) {
    case "CONFLICT":
      return "Konto z podanym adresem e-mail lub NIP już istnieje.";
    case "VALIDATION_ERROR":
      return "Nieprawidłowe dane. Sprawdź formularz i spróbuj ponownie.";
    case "INVALID_REQUEST":
      return "Nieprawidłowe żądanie. Sprawdź dane i spróbuj ponownie.";
    case "RATE_LIMIT_EXCEEDED":
      return "Zbyt wiele prób. Spróbuj ponownie za chwilę.";
    case "INTERNAL_ERROR":
      return "Wystąpił problem z serwerem. Spróbuj ponownie za chwilę.";
    case "SERVICE_UNAVAILABLE":
      return "Serwis jest chwilowo niedostępny. Spróbuj ponownie później.";
    default:
      return "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.";
  }
}

// ---------------------------------------------------------------------------
// Eye icon helpers
// ---------------------------------------------------------------------------

function EyeOffIcon() {
  return (
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
  );
}

function EyeIcon() {
  return (
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
  );
}

// ---------------------------------------------------------------------------
// Sub-component: field wrapper
// ---------------------------------------------------------------------------

interface FieldProps {
  id: string;
  errorId: string;
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

function Field({ id, errorId, label, error, required = true, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium leading-none">
        {label}
        {!required && <span className="ml-1 text-xs text-muted-foreground">(opcjonalne)</span>}
      </label>
      {children}
      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spinner icon
// ---------------------------------------------------------------------------

function Spinner() {
  return (
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
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function RegisterForm() {
  const [formData, setFormData] = useState<RegisterFormData>(INITIAL_FORM_DATA);
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Generate stable unique IDs for all form fields
  const baseId = useId();
  const ids = useMemo(
    () => ({
      email: `${baseId}-email`,
      password: `${baseId}-password`,
      confirmPassword: `${baseId}-confirmPassword`,
      name: `${baseId}-name`,
      nip: `${baseId}-nip`,
      city: `${baseId}-city`,
      address: `${baseId}-address`,
      phone_number: `${baseId}-phone`,
      website_url: `${baseId}-website`,
    }),
    [baseId]
  );

  const errorIds = useMemo(
    () =>
      Object.fromEntries(Object.entries(ids).map(([key, id]) => [key, `${id}-error`])) as Record<
        keyof typeof ids,
        string
      >,
    [ids]
  );

  // -------------------------------------------------------------------------
  // Generic text field handlers
  // -------------------------------------------------------------------------

  const handleFieldChange = useCallback(
    (field: keyof Omit<RegisterFormData, "file">) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setFormData((prev) => ({ ...prev, [field]: value }));

      if (!hasSubmitted) return;

      // inline re-validate the changed field (and confirmPassword if password changes)
      setFieldErrors((prev) => {
        const updated = { ...prev };
        switch (field) {
          case "email":
            updated.email = validateEmail(value);
            break;
          case "password":
            updated.password = validatePassword(value);
            updated.confirmPassword = validateConfirmPassword(value, formData.confirmPassword);
            break;
          case "confirmPassword":
            updated.confirmPassword = validateConfirmPassword(formData.password, value);
            break;
          case "name":
            updated.name = validateName(value);
            break;
          case "nip":
            updated.nip = validateNip(value);
            break;
          case "city":
            updated.city = validateCity(value);
            break;
          case "address":
            updated.address = validateAddress(value);
            break;
          case "phone_number":
            updated.phone_number = validatePhone(value);
            break;
          case "website_url":
            updated.website_url = validateWebsite(value);
            break;
        }
        return updated;
      });
    },
    [hasSubmitted, formData.password, formData.confirmPassword]
  );

  const handleFieldBlur = useCallback(
    (field: keyof Omit<RegisterFormData, "file">) => () => {
      setFieldErrors((prev) => {
        const updated = { ...prev };
        switch (field) {
          case "email":
            updated.email = validateEmail(formData.email);
            break;
          case "password":
            updated.password = validatePassword(formData.password);
            break;
          case "confirmPassword":
            updated.confirmPassword = validateConfirmPassword(formData.password, formData.confirmPassword);
            break;
          case "name":
            updated.name = validateName(formData.name);
            break;
          case "nip":
            updated.nip = validateNip(formData.nip);
            break;
          case "city":
            updated.city = validateCity(formData.city);
            break;
          case "address":
            updated.address = validateAddress(formData.address);
            break;
          case "phone_number":
            updated.phone_number = validatePhone(formData.phone_number);
            break;
          case "website_url":
            updated.website_url = validateWebsite(formData.website_url);
            break;
        }
        return updated;
      });
    },
    [formData]
  );

  const handleFileSelect = useCallback(
    (file: File | null) => {
      setFormData((prev) => ({ ...prev, file }));
      if (hasSubmitted) {
        setFieldErrors((prev) => ({ ...prev, file: validateFile(file) }));
      }
    },
    [hasSubmitted]
  );

  const handleTogglePassword = useCallback(() => setShowPassword((p) => !p), []);
  const handleToggleConfirmPassword = useCallback(() => setShowConfirmPassword((p) => !p), []);

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setHasSubmitted(true);

      const errors = validateAll(formData);
      setFieldErrors(errors);

      if (hasErrors(errors)) {
        // Focus the first field with an error
        const firstErrorField = (Object.keys(errors) as (keyof RegisterFieldErrors)[]).find((key) => errors[key]);
        if (firstErrorField && firstErrorField !== "file") {
          const el = document.getElementById(ids[firstErrorField as keyof typeof ids]);
          el?.focus();
        }
        return;
      }

      setIsSubmitting(true);
      setApiError(null);

      try {
        // Step 1: Signup
        const command: SignupCommand = {
          email: formData.email,
          password: formData.password,
          profile: {
            name: formData.name,
            nip: formData.nip,
            city: formData.city,
            address: formData.address,
            ...(formData.phone_number.trim() ? { phone_number: formData.phone_number.trim() } : {}),
            ...(formData.website_url.trim() ? { website_url: formData.website_url.trim() } : {}),
          },
        };

        const signupResponse = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        });

        if (!signupResponse.ok) {
          const errorData: ErrorResponse = await signupResponse.json();
          setApiError(mapApiError(errorData));
          return;
        }

        // Step 2: Upload verification document (if file selected)
        if (formData.file) {
          const uploadFormData = new FormData();
          uploadFormData.append("file", formData.file);

          try {
            const uploadResponse = await fetch("/api/profiles/me/verification-document", {
              method: "POST",
              body: uploadFormData,
            });

            if (!uploadResponse.ok) {
              // Account created but upload failed — redirect anyway
            }
          } catch {
            // Network error during upload — account already created, redirect anyway
          }
        }

        // Step 3: Redirect to pending page
        window.location.href = "/auth/pending";
      } catch {
        setApiError("Nie można połączyć się z serwerem. Sprawdź połączenie internetowe.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, ids]
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Zarejestruj schronisko</CardTitle>
        <CardDescription>Utwórz konto, aby zarządzać potrzebami swojego schroniska</CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit} noValidate aria-label="Formularz rejestracji">
        <CardContent className="space-y-6">
          {apiError && <FormErrorAlert message={apiError} />}

          {/* ── Section 1: Login credentials ── */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-foreground">Dane logowania</legend>

            {/* Email — full width */}
            <Field id={ids.email} errorId={errorIds.email} label="Adres e-mail" error={fieldErrors.email}>
              <Input
                id={ids.email}
                type="email"
                autoComplete="email"
                placeholder="shelter@example.com"
                value={formData.email}
                onChange={handleFieldChange("email")}
                onBlur={handleFieldBlur("email")}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? errorIds.email : undefined}
                disabled={isSubmitting}
              />
            </Field>

            {/* Password + Confirm password — 2 columns on sm+ */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={ids.password} errorId={errorIds.password} label="Hasło" error={fieldErrors.password}>
                <div className="relative">
                  <Input
                    id={ids.password}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleFieldChange("password")}
                    onBlur={handleFieldBlur("password")}
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? errorIds.password : undefined}
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
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </Field>

              <Field
                id={ids.confirmPassword}
                errorId={errorIds.confirmPassword}
                label="Powtórz hasło"
                error={fieldErrors.confirmPassword}
              >
                <div className="relative">
                  <Input
                    id={ids.confirmPassword}
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleFieldChange("confirmPassword")}
                    onBlur={handleFieldBlur("confirmPassword")}
                    aria-invalid={Boolean(fieldErrors.confirmPassword)}
                    aria-describedby={fieldErrors.confirmPassword ? errorIds.confirmPassword : undefined}
                    disabled={isSubmitting}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={handleToggleConfirmPassword}
                    aria-label={showConfirmPassword ? "Ukryj hasło" : "Pokaż hasło"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={0}
                  >
                    {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </Field>
            </div>

            {/* Password strength indicator spans full width, shown when password has input */}
            <PasswordStrengthIndicator password={formData.password} visible={formData.password.length > 0} />
          </fieldset>

          {/* ── Section 2: Shelter data ── */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-foreground">Dane schroniska</legend>

            {/* Name — full width */}
            <Field id={ids.name} errorId={errorIds.name} label="Nazwa schroniska" error={fieldErrors.name}>
              <Input
                id={ids.name}
                type="text"
                autoComplete="organization"
                placeholder="Schronisko dla Zwierząt w Warszawie"
                value={formData.name}
                onChange={handleFieldChange("name")}
                onBlur={handleFieldBlur("name")}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? errorIds.name : undefined}
                disabled={isSubmitting}
              />
            </Field>

            {/* NIP + City — 2 columns on sm+ */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={ids.nip} errorId={errorIds.nip} label="NIP" error={fieldErrors.nip}>
                <Input
                  id={ids.nip}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="1234567890"
                  value={formData.nip}
                  onChange={handleFieldChange("nip")}
                  onBlur={handleFieldBlur("nip")}
                  aria-invalid={Boolean(fieldErrors.nip)}
                  aria-describedby={fieldErrors.nip ? errorIds.nip : undefined}
                  disabled={isSubmitting}
                  maxLength={10}
                />
              </Field>

              <Field id={ids.city} errorId={errorIds.city} label="Miasto" error={fieldErrors.city}>
                <Input
                  id={ids.city}
                  type="text"
                  autoComplete="address-level2"
                  placeholder="Warszawa"
                  value={formData.city}
                  onChange={handleFieldChange("city")}
                  onBlur={handleFieldBlur("city")}
                  aria-invalid={Boolean(fieldErrors.city)}
                  aria-describedby={fieldErrors.city ? errorIds.city : undefined}
                  disabled={isSubmitting}
                />
              </Field>
            </div>

            {/* Address — full width */}
            <Field id={ids.address} errorId={errorIds.address} label="Adres" error={fieldErrors.address}>
              <Input
                id={ids.address}
                type="text"
                autoComplete="street-address"
                placeholder="ul. Przykładowa 1, 00-001 Warszawa"
                value={formData.address}
                onChange={handleFieldChange("address")}
                onBlur={handleFieldBlur("address")}
                aria-invalid={Boolean(fieldErrors.address)}
                aria-describedby={fieldErrors.address ? errorIds.address : undefined}
                disabled={isSubmitting}
              />
            </Field>

            {/* Phone + Website — 2 columns on sm+ */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id={ids.phone_number}
                errorId={errorIds.phone_number}
                label="Telefon"
                required={false}
                error={fieldErrors.phone_number}
              >
                <Input
                  id={ids.phone_number}
                  type="tel"
                  autoComplete="tel"
                  placeholder="+48 123 456 789"
                  value={formData.phone_number}
                  onChange={handleFieldChange("phone_number")}
                  onBlur={handleFieldBlur("phone_number")}
                  aria-invalid={Boolean(fieldErrors.phone_number)}
                  aria-describedby={fieldErrors.phone_number ? errorIds.phone_number : undefined}
                  disabled={isSubmitting}
                />
              </Field>

              <Field
                id={ids.website_url}
                errorId={errorIds.website_url}
                label="Strona internetowa"
                required={false}
                error={fieldErrors.website_url}
              >
                <Input
                  id={ids.website_url}
                  type="url"
                  autoComplete="url"
                  placeholder="https://schronisko.pl"
                  value={formData.website_url}
                  onChange={handleFieldChange("website_url")}
                  onBlur={handleFieldBlur("website_url")}
                  aria-invalid={Boolean(fieldErrors.website_url)}
                  aria-describedby={fieldErrors.website_url ? errorIds.website_url : undefined}
                  disabled={isSubmitting}
                />
              </Field>
            </div>
          </fieldset>

          {/* ── Section 3: Verification document ── */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-foreground">Dokument weryfikacyjny</legend>
            <p className="text-xs text-muted-foreground">
              Wgraj dokument potwierdzający działalność schroniska (np. KRS, zaświadczenie). Administrator zweryfikuje
              go przed aktywacją konta.
            </p>
            <FileUploadDropzone
              file={formData.file}
              onFileSelect={handleFileSelect}
              error={fieldErrors.file}
              disabled={isSubmitting}
            />
          </fieldset>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Spinner />
                Rejestrowanie...
              </span>
            ) : (
              "Zarejestruj się"
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Masz już konto?{" "}
            <a href="/auth/login" className="font-medium text-primary underline-offset-4 hover:underline">
              Zaloguj się
            </a>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
