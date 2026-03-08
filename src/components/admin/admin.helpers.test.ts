import { describe, expect, it } from "vitest";

import { parseContentDispositionFileName } from "./admin.helpers";

describe("parseContentDispositionFileName", () => {
  it("returns null when the header is missing", () => {
    expect(parseContentDispositionFileName(null)).toBeNull();
  });

  it("parses and decodes filename* values", () => {
    expect(parseContentDispositionFileName("attachment; filename*=UTF-8''verification%20document.pdf")).toBe(
      "verification document.pdf"
    );
  });

  it("sanitizes traversal-like path separators from filenames", () => {
    expect(parseContentDispositionFileName('attachment; filename="../../secret.pdf"')).toBe("secret.pdf");
    expect(parseContentDispositionFileName('attachment; filename="..\\..\\secret.pdf"')).toBe("secret.pdf");
  });

  it("removes control characters from filenames", () => {
    expect(parseContentDispositionFileName('attachment; filename="safe\u0000name.pdf"')).toBe("safename.pdf");
  });

  it("returns null when sanitization removes the whole filename", () => {
    expect(parseContentDispositionFileName('attachment; filename="../.."')).toBeNull();
  });
});
