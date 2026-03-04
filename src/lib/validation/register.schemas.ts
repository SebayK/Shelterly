// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegisterFormData {
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

export interface RegisterFieldErrors {
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

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_REGEX = /^\+?[0-9\s-]{7,20}$/;
export const ACCEPTED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export function validateEmail(value: string): string | undefined {
  if (!value.trim()) return "Adres e-mail jest wymagany.";
  if (!EMAIL_REGEX.test(value)) return "Podaj poprawny adres e-mail.";
  if (value.length > 255) return "Adres e-mail może mieć maksymalnie 255 znaków.";
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (!value) return "Hasło jest wymagane.";
  if (value.length < 8) return "Hasło musi mieć co najmniej 8 znaków.";
  if (value.length > 128) return "Hasło może mieć maksymalnie 128 znaków.";
  if (!/[a-z]/.test(value)) return "Hasło musi zawierać co najmniej jedną małą literę.";
  if (!/[A-Z]/.test(value)) return "Hasło musi zawierać co najmniej jedną wielką literę.";
  if (!/[0-9]/.test(value)) return "Hasło musi zawierać co najmniej jedną cyfrę.";
  if (!/[^a-zA-Z0-9]/.test(value)) return "Hasło musi zawierać co najmniej jeden znak specjalny.";
  return undefined;
}

export function validateConfirmPassword(password: string, confirm: string): string | undefined {
  if (!confirm) return "Powtórzenie hasła jest wymagane.";
  if (password !== confirm) return "Hasła nie są identyczne.";
  return undefined;
}

export function validateName(value: string): string | undefined {
  if (!value.trim()) return "Nazwa schroniska jest wymagana.";
  if (value.trim().length < 2) return "Nazwa schroniska musi mieć co najmniej 2 znaki.";
  if (value.length > 255) return "Nazwa schroniska może mieć maksymalnie 255 znaków.";
  return undefined;
}

export function validateNip(value: string): string | undefined {
  if (!value.trim()) return "NIP jest wymagany.";
  if (!/^\d{10}$/.test(value)) return "NIP musi składać się z dokładnie 10 cyfr.";

  // Checksum validation: weights [6,5,7,2,3,4,5,6,7]
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const digits = value.split("").map(Number);
  const sum = weights.reduce((acc, w, i) => acc + w * digits[i], 0);
  if (sum % 11 !== digits[9]) return "Podany NIP jest nieprawidłowy (błąd sumy kontrolnej).";

  return undefined;
}

export function validateCity(value: string): string | undefined {
  if (!value.trim()) return "Miasto jest wymagane.";
  if (value.trim().length < 2) return "Miasto musi mieć co najmniej 2 znaki.";
  if (value.length > 100) return "Nazwa miasta może mieć maksymalnie 100 znaków.";
  return undefined;
}

export function validateAddress(value: string): string | undefined {
  if (!value.trim()) return "Adres jest wymagany.";
  if (value.trim().length < 5) return "Adres musi mieć co najmniej 5 znaków.";
  if (value.length > 255) return "Adres może mieć maksymalnie 255 znaków.";
  return undefined;
}

export function validatePhone(value: string): string | undefined {
  if (!value.trim()) return undefined; // optional
  if (!PHONE_REGEX.test(value.trim())) return "Podaj poprawny numer telefonu.";
  return undefined;
}

export function validateWebsite(value: string): string | undefined {
  if (!value.trim()) return undefined; // optional
  try {
    new URL(value.trim());
    return undefined;
  } catch {
    return "Podaj poprawny adres URL.";
  }
}

export function validateFile(file: File | null): string | undefined {
  if (!file) return "Dokument weryfikacyjny jest wymagany.";
  if (!ACCEPTED_FILE_TYPES.includes(file.type)) return "Akceptowane formaty: PDF, JPG, PNG.";
  if (file.size > MAX_FILE_SIZE_BYTES) return "Plik nie może przekraczać 5 MB.";
  return undefined;
}

export function validateAll(data: RegisterFormData): RegisterFieldErrors {
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

export function hasErrors(errors: RegisterFieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}
