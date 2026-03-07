import type {
  AIGenerateDescriptionResponseDTO,
  AIGenerateShoppingLinkResponseDTO,
  CreateNeedCommand,
  NeedCategory,
  NeedCreateResponseDTO,
  NeedDetailDTO,
  NeedDeleteResponseDTO,
  NeedFulfillResponseDTO,
  NeedListItemDTO,
  NeedUnit,
  Pagination,
  ShelterStatus,
  UpdateNeedCommand,
  NeedUpdateResponseDTO,
  UrgencyLevel,
} from "@/types";

export interface NeedsManagerProps {
  profileId: string;
  accountStatus: ShelterStatus;
  aiUsageCount: number;
  aiUsageLimit: number;
}

export interface NeedFormData {
  category: NeedCategory | "";
  title: string;
  description: string;
  shopping_url: string;
  urgency: UrgencyLevel;
  target_quantity: string;
  current_quantity: string;
  unit: NeedUnit | "";
}

export interface NeedFormFieldErrors {
  category?: string;
  title?: string;
  description?: string;
  shopping_url?: string;
  urgency?: string;
  target_quantity?: string;
  current_quantity?: string;
  unit?: string;
}

export interface NeedFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: NeedListItemDTO | null;
  shelterId: string;
  onSuccess: (need: NeedCreateResponseDTO | NeedUpdateResponseDTO) => void;
  aiUsageCount: number;
  aiUsageLimit: number;
  onAiUsageIncremented: () => void;
}

export interface AIGenerateButtonProps {
  type: "description" | "shopping_url";
  needId?: string;
  formData: {
    title: string;
    category: NeedCategory | "";
    target_quantity?: number;
    unit?: NeedUnit | "";
  };
  onResult: (value: string) => void;
  onAiUsageIncremented: () => void;
  disabled: boolean;
  aiUsageCount: number;
  aiUsageLimit: number;
}

export interface NeedDialogState {
  mode: "create" | "edit";
  needId?: string;
  detail?: NeedDetailDTO | null;
}

export type NeedFormSuccessPayload = NeedCreateResponseDTO | NeedUpdateResponseDTO;
export type NeedSubmitCommand = CreateNeedCommand | UpdateNeedCommand;
export type AIGenerationResponse = AIGenerateDescriptionResponseDTO | AIGenerateShoppingLinkResponseDTO;

export interface NeedsToolbarProps {
  totalNeeds: number;
  onAddNeed: () => void;
  isDisabled: boolean;
  disabledReason?: string | null;
}

export interface NeedsTableProps {
  needs: NeedListItemDTO[];
  onEdit: (need: NeedListItemDTO) => void;
  onDelete: (need: NeedListItemDTO) => void;
  onFulfill: (need: NeedListItemDTO) => void;
  isDisabled: boolean;
  disabledReason?: string | null;
}

export interface NeedsTableRowProps {
  need: NeedListItemDTO;
  onEdit: () => void;
  onDelete: () => void;
  onFulfill: () => void;
  isDisabled: boolean;
  disabledReason?: string | null;
}

export interface NeedActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  onFulfill: () => void;
  isDisabled: boolean;
  isFulfilled: boolean;
  disabledReason?: string | null;
}

export interface NeedsTableSkeletonProps {
  rows?: number;
}

export interface NeedsTableEmptyProps {
  onAddNeed: () => void;
  isDisabled: boolean;
  disabledReason?: string | null;
}

export interface NeedsPaginationProps {
  pagination: Pagination;
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export interface DeleteNeedAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  need: NeedListItemDTO | null;
  onConfirm: () => void;
  isDeleting: boolean;
}

export interface FulfillNeedAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  need: NeedListItemDTO | null;
  onConfirm: () => void;
  isFulfilling: boolean;
}

export type NeedDeleteResult = NeedDeleteResponseDTO;
export type NeedFulfillResult = NeedFulfillResponseDTO;
