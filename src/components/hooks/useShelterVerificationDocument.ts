import { useCallback, useEffect, useRef, useState } from "react";
import {
  AdminRequestError,
  createAdminRequestError,
  isPreviewableDocumentType,
  parseContentDispositionFileName,
} from "@/components/admin/admin.helpers";
import { fetchWithTimeout, redirectToAdminDashboard, redirectToAdminLogin } from "@/components/admin/request.helpers";
import type {
  UseShelterVerificationDocumentOptions,
  UseShelterVerificationDocumentResult,
  VerificationDocumentState,
} from "@/components/admin/types";

const idleState: VerificationDocumentState = {
  status: "idle",
  objectUrl: null,
  contentType: null,
  fileName: null,
  errorMessage: null,
};

export function useShelterVerificationDocument({
  shelterId,
  verificationDocumentPath,
  enabled,
}: UseShelterVerificationDocumentOptions): UseShelterVerificationDocumentResult {
  const [documentState, setDocumentState] = useState<VerificationDocumentState>(
    verificationDocumentPath ? idleState : { ...idleState, status: "missing" }
  );
  const [retryToken, setRetryToken] = useState(0);
  const objectUrlRef = useRef<string | null>(null);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      revokeObjectUrl();
      setDocumentState(verificationDocumentPath ? idleState : { ...idleState, status: "missing" });
      return;
    }

    if (!shelterId) {
      revokeObjectUrl();
      setDocumentState(idleState);
      return;
    }

    if (!verificationDocumentPath) {
      revokeObjectUrl();
      setDocumentState({ ...idleState, status: "missing" });
      return;
    }

    const controller = new AbortController();

    setDocumentState((currentState) => ({
      ...currentState,
      status: "loading",
      errorMessage: null,
    }));

    void fetchWithTimeout(`/api/admin/shelters/${shelterId}/verification-document`, {
      method: "GET",
      headers: {
        Accept: "*/*",
      },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          let payload: unknown = null;

          try {
            payload = await response.json();
          } catch {
            payload = null;
          }

          throw createAdminRequestError(payload, "Nie udało się pobrać dokumentu weryfikacyjnego.", response.status);
        }

        const blob = await response.blob();
        const contentType = response.headers.get("Content-Type") || blob.type || null;
        const fileName =
          parseContentDispositionFileName(response.headers.get("Content-Disposition")) || "verification-document";
        const objectUrl = URL.createObjectURL(blob);

        revokeObjectUrl();
        objectUrlRef.current = objectUrl;

        setDocumentState({
          status: isPreviewableDocumentType(contentType) ? "success" : "unsupported",
          objectUrl,
          contentType,
          fileName,
          errorMessage: null,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof AdminRequestError && error.status === 401) {
          redirectToAdminLogin();
          return;
        }

        if (error instanceof AdminRequestError && error.status === 403) {
          redirectToAdminDashboard();
          return;
        }

        revokeObjectUrl();

        const errorMessage =
          error instanceof AdminRequestError && error.status === 404
            ? "Dokument weryfikacyjny nie został znaleziony."
            : error instanceof Error
              ? error.message
              : "Nie udało się pobrać dokumentu weryfikacyjnego.";

        setDocumentState({
          ...idleState,
          status: "error",
          errorMessage,
        });
      });

    return () => {
      controller.abort();
    };
  }, [enabled, retryToken, revokeObjectUrl, shelterId, verificationDocumentPath]);

  useEffect(() => () => revokeObjectUrl(), [revokeObjectUrl]);

  const retry = useCallback(() => {
    setRetryToken((currentValue) => currentValue + 1);
  }, []);

  const download = useCallback(() => {
    if (!documentState.objectUrl) {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = documentState.objectUrl;
    anchor.download = documentState.fileName || "verification-document";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }, [documentState.fileName, documentState.objectUrl]);

  return {
    documentState,
    retry,
    download,
  };
}
