import type { ErrorResponse, Pagination, PendingShelterListItemDTO } from "@/types";
import type { AdminPaginationVM, PendingShelterRowVM, ShelterReviewVM } from "./types";

const IMAGE_DOCUMENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PREVIEWABLE_DOCUMENT_TYPES = new Set(["application/pdf", ...IMAGE_DOCUMENT_TYPES]);

function sanitizeDownloadFileName(fileName: string): string | null {
  const normalizedFileName = fileName
    .split("")
    .filter((character) => {
      const charCode = character.charCodeAt(0);
      return charCode >= 32 && charCode !== 127;
    })
    .join("")
    .replace(/[\\/]+/g, "-")
    .trim();

  const segments = normalizedFileName.split("-").map((segment) => segment.trim());
  const safeFileName = segments
    .filter((segment) => segment.length > 0 && segment !== "." && segment !== "..")
    .join("-")
    .replace(/\s+/g, " ")
    .trim();

  return safeFileName || null;
}

export class AdminRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: string[]
  ) {
    super(message);
    this.name = "AdminRequestError";
  }
}

const dateFormatter = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatPendingShelterRow(shelter: PendingShelterListItemDTO): PendingShelterRowVM {
  const hasVerificationDocument = Boolean(shelter.verification_doc_path);

  return {
    id: shelter.id,
    name: shelter.name?.trim() || "Brak nazwy",
    nip: shelter.nip?.trim() || "Brak NIP",
    city: shelter.city?.trim() || "Brak miasta",
    email: shelter.email,
    createdAt: shelter.created_at,
    createdAtLabel: formatDateTime(shelter.created_at),
    hasVerificationDocument,
    documentStatusLabel: hasVerificationDocument ? "Dokument dostępny" : "Brak dokumentu",
  };
}

export function formatShelterReview(shelter: PendingShelterListItemDTO): ShelterReviewVM {
  return {
    id: shelter.id,
    name: shelter.name?.trim() || "Brak nazwy",
    nip: shelter.nip?.trim() || "Brak NIP",
    city: shelter.city?.trim() || "Brak miasta",
    email: shelter.email,
    createdAt: shelter.created_at,
    createdAtLabel: formatDateTime(shelter.created_at),
    verificationDocumentPath: shelter.verification_doc_path,
    hasVerificationDocument: Boolean(shelter.verification_doc_path),
  };
}

export function formatAdminPagination(pagination: Pagination, page: number): AdminPaginationVM {
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));
  const from = pagination.total === 0 ? 0 : pagination.offset + 1;
  const to = pagination.total === 0 ? 0 : Math.min(pagination.offset + pagination.limit, pagination.total);

  return {
    total: pagination.total,
    page,
    pageSize: pagination.limit,
    totalPages,
    from,
    to,
  };
}

export function getPendingSheltersErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const maybeError = payload as Partial<ErrorResponse>;
  return maybeError.error?.message || fallback;
}

export function formatDateTime(value: string): string {
  return dateFormatter.format(new Date(value));
}

export function createAdminRequestError(payload: unknown, fallback: string, status: number): AdminRequestError {
  if (!payload || typeof payload !== "object") {
    return new AdminRequestError(fallback, status);
  }

  const maybeError = payload as Partial<ErrorResponse>;
  const details = maybeError.error?.details?.map((detail) => detail.message);
  const message = details?.[0] || maybeError.error?.message || fallback;

  return new AdminRequestError(message, status, maybeError.error?.code, details);
}

export function parseContentDispositionFileName(headerValue: string | null): string | null {
  if (!headerValue) {
    return null;
  }

  const filenameStarMatch = headerValue.match(/filename\*=UTF-8''([^;]+)/i);

  if (filenameStarMatch?.[1]) {
    try {
      return sanitizeDownloadFileName(decodeURIComponent(filenameStarMatch[1]));
    } catch {
      return sanitizeDownloadFileName(filenameStarMatch[1]);
    }
  }

  const filenameMatch = headerValue.match(/filename="?([^";]+)"?/i);
  return sanitizeDownloadFileName(filenameMatch?.[1] ?? "");
}

export function isPreviewableDocumentType(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }

  return PREVIEWABLE_DOCUMENT_TYPES.has(contentType);
}

export function isImageDocumentType(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }

  return IMAGE_DOCUMENT_TYPES.has(contentType);
}

export function validateRejectionReason(value: string): string | null {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return "Powód odrzucenia jest wymagany.";
  }

  if (trimmedValue.length < 3) {
    return "Powód odrzucenia musi mieć co najmniej 3 znaki.";
  }

  if (trimmedValue.length > 500) {
    return "Powód odrzucenia nie może przekraczać 500 znaków.";
  }

  return null;
}
