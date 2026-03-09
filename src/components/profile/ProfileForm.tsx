import { useState, useCallback, useMemo, useId } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FormErrorAlert } from "@/components/auth/FormErrorAlert";
import FileUploadDropzone from "@/components/auth/FileUploadDropzone";
import { ProfileLocationPreviewMap } from "@/components/profile/ProfileLocationPreviewMap";
import type {
  ProfileMeDTO,
  UpdateProfileCommand,
  ProfileUpdateResponseDTO,
  GeocodeCommand,
  GeocodeResponseDTO,
  VerificationDocumentUploadResponseDTO,
  Location,
  ErrorResponse,
  ShelterStatus,
} from "@/types";
import {
  type ProfileFormData,
  type ProfileFieldErrors,
  type ProfileFieldName,
  validateProfileField,
  validateProfileForm,
  hasProfileErrors,
  validateUploadFile,
} from "@/lib/validation/profile-form.schemas";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SAVE_TIMEOUT_MS = 15_000;
const GEOCODE_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProfileFormProps {
  profile: ProfileMeDTO;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

function mapApiErrorCode(errorData: ErrorResponse): string {
  switch (errorData.error.code) {
    case "UNAUTHORIZED":
      return "Sesja wygasła. Zaloguj się ponownie.";
    case "FORBIDDEN":
      return "Nie można modyfikować chronionych pól profilu.";
    case "VALIDATION_ERROR":
      return "Nieprawidłowe dane. Sprawdź formularz i spróbuj ponownie.";
    case "RATE_LIMIT_EXCEEDED":
      return "Zbyt wiele prób. Spróbuj ponownie za chwilę.";
    case "INTERNAL_ERROR":
      return "Wystąpił problem z serwerem. Spróbuj ponownie za chwilę.";
    case "SERVICE_UNAVAILABLE":
      return "Serwis jest chwilowo niedostępny. Spróbuj ponownie później.";
    default:
      return errorData.error.message ?? "Wystąpił nieoczekiwany błąd.";
  }
}

function mapGeocodeError(errorData: ErrorResponse): string {
  switch (errorData.error.code) {
    case "VALIDATION_ERROR":
    case "INVALID_REQUEST":
      return "Uzupełnij poprawny adres i miasto przed geokodowaniem.";
    case "NOT_FOUND":
      return "Nie znaleziono takiego adresu w podanym mieście. Sprawdź dane i spróbuj ponownie.";
    case "UNAUTHORIZED":
      return "Sesja wygasła. Zaloguj się ponownie.";
    case "INTERNAL_ERROR":
    case "SERVICE_UNAVAILABLE":
      return "Usługa geokodowania jest chwilowo niedostępna. Spróbuj ponownie za chwilę.";
    default:
      return errorData.error.message ?? "Nie udało się geokodować adresu. Spróbuj ponownie.";
  }
}

function formatStatusLabel(status: ShelterStatus): string {
  switch (status) {
    case "verified":
      return "Zweryfikowane";
    case "pending":
      return "Oczekuje na weryfikację";
    case "suspended":
      return "Zawieszone";
    case "rejected":
      return "Odrzucone";
    default:
      return status;
  }
}

function statusVariant(status: ShelterStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "verified":
      return "default";
    case "pending":
      return "secondary";
    case "suspended":
    case "rejected":
      return "destructive";
    default:
      return "outline";
  }
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function getVerificationDocumentHint(status: ShelterStatus, hasDocument: boolean): string {
  if (status === "rejected") {
    return hasDocument
      ? "Możesz zastąpić poprzedni dokument nową wersją i poprawić dane profilu przed ponowną weryfikacją."
      : "To konto wymaga poprawionego dokumentu. Prześlij nowy plik, aby zgłoszenie mogło zostać rozpatrzone ponownie.";
  }

  if (status === "pending") {
    return hasDocument
      ? "Dokument został już dodany. W razie potrzeby możesz podmienić go na nowszą wersję przed zakończeniem weryfikacji."
      : "Dodaj dokument weryfikacyjny, aby administrator mógł zakończyć proces sprawdzania konta.";
  }

  return hasDocument
    ? "Możesz zaktualizować dokument potwierdzający działalność schroniska, jeśli wymaga odświeżenia."
    : "Wgraj dokument potwierdzający działalność schroniska (np. KRS, zaświadczenie).";
}

function getRejectionReasonMessage(reason: string | null): string | null {
  const trimmedReason = reason?.trim() ?? "";
  if (!trimmedReason) {
    return null;
  }

  return trimmedReason;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
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

interface FieldProps {
  id: string;
  errorId: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

function Field({ id, errorId, label, required = true, error, children }: FieldProps) {
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
// Main component
// ---------------------------------------------------------------------------

export default function ProfileForm({ profile }: ProfileFormProps) {
  // ---- Form state ----------------------------------------------------------
  const [formData, setFormData] = useState<ProfileFormData>(() => ({
    name: profile.name ?? "",
    city: profile.city ?? "",
    address: profile.address ?? "",
    phone_number: profile.phone_number ?? "",
    website_url: profile.website_url ?? "",
  }));
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // ---- Geocode state -------------------------------------------------------
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeResult, setGeocodeResult] = useState<GeocodeResponseDTO | null>(null);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(profile.location);

  // ---- Document upload state -----------------------------------------------
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFileError, setUploadFileError] = useState<string | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);
  const [currentDocPath, setCurrentDocPath] = useState<string | null>(profile.verification_doc_path);

  // ---- Accessibility IDs ---------------------------------------------------
  const baseId = useId();
  const ids = useMemo(
    () => ({
      name: `${baseId}-name`,
      city: `${baseId}-city`,
      address: `${baseId}-address`,
      phone_number: `${baseId}-phone`,
      website_url: `${baseId}-website`,
    }),
    [baseId]
  );
  const errorIds = useMemo(
    () =>
      Object.fromEntries(Object.entries(ids).map(([k, v]) => [k, `${v}-error`])) as Record<keyof typeof ids, string>,
    [ids]
  );

  // =========================================================================
  // Event handlers — form fields
  // =========================================================================

  const updateFieldValidation = useCallback((field: ProfileFieldName, value: string) => {
    setFieldErrors((prev) => ({
      ...prev,
      [field]: validateProfileField(field, value),
    }));
  }, []);

  const handleFieldChange = useCallback(
    (field: keyof ProfileFormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (field === "address" || field === "city") {
        setGeocodeResult(null);
        setGeocodeError(null);
        setCurrentLocation(null);
      }
      if (!hasSubmitted) return;
      updateFieldValidation(field, value);
    },
    [hasSubmitted, updateFieldValidation]
  );

  const handleFieldBlur = useCallback(
    (field: keyof ProfileFormData) => (e: React.FocusEvent<HTMLInputElement>) => {
      updateFieldValidation(field, e.target.value);
    },
    [updateFieldValidation]
  );

  // =========================================================================
  // Save profile (PATCH /api/profiles/me)
  // =========================================================================

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setHasSubmitted(true);
      setApiError(null);

      const errors = validateProfileForm(formData);
      setFieldErrors(errors);

      if (hasProfileErrors(errors)) {
        const firstErrorKey = (Object.keys(errors) as (keyof ProfileFieldErrors)[]).find((k) => errors[k]);
        if (firstErrorKey && firstErrorKey in ids) {
          const el = document.getElementById(ids[firstErrorKey as keyof typeof ids]);
          el?.focus();
        }
        return;
      }

      setIsSaving(true);
      try {
        const trimmedName = formData.name.trim();
        const trimmedCity = formData.city.trim();
        const trimmedAddress = formData.address.trim();
        const normalizedPhoneNumber = formData.phone_number.trim() ? formData.phone_number.trim() : "";
        const normalizedWebsiteUrl = formData.website_url.trim() ? formData.website_url.trim() : "";

        const command: UpdateProfileCommand = {
          name: trimmedName || undefined,
          city: trimmedCity || undefined,
          address: trimmedAddress || undefined,
          phone_number: normalizedPhoneNumber || null,
          website_url: normalizedWebsiteUrl || null,
        };

        if (geocodeResult && currentLocation) {
          command.location = currentLocation;
        }

        const response = await fetchWithTimeout(
          "/api/profiles/me",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(command),
          },
          SAVE_TIMEOUT_MS
        );

        if (!response.ok) {
          if (response.status === 401) {
            window.location.href = `/auth/login?return=/dashboard/profile`;
            return;
          }
          try {
            const data = (await response.json()) as ErrorResponse;
            setApiError(mapApiErrorCode(data));
          } catch {
            setApiError("Wystąpił nieoczekiwany błąd. Spróbuj ponownie.");
          }
          return;
        }

        const result = (await response.json()) as ProfileUpdateResponseDTO;
        setFormData({
          name: result.name,
          city: result.city,
          address: trimmedAddress,
          phone_number: normalizedPhoneNumber,
          website_url: normalizedWebsiteUrl,
        });
        setCurrentLocation(result.location);
        toast.success("Profil został zapisany pomyślnie.");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setApiError("Przekroczono czas oczekiwania. Sprawdź połączenie i spróbuj ponownie.");
        } else {
          setApiError("Nie można połączyć się z serwerem. Sprawdź połączenie internetowe.");
        }
      } finally {
        setIsSaving(false);
      }
    },
    [currentLocation, formData, geocodeResult, ids]
  );

  // =========================================================================
  // Geocode address (POST /api/profiles/me/geocode)
  // =========================================================================

  const handleGeocode = useCallback(async () => {
    const address = formData.address.trim();
    const city = formData.city.trim();
    if (!address) {
      setGeocodeError("Wpisz adres przed geokodowaniem.");
      return;
    }

    if (!city) {
      setGeocodeError("Wpisz miasto przed geokodowaniem.");
      return;
    }

    setIsGeocoding(true);
    setGeocodeError(null);
    setGeocodeResult(null);

    try {
      const command: GeocodeCommand = {
        address,
        city,
      };
      const response = await fetchWithTimeout(
        "/api/profiles/me/geocode",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        },
        GEOCODE_TIMEOUT_MS
      );

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = `/auth/login?return=/dashboard/profile`;
          return;
        }
        try {
          const data = (await response.json()) as ErrorResponse;
          setGeocodeError(mapGeocodeError(data));
        } catch {
          setGeocodeError("Nie udało się geokodować adresu. Spróbuj ponownie za chwilę.");
        }
        return;
      }

      const result = (await response.json()) as GeocodeResponseDTO;
      setGeocodeResult(result);
      setCurrentLocation(result.location);
      toast.success("Adres został geokodowany pomyślnie.");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setGeocodeError("Przekroczono czas oczekiwania. Spróbuj ponownie.");
      } else {
        setGeocodeError("Nie można połączyć się z serwerem. Sprawdź połączenie internetowe.");
      }
    } finally {
      setIsGeocoding(false);
    }
  }, [formData.address, formData.city]);

  // =========================================================================
  // Document upload (POST /api/profiles/me/verification-document)
  // =========================================================================

  const handleFileSelect = useCallback((file: File | null) => {
    setUploadFile(file);
    setUploadFileError(validateUploadFile(file));
  }, []);

  const handleUpload = useCallback(async () => {
    const err = validateUploadFile(uploadFile);
    setUploadFileError(err);
    if (err || !uploadFile) return;

    setIsUploading(true);
    try {
      const payload = new FormData();
      payload.append("file", uploadFile);

      const response = await fetchWithTimeout(
        "/api/profiles/me/verification-document",
        { method: "POST", body: payload },
        UPLOAD_TIMEOUT_MS
      );

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = `/auth/login?return=/dashboard/profile`;
          return;
        }
        if (response.status === 400) {
          try {
            const data = (await response.json()) as ErrorResponse;
            setUploadFileError(data.error.details?.[0]?.message ?? "Nieprawidłowy plik. Sprawdź format i rozmiar.");
          } catch {
            setUploadFileError("Nieprawidłowy plik. Sprawdź format i rozmiar.");
          }
          return;
        }
        toast.error("Nie udało się przesłać dokumentu. Spróbuj ponownie.");
        return;
      }

      const result = (await response.json()) as VerificationDocumentUploadResponseDTO;
      setCurrentDocPath(result.verification_doc_path);
      setUploadFile(null);
      setUploadFileError(undefined);
      toast.success("Dokument weryfikacyjny został przesłany pomyślnie.");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        toast.error("Przekroczono czas oczekiwania podczas uploadu. Spróbuj ponownie.");
      } else {
        toast.error("Nie można połączyć się z serwerem. Sprawdź połączenie internetowe.");
      }
    } finally {
      setIsUploading(false);
    }
  }, [uploadFile]);

  // =========================================================================
  // Render
  // =========================================================================

  const isAnyLoading = isSaving || isGeocoding || isUploading;
  const verificationDocumentHint = getVerificationDocumentHint(profile.status, Boolean(currentDocPath));
  const rejectionReasonMessage = getRejectionReasonMessage(profile.rejection_reason);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* ── Page heading ── */}
      <div>
        <h2 className="text-2xl font-semibold">Edycja profilu</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Zarządzaj danymi swojego schroniska i dokumentem weryfikacyjnym.
        </p>
      </div>

      {/* ================================================================
          SECTION 1 — Profile data form
      ================================================================ */}
      <section aria-labelledby="profile-section-heading">
        <h3 id="profile-section-heading" className="mb-4 text-base font-semibold">
          Dane profilu
        </h3>

        {/* Read-only info card */}
        <div className="mb-6 grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Status konta</span>
            <Badge variant={statusVariant(profile.status)} className="w-fit">
              {formatStatusLabel(profile.status)}
            </Badge>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Rola</span>
            <span className="text-sm font-medium capitalize">{profile.role}</span>
          </div>
          {profile.nip && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">NIP</span>
              <span className="text-sm font-medium">{profile.nip}</span>
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Data rejestracji</span>
            <span className="text-sm font-medium">{formatDate(profile.created_at)}</span>
          </div>
        </div>

        {profile.status === "rejected" && rejectionReasonMessage && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
            <p className="font-medium">Powód odrzucenia zgłoszenia</p>
            <p className="mt-1">{rejectionReasonMessage}</p>
          </div>
        )}

        {/* Editable form */}
        <form onSubmit={handleSubmit} noValidate aria-label="Formularz edycji profilu">
          {apiError && (
            <div className="mb-4">
              <FormErrorAlert message={apiError} />
            </div>
          )}

          <fieldset className="space-y-4" disabled={isAnyLoading}>
            <legend className="sr-only">Edytowalne dane profilu</legend>

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
              />
            </Field>

            {/* City + Phone — 2 columns on sm+ */}
            <div className="grid gap-4 sm:grid-cols-2">
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
                />
              </Field>

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
                  placeholder="+48123456789"
                  value={formData.phone_number}
                  onChange={handleFieldChange("phone_number")}
                  onBlur={handleFieldBlur("phone_number")}
                  aria-invalid={Boolean(fieldErrors.phone_number)}
                  aria-describedby={fieldErrors.phone_number ? errorIds.phone_number : undefined}
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
              />
            </Field>

            {/* Website — full width */}
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
              />
            </Field>
          </fieldset>

          <div className="mt-6">
            <Button type="submit" disabled={isSaving || isUploading} aria-busy={isSaving}>
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  Zapisywanie…
                </span>
              ) : (
                "Zapisz zmiany"
              )}
            </Button>
          </div>
        </form>
      </section>

      <Separator />

      {/* ================================================================
          SECTION 2 — Geocoding
      ================================================================ */}
      <section aria-labelledby="geocode-section-heading">
        <h3 id="geocode-section-heading" className="mb-1 text-base font-semibold">
          Geokodowanie adresu
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Wyznacz współrzędne geograficzne na podstawie aktualnie wpisanego adresu, aby schronisko pojawiło się na
          mapie.
        </p>

        {/* Current coordinates */}
        {currentLocation && (
          <div className="mb-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            <span className="font-medium">Aktualne współrzędne: </span>
            <span className="font-mono text-muted-foreground">
              {currentLocation.lat.toFixed(6)}, {currentLocation.lon.toFixed(6)}
            </span>
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={handleGeocode}
          disabled={isGeocoding || isAnyLoading || !formData.address.trim() || !formData.city.trim()}
          aria-busy={isGeocoding}
        >
          {isGeocoding ? (
            <span className="flex items-center gap-2">
              <Spinner />
              Geokodowanie…
            </span>
          ) : (
            "Geokoduj adres"
          )}
        </Button>

        {/* Geocode result */}
        {geocodeResult && (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm"
          >
            <p className="font-medium text-green-800">Adres zidentyfikowany:</p>
            <p className="text-green-700">{geocodeResult.formatted_address}</p>
            <p className="mt-1 font-mono text-xs text-green-600">
              {geocodeResult.location.lat.toFixed(6)}, {geocodeResult.location.lon.toFixed(6)}
            </p>
          </div>
        )}

        {/* Geocode error */}
        {geocodeError && (
          <p role="alert" aria-live="assertive" className="mt-2 text-sm text-destructive">
            {geocodeError}
          </p>
        )}

        {currentLocation && (
          <ProfileLocationPreviewMap location={currentLocation} formattedAddress={geocodeResult?.formatted_address} />
        )}
      </section>

      <Separator />

      {/* ================================================================
          SECTION 3 — Verification document upload
      ================================================================ */}
      <section aria-labelledby="doc-section-heading">
        <h3 id="doc-section-heading" className="mb-1 text-base font-semibold">
          Dokument weryfikacyjny
        </h3>
        <p className="mb-2 text-sm text-muted-foreground">
          {verificationDocumentHint} Akceptowane formaty: PDF, JPG, PNG (maks. 5 MB).
        </p>

        {profile.status !== "verified" && (
          <p
            className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            role="status"
          >
            Do czasu zatwierdzenia konta możesz aktualizować profil i dokument, ale dodawanie oraz edycja potrzeb są
            zablokowane.
          </p>
        )}

        {/* Current document status */}
        <div className="mb-4 flex items-center gap-2 text-sm">
          {currentDocPath ? (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 shrink-0 text-green-600"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-green-700">Dokument wgrany</span>
              <span className="text-muted-foreground">({currentDocPath.split("/").pop()})</span>
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-muted-foreground">Brak wgranego dokumentu</span>
            </>
          )}
        </div>

        {/* File dropzone */}
        <FileUploadDropzone
          file={uploadFile}
          onFileSelect={handleFileSelect}
          error={uploadFileError}
          disabled={isUploading || isSaving}
        />

        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleUpload}
            disabled={!uploadFile || Boolean(uploadFileError) || isUploading || isSaving}
            aria-busy={isUploading}
          >
            {isUploading ? (
              <span className="flex items-center gap-2">
                <Spinner />
                Wysyłanie…
              </span>
            ) : (
              "Wyślij dokument"
            )}
          </Button>
        </div>
      </section>
    </div>
  );
}
