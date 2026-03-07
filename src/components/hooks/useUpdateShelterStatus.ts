import { useCallback, useState } from "react";
import { createAdminRequestError } from "@/components/admin/admin.helpers";
import { fetchWithTimeout, redirectToAdminDashboard, redirectToAdminLogin } from "@/components/admin/request.helpers";
import type { UpdateShelterStatusArgs, UseUpdateShelterStatusResult } from "@/components/admin/types";
import type { ShelterStatusUpdateResponseDTO } from "@/types";

export function useUpdateShelterStatus(): UseUpdateShelterStatusResult {
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateStatus = useCallback(async ({ shelterId, command }: UpdateShelterStatusArgs) => {
    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetchWithTimeout(`/api/admin/shelters/${shelterId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(command),
      });

      if (response.status === 401) {
        redirectToAdminLogin();
        throw new Error("Sesja wygasła. Zaloguj się ponownie.");
      }

      if (response.status === 403) {
        redirectToAdminDashboard();
        throw new Error("Brak uprawnień do panelu administracyjnego.");
      }

      if (!response.ok) {
        let payload: unknown = null;

        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        throw createAdminRequestError(payload, "Nie udało się zapisać decyzji administracyjnej.", response.status);
      }

      return (await response.json()) as ShelterStatusUpdateResponseDTO;
    } catch (error) {
      const nextErrorMessage =
        error instanceof Error ? error.message : "Nie udało się zapisać decyzji administracyjnej.";
      setErrorMessage(nextErrorMessage);
      throw error;
    } finally {
      setIsPending(false);
    }
  }, []);

  return {
    updateStatus,
    isPending,
    errorMessage,
  };
}
