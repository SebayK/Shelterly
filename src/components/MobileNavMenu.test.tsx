// @vitest-environment jsdom

import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { MobileNavMenu } from "./MobileNavMenu";

function getByDataTestId(value: string) {
  const element = document.querySelector(`[data-test-id="${value}"]`);
  expect(element).toBeTruthy();
  return element as HTMLElement;
}

describe("MobileNavMenu", () => {
  it("renders a mobile login trigger for anonymous users", () => {
    render(<MobileNavMenu user={null} />);

    expect(getByDataTestId("mobile-nav-trigger")).toBeTruthy();
  });

  it("opens the navigation panel and exposes the anonymous login action", async () => {
    const user = userEvent.setup();

    render(<MobileNavMenu user={null} />);

    await user.click(getByDataTestId("mobile-nav-trigger"));

    expect(getByDataTestId("mobile-nav-panel")).toBeTruthy();
    expect(getByDataTestId("mobile-nav-login-button")).toBeTruthy();
  });
});
