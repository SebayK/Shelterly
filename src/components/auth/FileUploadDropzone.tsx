import { useRef, useState, useCallback, useId } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FileUploadDropzoneProps {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  error?: string;
  disabled?: boolean;
  /** Forwarded ref attached to the interactive dropzone div (for programmatic focus). */
  dropzoneRef?: React.RefObject<HTMLDivElement | null>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FileUploadDropzone({
  file,
  onFileSelect,
  error,
  disabled,
  dropzoneRef,
}: FileUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const baseId = useId();
  const inputId = `${baseId}-file`;
  const errorId = `${baseId}-file-error`;
  const descId = `${baseId}-file-desc`;

  const processFile = useCallback(
    (selected: File | null) => {
      onFileSelect(selected);
    },
    [onFileSelect]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      setIsDragOver(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      setIsDragOver(false);
      const dropped = e.dataTransfer.files[0] ?? null;
      processFile(dropped);
    },
    [disabled, processFile]
  );

  const handleClick = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        inputRef.current?.click();
      }
    },
    [disabled]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0] ?? null;
      processFile(selected);
      // Reset input value so selecting the same file again triggers onChange
      e.target.value = "";
    },
    [processFile]
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      processFile(null);
    },
    [processFile]
  );

  const hasError = Boolean(error);

  return (
    <div ref={dropzoneRef} tabIndex={-1} className="space-y-1 focus:outline-none">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="sr-only"
        onChange={handleInputChange}
        disabled={disabled}
        aria-describedby={hasError ? errorId : descId}
        aria-invalid={hasError}
        tabIndex={-1}
      />

      {file ? (
        /* Selected file preview */
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* File type icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                clipRule="evenodd"
              />
            </svg>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            aria-label="Usuń wybrany plik"
            className="ml-2 shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      ) : (
        /* Dropzone area */
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Obszar wgrywania dokumentu. Naciśnij Enter lub Spację, aby wybrać plik."
          aria-describedby={`${descId}${hasError ? ` ${errorId}` : ""}`}
          aria-disabled={disabled}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={[
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
            isDragOver
              ? "border-primary bg-primary/5"
              : hasError
                ? "border-destructive bg-destructive/5 hover:border-destructive/80"
                : "border-border bg-background hover:border-primary/50 hover:bg-muted/30",
            disabled ? "cursor-not-allowed opacity-50" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {/* Upload icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-8 w-8 text-muted-foreground"
            aria-hidden="true"
          >
            <path d="M4 16.5v1A2.5 2.5 0 006.5 20h11a2.5 2.5 0 002.5-2.5v-1" />
            <path d="M16 8l-4-4-4 4" />
            <path d="M12 4v12" />
          </svg>

          <div className="space-y-1">
            <p className="text-sm font-medium">
              {isDragOver ? "Upuść plik tutaj" : "Przeciągnij plik lub kliknij, aby wybrać"}
            </p>
            <p id={descId} className="text-xs text-muted-foreground">
              PDF, JPG lub PNG, max 5 MB
            </p>
          </div>
        </div>
      )}

      {/* Error message */}
      {hasError && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
