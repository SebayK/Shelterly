/**
 * Frontend validation schemas for the Profile Edit form.
 * Mirrors the server-side `UpdateProfileCommandSchema` constraints.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProfileFormData {
  /** Nazwa schroniska — wymagane, 1–255 znaków */
  name: string;
  /** Miasto — wymagane, 1–100 znaków */
  city: string;
  /** Adres — wymagane, 1–500 znaków */
  address: string;
  /** Numer telefonu — opcjonalne, format E.164 (np. +48123456789) */
  phone_number: string;
  /** Adres strony www — opcjonalne, poprawny URL http/https */
  website_url: string;
}

export interface ProfileFieldErrors {
  name?: string;
  city?: string;
  address?: string;
  phone_number?: string;
  website_url?: string;
}

export type ProfileFieldName = keyof ProfileFieldErrors;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** E.164-compatible phone regex (matches the server-side schema) */
const PHONE_E164_REGEX = /^\+?[1-9]\d{1,14}$/;

// ---------------------------------------------------------------------------
// Individual field validators (same constraints as UpdateProfileCommandSchema)
// ---------------------------------------------------------------------------

export function validateName(value: string): string | undefined {
  if (!value.trim()) return "Nazwa schroniska jest wymagana.";
  if (value.trim().length > 255) return "Nazwa schroniska może mieć maksymalnie 255 znaków.";
  return undefined;
}

export function validateCity(value: string): string | undefined {
  if (!value.trim()) return "Miasto jest wymagane.";
  if (value.trim().length > 100) return "Nazwa miasta może mieć maksymalnie 100 znaków.";
  return undefined;
}

export function validateAddress(value: string): string | undefined {
  if (!value.trim()) return "Adres jest wymagany.";
  if (value.trim().length > 500) return "Adres może mieć maksymalnie 500 znaków.";
  return undefined;
}

export function validatePhone(value: string): string | undefined {
  if (!value.trim()) return undefined; // optional
  const normalized = value.trim();
  if (!PHONE_E164_REGEX.test(normalized)) return "Podaj poprawny numer telefonu (format: +48123456789).";
  return undefined;
}

export function validateWebsite(value: string): string | undefined {
  if (!value.trim()) return undefined; // optional
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "Podaj poprawny adres URL (http lub https).";
    }
    if (value.trim().length > 255) return "Adres URL może mieć maksymalnie 255 znaków.";
    return undefined;
  } catch {
    return "Podaj poprawny adres URL.";
  }
}

// ---------------------------------------------------------------------------
// File validators (reused for VerificationDocumentSection)
// ---------------------------------------------------------------------------

export const ACCEPTED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateProfileField(field: ProfileFieldName, value: string): string | undefined {
  switch (field) {
    case "name":
      return validateName(value);
    case "city":
      return validateCity(value);
    case "address":
      return validateAddress(value);
    case "phone_number":
      return validatePhone(value);
    case "website_url":
      return validateWebsite(value);
    default:
      return undefined;
  }
}

export function validateUploadFile(file: File | null): string | undefined {
  if (!file) return undefined; // upload is optional on profile edit
  if (!ACCEPTED_FILE_TYPES.includes(file.type)) return "Akceptowane formaty: PDF, JPG, PNG.";
  if (file.size > MAX_FILE_SIZE_BYTES) return "Plik nie może przekraczać 5 MB.";
  return undefined;
}

// ---------------------------------------------------------------------------
// Full form validator
// ---------------------------------------------------------------------------

export function validateProfileForm(data: ProfileFormData): ProfileFieldErrors {
  return {
    name: validateProfileField("name", data.name),
    city: validateProfileField("city", data.city),
    address: validateProfileField("address", data.address),
    phone_number: validateProfileField("phone_number", data.phone_number),
    website_url: validateProfileField("website_url", data.website_url),
  };
}

export function hasProfileErrors(errors: ProfileFieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}
