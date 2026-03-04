import { describe, it, expect } from "vitest";
import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  validateName,
  validateNip,
  validateCity,
  validateAddress,
  validatePhone,
  validateWebsite,
  validateFile,
  validateAll,
  hasErrors,
  ACCEPTED_FILE_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "./register.schemas";

// ---------------------------------------------------------------------------
// validateEmail
// ---------------------------------------------------------------------------

describe("validateEmail", () => {
  it("returns error for empty string", () => {
    expect(validateEmail("")).toBe("Adres e-mail jest wymagany.");
    expect(validateEmail("   ")).toBe("Adres e-mail jest wymagany.");
  });

  it("returns error for invalid format", () => {
    expect(validateEmail("notanemail")).toBeDefined();
    expect(validateEmail("@no-local.com")).toBeDefined();
    expect(validateEmail("no-at-sign")).toBeDefined();
  });

  it("returns error for email exceeding 255 chars", () => {
    // 250 'a' + '@b.pl' = 255 chars -> no error; we need >255
    const long = "a".repeat(251) + "@b.pl"; // 256 chars
    expect(validateEmail(long)).toBe("Adres e-mail może mieć maksymalnie 255 znaków.");
  });

  it("returns undefined for valid email", () => {
    expect(validateEmail("user@example.com")).toBeUndefined();
    expect(validateEmail("shelter+tag@org.pl")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validatePassword
// ---------------------------------------------------------------------------

describe("validatePassword", () => {
  it("returns error for empty value", () => {
    expect(validatePassword("")).toBe("Hasło jest wymagane.");
  });

  it("returns error when too short (<8)", () => {
    expect(validatePassword("Ab1!")).toBe("Hasło musi mieć co najmniej 8 znaków.");
  });

  it("returns error when too long (>128)", () => {
    const long = "Aa1!" + "x".repeat(126);
    expect(validatePassword(long)).toBe("Hasło może mieć maksymalnie 128 znaków.");
  });

  it("returns error when missing lowercase", () => {
    expect(validatePassword("ABCDEF1!")).toBeDefined();
  });

  it("returns error when missing uppercase", () => {
    expect(validatePassword("abcdef1!")).toBeDefined();
  });

  it("returns error when missing digit", () => {
    expect(validatePassword("Abcdef!!")).toBeDefined();
  });

  it("returns error when missing special char", () => {
    expect(validatePassword("Abcdef12")).toBeDefined();
  });

  it("returns undefined for valid password", () => {
    expect(validatePassword("Secure!23")).toBeUndefined();
    expect(validatePassword("P@ssw0rd")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validateConfirmPassword
// ---------------------------------------------------------------------------

describe("validateConfirmPassword", () => {
  it("returns error when confirm is empty", () => {
    expect(validateConfirmPassword("Test!1ab", "")).toBe("Powtórzenie hasła jest wymagane.");
  });

  it("returns error when passwords do not match", () => {
    expect(validateConfirmPassword("Test!1ab", "Different!1")).toBe("Hasła nie są identyczne.");
  });

  it("returns undefined when passwords match", () => {
    expect(validateConfirmPassword("Test!1ab", "Test!1ab")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validateName
// ---------------------------------------------------------------------------

describe("validateName", () => {
  it("returns error for empty / whitespace", () => {
    expect(validateName("")).toBeDefined();
    expect(validateName("   ")).toBeDefined();
  });

  it("returns error when too short after trim", () => {
    expect(validateName("A")).toBeDefined();
  });

  it("returns error when exceeds 255 chars", () => {
    expect(validateName("A".repeat(256))).toBeDefined();
  });

  it("returns undefined for valid name", () => {
    expect(validateName("Schronisko")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validateNip
// ---------------------------------------------------------------------------

describe("validateNip", () => {
  it("returns error for empty value", () => {
    expect(validateNip("")).toBe("NIP jest wymagany.");
  });

  it("returns error when not 10 digits", () => {
    expect(validateNip("12345")).toBeDefined();
    expect(validateNip("1234567891a")).toBeDefined();
  });

  it("returns error for invalid checksum", () => {
    // 1234567890: digits=[1,2,3,4,5,6,7,8,9,0]
    // sum = 6*1+5*2+7*3+2*4+3*5+4*6+5*7+6*8+7*9 = 6+10+21+8+15+24+35+48+63 = 230
    // 230 % 11 = 10, last digit = 0 → checksum mismatch → invalid
    expect(validateNip("1234567890")).toBeDefined();
  });

  it("returns undefined for a known valid NIP", () => {
    // NIP 5260250274 — valid Polish NIP
    expect(validateNip("5260250274")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validateCity
// ---------------------------------------------------------------------------

describe("validateCity", () => {
  it("returns error for empty value", () => {
    expect(validateCity("")).toBeDefined();
  });

  it("returns error for single char", () => {
    expect(validateCity("A")).toBeDefined();
  });

  it("returns error when exceeds 100 chars", () => {
    expect(validateCity("A".repeat(101))).toBeDefined();
  });

  it("returns undefined for valid city", () => {
    expect(validateCity("Warszawa")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validateAddress
// ---------------------------------------------------------------------------

describe("validateAddress", () => {
  it("returns error for too short address", () => {
    expect(validateAddress("ab")).toBeDefined();
  });

  it("returns undefined for valid address", () => {
    expect(validateAddress("ul. Testowa 1")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validatePhone
// ---------------------------------------------------------------------------

describe("validatePhone", () => {
  it("returns undefined for empty (optional field)", () => {
    expect(validatePhone("")).toBeUndefined();
    expect(validatePhone("   ")).toBeUndefined();
  });

  it("returns error for invalid format", () => {
    expect(validatePhone("abc")).toBeDefined();
    expect(validatePhone("12")).toBeDefined();
  });

  it("returns undefined for valid phone", () => {
    expect(validatePhone("+48 123 456 789")).toBeUndefined();
    expect(validatePhone("123456789")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validateWebsite
// ---------------------------------------------------------------------------

describe("validateWebsite", () => {
  it("returns undefined for empty (optional field)", () => {
    expect(validateWebsite("")).toBeUndefined();
  });

  it("returns error for invalid URL", () => {
    expect(validateWebsite("not a url")).toBeDefined();
    expect(validateWebsite("ftp//bad")).toBeDefined();
  });

  it("returns undefined for valid URL", () => {
    expect(validateWebsite("https://schronisko.pl")).toBeUndefined();
    expect(validateWebsite("http://example.com/path?q=1")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validateFile
// ---------------------------------------------------------------------------

// Minimal mock of the File shape used by validateFile (name, type, size).
// Avoids allocating large Blobs in Node tests for size-boundary checks.
function makeFile(name: string, type: string, size: number): File {
  return { name, type, size } as File;
}

describe("validateFile", () => {
  it("returns error when no file", () => {
    expect(validateFile(null)).toBe("Dokument weryfikacyjny jest wymagany.");
  });

  it("returns error for unsupported type", () => {
    const file = makeFile("doc.txt", "text/plain", 100);
    expect(validateFile(file)).toBe("Akceptowane formaty: PDF, JPG, PNG.");
  });

  it("returns error when file exceeds 5 MB", () => {
    const file = makeFile("large.pdf", "application/pdf", MAX_FILE_SIZE_BYTES + 1);
    expect(validateFile(file)).toBe("Plik nie może przekraczać 5 MB.");
  });

  it("returns undefined for valid PDF", () => {
    const file = makeFile("doc.pdf", "application/pdf", 1024);
    expect(validateFile(file)).toBeUndefined();
  });

  it("returns undefined for valid JPEG", () => {
    const file = makeFile("photo.jpg", "image/jpeg", 2048);
    expect(validateFile(file)).toBeUndefined();
  });

  it("accepts all listed ACCEPTED_FILE_TYPES", () => {
    ACCEPTED_FILE_TYPES.forEach((type) => {
      const file = makeFile("file", type, 100);
      expect(validateFile(file)).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// validateAll / hasErrors
// ---------------------------------------------------------------------------

describe("validateAll + hasErrors", () => {
  const validData = {
    email: "user@example.com",
    password: "Secure!23",
    confirmPassword: "Secure!23",
    name: "Moje Schronisko",
    nip: "5260250274",
    city: "Warszawa",
    address: "ul. Testowa 10",
    phone_number: "",
    website_url: "",
    file: makeFile("doc.pdf", "application/pdf", 1024),
  };

  it("has no errors for fully valid data", () => {
    const errors = validateAll(validData);
    expect(hasErrors(errors)).toBe(false);
  });

  it("reports errors for missing required fields", () => {
    const errors = validateAll({ ...validData, email: "", name: "" });
    expect(errors.email).toBeDefined();
    expect(errors.name).toBeDefined();
    expect(errors.password).toBeUndefined();
  });

  it("hasErrors returns true when any field has error", () => {
    expect(hasErrors({ email: "błąd" })).toBe(true);
  });

  it("hasErrors returns false for empty object", () => {
    expect(hasErrors({})).toBe(false);
  });
});
