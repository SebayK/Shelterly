import { describe, it, expect } from "vitest";
import { CreateNeedSchema } from "./needs.schemas";

/** Minimal valid payload — use as base and override individual fields */
const valid = {
  category: "food",
  title: "Karma sucha dla psów",
  urgency: "normal",
  target_quantity: 100,
  unit: "kg",
} as const;

describe("CreateNeedSchema", () => {
  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it("accepts a fully valid payload", () => {
    const result = CreateNeedSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("accepts optional fields when provided", () => {
    const result = CreateNeedSchema.safeParse({
      ...valid,
      description: "Potrzebujemy karmy dla 20 psów",
      shopping_url: "https://example.com/karma",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("Potrzebujemy karmy dla 20 psów");
      expect(result.data.shopping_url).toBe("https://example.com/karma");
    }
  });

  it("defaults urgency to 'normal' when omitted", () => {
    const { urgency: _u, ...noUrgency } = valid;
    const result = CreateNeedSchema.safeParse(noUrgency);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.urgency).toBe("normal");
  });

  it("transforms missing description/shopping_url to null", () => {
    const result = CreateNeedSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeNull();
      expect(result.data.shopping_url).toBeNull();
    }
  });

  it("trims whitespace from title", () => {
    const result = CreateNeedSchema.safeParse({ ...valid, title: "  Karma  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe("Karma");
  });

  it("accepts all valid category values", () => {
    const categories = ["food", "textiles", "cleaning", "medical", "toys", "other"] as const;
    for (const category of categories) {
      expect(CreateNeedSchema.safeParse({ ...valid, category }).success).toBe(true);
    }
  });

  it("accepts all valid urgency values", () => {
    const urgencies = ["low", "normal", "high", "urgent", "critical"] as const;
    for (const urgency of urgencies) {
      expect(CreateNeedSchema.safeParse({ ...valid, urgency }).success).toBe(true);
    }
  });

  it("accepts all valid unit values", () => {
    const units = ["pcs", "kg", "g", "l", "ml", "pack"] as const;
    for (const unit of units) {
      expect(CreateNeedSchema.safeParse({ ...valid, unit }).success).toBe(true);
    }
  });

  it("accepts target_quantity with up to 2 decimal places", () => {
    expect(CreateNeedSchema.safeParse({ ...valid, target_quantity: 10.55 }).success).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Required fields missing
  // -------------------------------------------------------------------------

  it.each(["category", "title", "target_quantity", "unit"] as const)(
    "rejects when required field '%s' is missing",
    (field) => {
      const { [field]: _omitted, ...rest } = valid;
      const result = CreateNeedSchema.safeParse(rest);
      expect(result.success).toBe(false);
    }
  );

  // -------------------------------------------------------------------------
  // title validation
  // -------------------------------------------------------------------------

  it("rejects title shorter than 3 characters", () => {
    const result = CreateNeedSchema.safeParse({ ...valid, title: "ab" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/3/);
    }
  });

  it("rejects title longer than 255 characters", () => {
    const result = CreateNeedSchema.safeParse({ ...valid, title: "a".repeat(256) });
    expect(result.success).toBe(false);
  });

  // -------------------------------------------------------------------------
  // target_quantity validation
  // -------------------------------------------------------------------------

  it("rejects target_quantity of 0", () => {
    const result = CreateNeedSchema.safeParse({ ...valid, target_quantity: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative target_quantity", () => {
    const result = CreateNeedSchema.safeParse({ ...valid, target_quantity: -5 });
    expect(result.success).toBe(false);
  });

  it("rejects target_quantity exceeding max", () => {
    const result = CreateNeedSchema.safeParse({ ...valid, target_quantity: 100_000_000 });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric target_quantity", () => {
    const result = CreateNeedSchema.safeParse({ ...valid, target_quantity: "sto" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/number/i);
    }
  });

  // -------------------------------------------------------------------------
  // Enum validation
  // -------------------------------------------------------------------------

  it("rejects unknown category value", () => {
    const result = CreateNeedSchema.safeParse({ ...valid, category: "furniture" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown urgency value", () => {
    const result = CreateNeedSchema.safeParse({ ...valid, urgency: "extreme" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown unit value", () => {
    const result = CreateNeedSchema.safeParse({ ...valid, unit: "ton" });
    expect(result.success).toBe(false);
  });

  // -------------------------------------------------------------------------
  // shopping_url validation
  // -------------------------------------------------------------------------

  it("rejects invalid URL format for shopping_url", () => {
    const result = CreateNeedSchema.safeParse({ ...valid, shopping_url: "not-a-url" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/url/i);
    }
  });

  it("accepts null shopping_url explicitly", () => {
    const result = CreateNeedSchema.safeParse({ ...valid, shopping_url: null });
    expect(result.success).toBe(true);
  });

  // -------------------------------------------------------------------------
  // description validation
  // -------------------------------------------------------------------------

  it("rejects description longer than 2000 characters", () => {
    const result = CreateNeedSchema.safeParse({ ...valid, description: "x".repeat(2001) });
    expect(result.success).toBe(false);
  });

  it("accepts null description explicitly", () => {
    const result = CreateNeedSchema.safeParse({ ...valid, description: null });
    expect(result.success).toBe(true);
  });
});
