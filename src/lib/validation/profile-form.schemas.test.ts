import { describe, expect, it } from "vitest";
import {
  ACCEPTED_FILE_TYPES,
  MAX_FILE_SIZE_BYTES,
  hasProfileErrors,
  validateAddress,
  validateCity,
  validateName,
  validatePhone,
  validateProfileField,
  validateProfileForm,
  validateUploadFile,
  validateWebsite,
} from "./profile-form.schemas";

describe("validateName", () => {
  it("returns error for empty value", () => {
    expect(validateName("")).toBe("Nazwa schroniska jest wymagana.");
    expect(validateName("   ")).toBe("Nazwa schroniska jest wymagana.");
  });

  it("returns error for values longer than 255 chars", () => {
    expect(validateName("A".repeat(256))).toBe("Nazwa schroniska może mieć maksymalnie 255 znaków.");
  });

  it("returns undefined for valid value", () => {
    expect(validateName("Schronisko Azyl")).toBeUndefined();
  });
});

describe("validateCity", () => {
  it("returns error for empty value", () => {
    expect(validateCity("")).toBe("Miasto jest wymagane.");
  });

  it("returns error for values longer than 100 chars", () => {
    expect(validateCity("A".repeat(101))).toBe("Nazwa miasta może mieć maksymalnie 100 znaków.");
  });

  it("returns undefined for valid value", () => {
    expect(validateCity("Warszawa")).toBeUndefined();
  });
});

describe("validateAddress", () => {
  it("returns error for empty value", () => {
    expect(validateAddress("")).toBe("Adres jest wymagany.");
  });

  it("returns error for values longer than 500 chars", () => {
    expect(validateAddress("A".repeat(501))).toBe("Adres może mieć maksymalnie 500 znaków.");
  });

  it("returns undefined for valid value", () => {
    expect(validateAddress("ul. Testowa 1, 00-001 Warszawa")).toBeUndefined();
  });
});

describe("validatePhone", () => {
  it("returns undefined for empty value", () => {
    expect(validatePhone("")).toBeUndefined();
    expect(validatePhone("   ")).toBeUndefined();
  });

  it("returns error for values longer than 20 chars", () => {
    expect(validatePhone(`+${"1".repeat(20)}`)).toBe("Numer telefonu może mieć maksymalnie 20 znaków.");
  });

  it("returns error for invalid format", () => {
    expect(validatePhone("123 456 789")).toBe("Podaj poprawny numer telefonu (np. +48123456789 lub 48123456789).");
    expect(validatePhone("abc")).toBe("Podaj poprawny numer telefonu (np. +48123456789 lub 48123456789).");
  });

  it("returns undefined for accepted phone formats", () => {
    expect(validatePhone("+48123456789")).toBeUndefined();
    expect(validatePhone("48123456789")).toBeUndefined();
  });
});

describe("validateWebsite", () => {
  it("returns undefined for empty value", () => {
    expect(validateWebsite("")).toBeUndefined();
  });

  it("returns error for invalid URL", () => {
    expect(validateWebsite("not-a-url")).toBe("Podaj poprawny adres URL.");
    expect(validateWebsite("ftp://example.com")).toBe("Podaj poprawny adres URL (http lub https).");
  });

  it("returns error for values longer than 255 chars", () => {
    const longUrl = `https://${"a".repeat(245)}.pl`;
    expect(validateWebsite(longUrl)).toBe("Adres URL może mieć maksymalnie 255 znaków.");
  });

  it("returns undefined for valid URL", () => {
    expect(validateWebsite("https://shelterly.pl")).toBeUndefined();
  });
});

describe("validateProfileField", () => {
  it("dispatches validation based on field name", () => {
    expect(validateProfileField("name", "")).toBe("Nazwa schroniska jest wymagana.");
    expect(validateProfileField("website_url", "https://shelterly.pl")).toBeUndefined();
  });
});

describe("validateUploadFile", () => {
  it("returns undefined for missing file", () => {
    expect(validateUploadFile(null)).toBeUndefined();
  });

  it("returns error for unsupported file type", () => {
    const file = new File(["hello"], "document.gif", { type: "image/gif" });
    expect(validateUploadFile(file)).toBe("Akceptowane formaty: PDF, JPG, PNG.");
  });

  it("returns error for files larger than 5 MB", () => {
    const file = new File([new Uint8Array(MAX_FILE_SIZE_BYTES + 1)], "document.pdf", {
      type: "application/pdf",
    });
    expect(validateUploadFile(file)).toBe("Plik nie może przekraczać 5 MB.");
  });

  it("returns undefined for accepted file types", () => {
    expect(ACCEPTED_FILE_TYPES).toEqual(["application/pdf", "image/jpeg", "image/jpg", "image/png"]);
    const file = new File(["hello"], "document.png", { type: "image/png" });
    expect(validateUploadFile(file)).toBeUndefined();
  });
});

describe("validateProfileForm", () => {
  it("returns field-level errors for invalid payload", () => {
    expect(
      validateProfileForm({
        name: "",
        city: "",
        address: "",
        phone_number: "abc",
        website_url: "not-a-url",
      })
    ).toEqual({
      name: "Nazwa schroniska jest wymagana.",
      city: "Miasto jest wymagane.",
      address: "Adres jest wymagany.",
      phone_number: "Podaj poprawny numer telefonu (np. +48123456789 lub 48123456789).",
      website_url: "Podaj poprawny adres URL.",
    });
  });

  it("returns no errors for valid payload", () => {
    const errors = validateProfileForm({
      name: "Schronisko Azyl",
      city: "Warszawa",
      address: "ul. Testowa 1, 00-001 Warszawa",
      phone_number: "+48123456789",
      website_url: "https://shelterly.pl",
    });

    expect(errors).toEqual({
      name: undefined,
      city: undefined,
      address: undefined,
      phone_number: undefined,
      website_url: undefined,
    });
    expect(hasProfileErrors(errors)).toBe(false);
  });

  it("detects when at least one validation error is present", () => {
    expect(
      hasProfileErrors({
        name: undefined,
        city: "Miasto jest wymagane.",
      })
    ).toBe(true);
  });
});
