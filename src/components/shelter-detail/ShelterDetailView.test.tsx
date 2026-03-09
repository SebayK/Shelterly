// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShelterDetailView } from "./ShelterDetailView";

describe("ShelterDetailView", () => {
  it("renders the public empty state when a shelter has no needs", () => {
    render(<ShelterDetailView needs={[]} />);

    expect(screen.getByRole("heading", { name: "Brak potrzeb" })).toBeTruthy();
    expect(screen.getByText("To schronisko nie ma obecnie żadnych potrzeb.")).toBeTruthy();
  });
});
