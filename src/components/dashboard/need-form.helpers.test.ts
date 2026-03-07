import { describe, expect, it } from "vitest";

import { mapNeedFormErrorDetails } from "./need-form.helpers";

describe("mapNeedFormErrorDetails", () => {
  it("keeps the first error message for a supported field", () => {
    const result = mapNeedFormErrorDetails([
      { field: "title", message: "Pierwszy blad" },
      { field: "title", message: "Drugi blad" },
      { field: "unknown_field", message: "Ignoruj" },
      { field: "unit", message: "Brak jednostki" },
    ]);

    expect(result).toEqual({
      title: "Pierwszy blad",
      unit: "Brak jednostki",
    });
  });
});
