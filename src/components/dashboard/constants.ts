import type { NeedCategory, NeedUnit, ShelterStatus, UrgencyLevel } from "@/types";

const CRUD_DISABLED_REASONS: Record<Exclude<ShelterStatus, "verified">, string> = {
  pending:
    "Twoje konto oczekuje na weryfikację. Uzupełnij profil i dołącz dokument, a akcje CRUD odblokują się po zatwierdzeniu zgłoszenia.",
  rejected:
    "Twoje konto zostało odrzucone. Popraw dane profilu i prześlij dokument ponownie, aby odzyskać dostęp do zarządzania potrzebami.",
  suspended:
    "Twoje konto zostało zawieszone. Zarządzanie potrzebami pozostaje zablokowane do czasu wyjaśnienia sprawy z administratorem.",
};

const CRUD_DISABLED_SHORT_HINTS: Record<Exclude<ShelterStatus, "verified">, string> = {
  pending: "Najpierw dokończ weryfikację konta schroniska.",
  rejected: "Popraw profil i wyślij dokument ponownie, aby odblokować akcje.",
  suspended: "Konto jest zawieszone. Akcje są tymczasowo niedostępne.",
};

export function getCrudDisabledReason(status: ShelterStatus): string | null {
  if (status === "verified") {
    return null;
  }

  return CRUD_DISABLED_REASONS[status];
}

export function getCrudDisabledShortHint(status: ShelterStatus): string | null {
  if (status === "verified") {
    return null;
  }

  return CRUD_DISABLED_SHORT_HINTS[status];
}

export const ACCOUNT_STATUS_LABELS: Record<ShelterStatus, string> = {
  pending: "Oczekujące",
  verified: "Zweryfikowane",
  suspended: "Zawieszone",
  rejected: "Odrzucone",
};

export const NEED_CATEGORY_LABELS: Record<NeedCategory, string> = {
  food: "Żywność",
  textiles: "Tekstylia",
  cleaning: "Środki czystości",
  medical: "Medyczne",
  toys: "Zabawki",
  other: "Inne",
};

export const NEED_UNIT_LABELS: Record<NeedUnit, string> = {
  pcs: "szt.",
  kg: "kg",
  g: "g",
  l: "l",
  ml: "ml",
  pack: "opak.",
};

export const URGENCY_CONFIG: Record<UrgencyLevel, { label: string; className: string }> = {
  low: { label: "Niska", className: "bg-slate-100 text-slate-700 border-slate-200" },
  normal: { label: "Normalna", className: "bg-sky-100 text-sky-700 border-sky-200" },
  high: { label: "Wysoka", className: "bg-amber-100 text-amber-800 border-amber-200" },
  urgent: { label: "Pilna", className: "bg-orange-100 text-orange-800 border-orange-200" },
  critical: { label: "Krytyczna", className: "bg-rose-100 text-rose-800 border-rose-200" },
};
