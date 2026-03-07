// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import VerificationDocumentPreview from "./VerificationDocumentPreview";
import type { VerificationDocumentState } from "./types";

function renderPreview(state: VerificationDocumentState) {
  const onRetry = vi.fn();
  const onDownload = vi.fn();

  render(
    <VerificationDocumentPreview state={state} shelterName="Azyl Testowy" onRetry={onRetry} onDownload={onDownload} />
  );

  return { onRetry, onDownload };
}

describe("VerificationDocumentPreview", () => {
  it("renders a neutral message while the preview is being prepared", () => {
    renderPreview({
      status: "idle",
      objectUrl: null,
      contentType: null,
      fileName: null,
      errorMessage: null,
    });

    expect(screen.getByText(/Przygotowujemy podgląd dokumentu weryfikacyjnego/i)).toBeTruthy();
  });

  it("renders a retry action for error state", () => {
    const { onRetry } = renderPreview({
      status: "error",
      objectUrl: null,
      contentType: null,
      fileName: null,
      errorMessage: "Błąd pobierania",
    });

    fireEvent.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));

    expect(screen.getByText("Błąd pobierania")).toBeTruthy();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders pdf preview with download action", () => {
    const { onDownload } = renderPreview({
      status: "success",
      objectUrl: "blob:pdf-preview",
      contentType: "application/pdf",
      fileName: "verification.pdf",
      errorMessage: null,
    });

    const frame = screen.getByTitle("Podgląd dokumentu weryfikacyjnego schroniska Azyl Testowy");

    expect(frame.getAttribute("src")).toBe("blob:pdf-preview");

    fireEvent.click(screen.getByRole("button", { name: "Pobierz dokument" }));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it("renders image preview with refresh action", () => {
    const { onRetry } = renderPreview({
      status: "success",
      objectUrl: "blob:image-preview",
      contentType: "image/png",
      fileName: "verification.png",
      errorMessage: null,
    });

    const image = screen.getByAltText("Dokument weryfikacyjny schroniska Azyl Testowy");
    expect(image.getAttribute("src")).toBe("blob:image-preview");

    fireEvent.click(screen.getByRole("button", { name: "Odśwież podgląd" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("falls back to download-only messaging for unsupported formats", () => {
    const { onRetry, onDownload } = renderPreview({
      status: "unsupported",
      objectUrl: "blob:doc-preview",
      contentType: "application/msword",
      fileName: "verification.doc",
      errorMessage: null,
    });

    expect(screen.getByText(/Tego typu pliku nie można podejrzeć bezpośrednio w panelu/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Pobierz dokument" }));
    fireEvent.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));

    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
