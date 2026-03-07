import type {
  PendingShelterListItemDTO,
  ShelterStatusUpdateResponseDTO,
  UpdateShelterStatusCommand,
  UserRole,
} from "@/types";

export interface AdminPageUserVM {
  id: string;
  name: string | null;
  role: Extract<UserRole, "super_admin">;
}

export interface PendingShelterRowVM {
  id: string;
  name: string;
  nip: string;
  city: string;
  email: string;
  createdAt: string;
  createdAtLabel: string;
  hasVerificationDocument: boolean;
  documentStatusLabel: string;
}

export interface ShelterReviewVM {
  id: string;
  name: string;
  nip: string;
  city: string;
  email: string;
  createdAt: string;
  createdAtLabel: string;
  verificationDocumentPath: string | null;
  hasVerificationDocument: boolean;
}

export interface AdminPaginationVM {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  from: number;
  to: number;
}

export type AdminReviewDecision = "verified" | "rejected";

export interface VerificationDocumentState {
  status: "idle" | "loading" | "success" | "error" | "unsupported" | "missing";
  objectUrl: string | null;
  contentType: string | null;
  fileName: string | null;
  errorMessage: string | null;
}

export interface ReviewActionState {
  isSubmitting: boolean;
  pendingDecision: AdminReviewDecision | null;
}

export interface AdminListFiltersVM {
  page: number;
  pageSize: number;
}

export interface AdminPendingSheltersViewProps {
  currentUser: AdminPageUserVM;
}

export interface AdminPendingSheltersHeaderProps {
  pendingCount: number;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export interface PendingSheltersTableProps {
  rows: PendingShelterRowVM[];
  selectedShelterId: string | null;
  isLoading: boolean;
  onSelect: (shelterId: string) => void;
}

export interface PendingSheltersPaginationProps {
  pagination: AdminPaginationVM;
  isPending: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export interface VerificationDocumentPreviewProps {
  state: VerificationDocumentState;
  shelterName: string;
  onRetry: () => void;
  onDownload: () => void;
}

export interface ShelterReviewPanelProps {
  open: boolean;
  shelter: ShelterReviewVM | null;
  documentState: VerificationDocumentState;
  actionState: ReviewActionState;
  onOpenChange: (open: boolean) => void;
  onApprove: () => void;
  onReject: () => void;
  onRetryDocument: () => void;
  onDownloadDocument: () => void;
  actionsDisabledReason?: string;
}

export interface ShelterStatusConfirmationDialogProps {
  open: boolean;
  mode: AdminReviewDecision | null;
  shelterName: string | null;
  rejectionReason: string;
  rejectionReasonError: string | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onRejectionReasonChange: (value: string) => void;
  onConfirm: () => void;
}

export interface UseAdminPendingSheltersResult {
  shelters: PendingShelterListItemDTO[];
  rows: PendingShelterRowVM[];
  pagination: AdminPaginationVM | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface UseShelterVerificationDocumentOptions {
  shelterId: string | null;
  verificationDocumentPath: string | null;
  enabled: boolean;
}

export interface UseShelterVerificationDocumentResult {
  documentState: VerificationDocumentState;
  retry: () => void;
  download: () => void;
}

export interface UpdateShelterStatusArgs {
  shelterId: string;
  command: UpdateShelterStatusCommand;
}

export interface UseUpdateShelterStatusResult {
  updateStatus: (args: UpdateShelterStatusArgs) => Promise<ShelterStatusUpdateResponseDTO>;
  isPending: boolean;
  errorMessage: string | null;
}
