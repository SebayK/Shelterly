import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { FormErrorAlert } from "@/components/auth/FormErrorAlert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  hasNeedFormErrors,
  type NeedFormMode,
  type NeedFormValidationErrors,
  validateNeedField,
  validateNeedForm,
} from "@/lib/validation/need-form.schemas";
import type { ErrorResponse, NeedCreateResponseDTO, NeedDetailDTO, NeedUpdateResponseDTO } from "@/types";
import {
  buildCreateNeedCommand,
  buildUpdateNeedCommand,
  createEmptyNeedForm,
  mapCreateResponseToForm,
  mapNeedDetailToForm,
  mapNeedFormApiError,
  mapNeedFormErrorDetails,
  NEED_CATEGORY_OPTIONS,
  NEED_UNIT_OPTIONS,
  NEED_URGENCY_OPTIONS,
  normalizeNeedFormData,
} from "./need-form.helpers";
import { fetchWithTimeout, redirectToDashboardLogin } from "./request.helpers";
import AIGenerateButton from "./AIGenerateButton";
import type { NeedFormData, NeedFormDialogProps } from "./types";

const SAVE_TIMEOUT_MS = 15_000;
const DETAIL_TIMEOUT_MS = 15_000;

export default function NeedFormDialog({
  open,
  onOpenChange,
  mode,
  initialData,
  shelterId: _shelterId,
  onSuccess,
  aiUsageCount,
  aiUsageLimit,
  onAiUsageIncremented,
}: NeedFormDialogProps) {
  const [effectiveMode, setEffectiveMode] = useState<NeedFormMode>(mode);
  const [currentNeedId, setCurrentNeedId] = useState<string | undefined>(initialData?.id);
  const [formData, setFormData] = useState<NeedFormData>(createEmptyNeedForm);
  const [initialFormData, setInitialFormData] = useState<NeedFormData>(createEmptyNeedForm);
  const [fieldErrors, setFieldErrors] = useState<NeedFormValidationErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const baseId = useId();

  const fieldIds = useMemo(
    () => ({
      category: `${baseId}-category`,
      title: `${baseId}-title`,
      description: `${baseId}-description`,
      shopping_url: `${baseId}-shopping-url`,
      urgency: `${baseId}-urgency`,
      target_quantity: `${baseId}-target-quantity`,
      current_quantity: `${baseId}-current-quantity`,
      unit: `${baseId}-unit`,
    }),
    [baseId]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setEffectiveMode(mode);
    setCurrentNeedId(initialData?.id);
    setFieldErrors({});
    setApiError(null);
    setHasSubmitted(false);

    if (mode === "create" || !initialData?.id) {
      const emptyForm = createEmptyNeedForm();
      setFormData(emptyForm);
      setInitialFormData(emptyForm);
      return;
    }

    const loadDetail = async () => {
      setIsLoadingDetail(true);
      try {
        const response = await fetchWithTimeout(`/api/needs/${initialData.id}`, {}, DETAIL_TIMEOUT_MS);

        if (!response.ok) {
          if (response.status === 401) {
            redirectToDashboardLogin();
            return;
          }

          try {
            const errorData = (await response.json()) as ErrorResponse;
            setApiError(mapNeedFormApiError(errorData));
          } catch {
            setApiError("Nie udało się pobrać danych potrzeby.");
          }
          return;
        }

        const detail = (await response.json()) as NeedDetailDTO;
        const mappedForm = mapNeedDetailToForm(detail);
        setCurrentNeedId(detail.id);
        setFormData(mappedForm);
        setInitialFormData(mappedForm);
      } catch {
        setApiError("Nie udało się pobrać danych potrzeby.");
      } finally {
        setIsLoadingDetail(false);
      }
    };

    void loadDetail();
  }, [initialData?.id, mode, open]);

  const handleFieldChange = (field: keyof NeedFormData, value: string) => {
    const nextData = { ...formData, [field]: value };
    setFormData(nextData);
    if (!hasSubmitted) {
      return;
    }

    setFieldErrors((current) => ({
      ...current,
      [field]: validateNeedField(field as keyof NeedFormValidationErrors, normalizeNeedFormData(nextData)),
    }));
  };

  const handleFieldBlur = (field: keyof NeedFormData) => {
    setFieldErrors((current) => ({
      ...current,
      [field]: validateNeedField(field as keyof NeedFormValidationErrors, normalizeNeedFormData(formData)),
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmitted(true);
    setApiError(null);

    const validationErrors = validateNeedForm(normalizeNeedFormData(formData));
    setFieldErrors(validationErrors);
    if (hasNeedFormErrors(validationErrors)) {
      return;
    }

    if (effectiveMode === "edit") {
      const updateCommand = buildUpdateNeedCommand(formData, initialFormData);
      if (Object.keys(updateCommand).length === 0) {
        setApiError("Wprowadź przynajmniej jedną zmianę przed zapisaniem.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (effectiveMode === "create") {
        const response = await fetchWithTimeout(
          "/api/needs",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildCreateNeedCommand(formData)),
          },
          SAVE_TIMEOUT_MS
        );

        if (!response.ok) {
          if (response.status === 401) {
            redirectToDashboardLogin();
            return;
          }

          const errorData = (await response.json()) as ErrorResponse;
          setFieldErrors((current) => ({ ...current, ...mapNeedFormErrorDetails(errorData.error.details) }));
          setApiError(mapNeedFormApiError(errorData));
          return;
        }

        const createdNeed = (await response.json()) as NeedCreateResponseDTO;
        const mappedForm = mapCreateResponseToForm(createdNeed);
        setEffectiveMode("edit");
        setCurrentNeedId(createdNeed.id);
        setFormData(mappedForm);
        setInitialFormData(mappedForm);
        setFieldErrors({});
        onSuccess(createdNeed);
        toast.success("Potrzeba została utworzona. Możesz teraz użyć AI.");
        return;
      }

      if (!currentNeedId) {
        setApiError("Brakuje identyfikatora potrzeby do edycji.");
        return;
      }

      const response = await fetchWithTimeout(
        `/api/needs/${currentNeedId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildUpdateNeedCommand(formData, initialFormData)),
        },
        SAVE_TIMEOUT_MS
      );

      if (!response.ok) {
        if (response.status === 401) {
          redirectToDashboardLogin();
          return;
        }

        const errorData = (await response.json()) as ErrorResponse;
        setFieldErrors((current) => ({ ...current, ...mapNeedFormErrorDetails(errorData.error.details) }));
        setApiError(mapNeedFormApiError(errorData));
        return;
      }

      const updatedNeed = (await response.json()) as NeedUpdateResponseDTO;
      setInitialFormData(formData);
      onSuccess(updatedNeed);
      toast.success("Potrzeba została zapisana.");
      onOpenChange(false);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setApiError("Przekroczono czas oczekiwania. Spróbuj ponownie.");
      } else {
        setApiError("Nie udało się zapisać potrzeby. Sprawdź połączenie i spróbuj ponownie.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const dialogTitle = effectiveMode === "create" ? "Dodaj potrzebę" : "Edytuj potrzebę";
  const dialogDescription =
    effectiveMode === "create"
      ? "Uzupełnij podstawowe dane potrzeby. Po zapisaniu od razu odblokujesz generowanie AI."
      : "Zmień szczegóły potrzeby i zapisz tylko te pola, które faktycznie chcesz zaktualizować.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        {apiError && <FormErrorAlert message={apiError} />}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={fieldIds.category}>Kategoria</Label>
              <Select value={formData.category} onValueChange={(value) => handleFieldChange("category", value)}>
                <SelectTrigger id={fieldIds.category} aria-invalid={Boolean(fieldErrors.category)}>
                  <SelectValue placeholder="Wybierz kategorię" />
                </SelectTrigger>
                <SelectContent>
                  {NEED_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.category && <p className="text-sm text-destructive">{fieldErrors.category}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor={fieldIds.urgency}>Pilność</Label>
              <Select value={formData.urgency} onValueChange={(value) => handleFieldChange("urgency", value)}>
                <SelectTrigger id={fieldIds.urgency} aria-invalid={Boolean(fieldErrors.urgency)}>
                  <SelectValue placeholder="Wybierz pilność" />
                </SelectTrigger>
                <SelectContent>
                  {NEED_URGENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.urgency && <p className="text-sm text-destructive">{fieldErrors.urgency}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={fieldIds.title}>Tytuł</Label>
            <Input
              id={fieldIds.title}
              value={formData.title}
              onChange={(event) => handleFieldChange("title", event.target.value)}
              onBlur={() => handleFieldBlur("title")}
              aria-invalid={Boolean(fieldErrors.title)}
              placeholder="Np. Karma sucha dla psów"
            />
            {fieldErrors.title && <p className="text-sm text-destructive">{fieldErrors.title}</p>}
          </div>

          <div
            className={
              effectiveMode === "edit"
                ? "grid gap-5 md:grid-cols-[minmax(0,1fr)_12rem_12rem]"
                : "grid gap-5 md:grid-cols-[minmax(0,1fr)_12rem]"
            }
          >
            <div className="space-y-2">
              <Label htmlFor={fieldIds.target_quantity}>Ilość docelowa</Label>
              <Input
                id={fieldIds.target_quantity}
                inputMode="decimal"
                value={formData.target_quantity}
                onChange={(event) => handleFieldChange("target_quantity", event.target.value)}
                onBlur={() => handleFieldBlur("target_quantity")}
                aria-invalid={Boolean(fieldErrors.target_quantity)}
                placeholder="Np. 120"
              />
              {fieldErrors.target_quantity && <p className="text-sm text-destructive">{fieldErrors.target_quantity}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor={fieldIds.unit}>Jednostka</Label>
              <Select value={formData.unit} onValueChange={(value) => handleFieldChange("unit", value)}>
                <SelectTrigger id={fieldIds.unit} aria-invalid={Boolean(fieldErrors.unit)}>
                  <SelectValue placeholder="Jednostka" />
                </SelectTrigger>
                <SelectContent>
                  {NEED_UNIT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.unit && <p className="text-sm text-destructive">{fieldErrors.unit}</p>}
            </div>

            {effectiveMode === "edit" && (
              <div className="space-y-2">
                <Label htmlFor={fieldIds.current_quantity}>Ilość bieżąca</Label>
                <Input
                  id={fieldIds.current_quantity}
                  inputMode="decimal"
                  value={formData.current_quantity}
                  onChange={(event) => handleFieldChange("current_quantity", event.target.value)}
                  onBlur={() => handleFieldBlur("current_quantity")}
                  aria-invalid={Boolean(fieldErrors.current_quantity)}
                  placeholder="Np. 0"
                />
                {fieldErrors.current_quantity && (
                  <p className="text-sm text-destructive">{fieldErrors.current_quantity}</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Label htmlFor={fieldIds.description}>Opis</Label>
              <AIGenerateButton
                type="description"
                needId={currentNeedId}
                formData={{
                  title: formData.title,
                  category: formData.category,
                  target_quantity: formData.target_quantity
                    ? Number(formData.target_quantity.replace(",", "."))
                    : undefined,
                  unit: formData.unit,
                }}
                onResult={(value) => setFormData((current) => ({ ...current, description: value }))}
                onAiUsageIncremented={onAiUsageIncremented}
                disabled={isLoadingDetail || isSubmitting}
                aiUsageCount={aiUsageCount}
                aiUsageLimit={aiUsageLimit}
              />
            </div>
            <Textarea
              id={fieldIds.description}
              value={formData.description}
              onChange={(event) => handleFieldChange("description", event.target.value)}
              onBlur={() => handleFieldBlur("description")}
              aria-invalid={Boolean(fieldErrors.description)}
              placeholder="Opisz, czego dokładnie potrzebuje schronisko i dlaczego to ważne."
            />
            {fieldErrors.description && <p className="text-sm text-destructive">{fieldErrors.description}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Label htmlFor={fieldIds.shopping_url}>Link zakupowy</Label>
              <AIGenerateButton
                type="shopping_url"
                needId={currentNeedId}
                formData={{ title: formData.title, category: formData.category }}
                onResult={(value) => setFormData((current) => ({ ...current, shopping_url: value }))}
                onAiUsageIncremented={onAiUsageIncremented}
                disabled={isLoadingDetail || isSubmitting}
                aiUsageCount={aiUsageCount}
                aiUsageLimit={aiUsageLimit}
              />
            </div>
            <Input
              id={fieldIds.shopping_url}
              value={formData.shopping_url}
              onChange={(event) => handleFieldChange("shopping_url", event.target.value)}
              onBlur={() => handleFieldBlur("shopping_url")}
              aria-invalid={Boolean(fieldErrors.shopping_url)}
              placeholder="https://..."
            />
            {fieldErrors.shopping_url && <p className="text-sm text-destructive">{fieldErrors.shopping_url}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoadingDetail}>
              {isSubmitting ? "Zapisywanie..." : effectiveMode === "create" ? "Dodaj potrzebę" : "Zapisz zmiany"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
