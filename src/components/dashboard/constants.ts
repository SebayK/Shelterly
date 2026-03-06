import type { NeedCategory, NeedUnit, ShelterStatus, UrgencyLevel } from "@/types";

export const CRUD_DISABLED_REASON =
  "Twoje konto nie jest jeszcze zweryfikowane. Akcje CRUD pozostają zablokowane do czasu aktywacji konta.";

export const CRUD_DISABLED_SHORT_HINT = "Akcje odblokują się po weryfikacji konta schroniska.";

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
