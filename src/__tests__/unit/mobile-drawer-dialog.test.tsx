import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileDrawer } from "@/src/features/dashboard/components/sidebar/components/SidebarMobile";

function renderDrawer(isOpen = true) {
  const onClose = vi.fn();
  render(
    <>
      <p>Page content</p>
      <MobileDrawer isOpen={isOpen} onClose={onClose}>
        <button type="button">Sign out</button>
      </MobileDrawer>
    </>,
  );
  return { onClose };
}

describe("MobileDrawer", () => {
  it("is a named modal dialog that hides the page behind it", () => {
    renderDrawer();

    expect(screen.getByRole("dialog")).toHaveAccessibleName("Navigation menu");
    // Radix marks everything outside the dialog as hidden rather than setting
    // aria-modal, so that is what "modal" means here.
    expect(
      screen.getByText("Page content").closest("[aria-hidden='true']"),
    ).not.toBeNull();
  });

  it("moves focus inside itself when it opens", () => {
    renderDrawer();

    expect(screen.getByRole("dialog")).toContainElement(
      document.activeElement as HTMLElement,
    );
  });

  it("closes on Escape", () => {
    const { onClose } = renderDrawer();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });

  it("closes when the close button is pressed", () => {
    const { onClose } = renderDrawer();

    fireEvent.click(
      screen.getByRole("button", { name: "Close navigation menu" }),
    );

    expect(onClose).toHaveBeenCalled();
  });
});
