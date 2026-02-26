import { describe, it, expect } from "vitest";
import { CreateNeedSchema, UpdateNeedSchema } from "./needs.schemas";

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

// ---------------------------------------------------------------------------
// UpdateNeedSchema
// ---------------------------------------------------------------------------

describe("UpdateNeedSchema", () => {
  // -------------------------------------------------------------------------
  // Happy path — single fields
  // -------------------------------------------------------------------------

  it("accepts a single valid field (title)", () => {
    const result = UpdateNeedSchema.safeParse({ title: "Nowy tytuł" });
    expect(result.success).toBe(true);
  });

  it("accepts multiple valid fields", () => {
    const result = UpdateNeedSchema.safeParse({
      title: "Nowy tytuł",
      urgency: "high",
      current_quantity: 25,
      target_quantity: 100,
    });
    expect(result.success).toBe(true);
  });

  it("accepts null for description (explicit removal)", () => {
    const result = UpdateNeedSchema.safeParse({ description: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBeNull();
  });

  it("accepts null for shopping_url (explicit removal)", () => {
    const result = UpdateNeedSchema.safeParse({ shopping_url: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.shopping_url).toBeNull();
  });

  it("trims whitespace from title", () => {
    const result = UpdateNeedSchema.safeParse({ title: "  Karma  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe("Karma");
  });

  it("accepts all valid urgency values", () => {
    const urgencies = ["low", "normal", "high", "urgent", "critical"] as const;
    for (const urgency of urgencies) {
      expect(UpdateNeedSchema.safeParse({ urgency }).success).toBe(true);
    }
  });

  it("accepts all valid category values", () => {
    const categories = ["food", "textiles", "cleaning", "medical", "toys", "other"] as const;
    for (const category of categories) {
      expect(UpdateNeedSchema.safeParse({ category }).success).toBe(true);
    }
  });

  it("accepts all valid unit values", () => {
    const units = ["pcs", "kg", "g", "l", "ml", "pack"] as const;
    for (const unit of units) {
      expect(UpdateNeedSchema.safeParse({ unit }).success).toBe(true);
    }
  });

  it("accepts current_quantity of 0 (edge case)", () => {
    const result = UpdateNeedSchema.safeParse({ current_quantity: 0, target_quantity: 50 });
    expect(result.success).toBe(true);
  });

  it("accepts equal current_quantity and target_quantity", () => {
    const result = UpdateNeedSchema.safeParse({ current_quantity: 100, target_quantity: 100 });
    expect(result.success).toBe(true);
  });

  // -------------------------------------------------------------------------
  // At-least-one-field constraint
  // -------------------------------------------------------------------------

  it("rejects empty object (no fields provided)", () => {
    const result = UpdateNeedSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/at least one field/i);
    }
  });

  // -------------------------------------------------------------------------
  // title validation
  // -------------------------------------------------------------------------

  it("rejects title shorter than 3 characters", () => {
    const result = UpdateNeedSchema.safeParse({ title: "ab" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.errors[0].message).toMatch(/3/);
  });

  it("rejects title longer than 255 characters", () => {
    const result = UpdateNeedSchema.safeParse({ title: "a".repeat(256) });
    expect(result.success).toBe(false);
  });

  // -------------------------------------------------------------------------
  // quantity validation
  // -------------------------------------------------------------------------

  it("rejects negative current_quantity", () => {
    const result = UpdateNeedSchema.safeParse({ current_quantity: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects target_quantity of 0", () => {
    const result = UpdateNeedSchema.safeParse({ target_quantity: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative target_quantity", () => {
    const result = UpdateNeedSchema.safeParse({ target_quantity: -5 });
    expect(result.success).toBe(false);
  });

  it("rejects current_quantity exceeding max", () => {
    const result = UpdateNeedSchema.safeParse({ current_quantity: 100_000_000 });
    expect(result.success).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Cross-field quantity validation
  // -------------------------------------------------------------------------

  it("rejects when current_quantity > target_quantity", () => {
    const result = UpdateNeedSchema.safeParse({ current_quantity: 150, target_quantity: 100 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.errors[0].message;
      expect(msg).toMatch(/current_quantity/i);
    }
  });

  it("accepts when current_quantity < target_quantity", () => {
    const result = UpdateNeedSchema.safeParse({ current_quantity: 50, target_quantity: 100 });
    expect(result.success).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Enum validation
  // -------------------------------------------------------------------------

  it("rejects unknown urgency value", () => {
    const result = UpdateNeedSchema.safeParse({ urgency: "extreme" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown category value", () => {
    const result = UpdateNeedSchema.safeParse({ category: "furniture" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown unit value", () => {
    const result = UpdateNeedSchema.safeParse({ unit: "ton" });
    expect(result.success).toBe(false);
  });

  // -------------------------------------------------------------------------
  // URL validation
  // -------------------------------------------------------------------------

  it("rejects invalid URL for shopping_url", () => {
    const result = UpdateNeedSchema.safeParse({ shopping_url: "not-a-url" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.errors[0].message).toMatch(/url/i);
  });

  it("accepts valid HTTPS URL for shopping_url", () => {
    const result = UpdateNeedSchema.safeParse({ shopping_url: "https://example.com/product" });
    expect(result.success).toBe(true);
  });

  // -------------------------------------------------------------------------
  // description validation
  // -------------------------------------------------------------------------

  it("rejects description longer than 2000 characters", () => {
    const result = UpdateNeedSchema.safeParse({ description: "x".repeat(2001) });
    expect(result.success).toBe(false);
  });

  it("accepts description at exactly 2000 characters", () => {
    const result = UpdateNeedSchema.safeParse({ description: "x".repeat(2000) });
    expect(result.success).toBe(true);
  });
});
