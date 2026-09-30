import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { init } = vi.hoisted(() => ({ init: vi.fn() }));

vi.mock("posthog-js", () => ({ default: { init } }));

vi.mock("@vercel/analytics/next", () => ({
  Analytics: () => <div data-testid="analytics" />,
}));

async function load() {
  vi.resetModules();
  const { default: ProductAnalytics } = await import(
    "@/src/shared/components/product-analytics"
  );
  return ProductAnalytics;
}

describe("product analytics", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    init.mockReset();
  });

  it("stays inert in development even with a key present", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_dev");
    const ProductAnalytics = await load();

    const { container, queryByTestId } = render(<ProductAnalytics />);

    expect(queryByTestId("analytics")).toBeNull();
    expect(container).toBeEmptyDOMElement();
    expect(init).not.toHaveBeenCalled();
  });

  it("stays inert under test even with a key present", async () => {
    // Vitest runs as NODE_ENV=test. This is the assertion that keeps a
    // developer's .env.local key from turning the unit suite into a
    // PostHog event source.
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    const ProductAnalytics = await load();

    const { queryByTestId } = render(<ProductAnalytics />);

    expect(queryByTestId("analytics")).toBeNull();
    expect(init).not.toHaveBeenCalled();
  });

  it("mounts Vercel Analytics but skips PostHog when the key is absent", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    const ProductAnalytics = await load();

    const { queryByTestId } = render(<ProductAnalytics />);

    expect(queryByTestId("analytics")).not.toBeNull();
    expect(init).not.toHaveBeenCalled();
  });

  it("initialises PostHog once, with SPA pageview capture", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_prod");
    const ProductAnalytics = await load();

    const first = render(<ProductAnalytics />);
    render(<ProductAnalytics />);
    first.unmount();

    await waitFor(() => expect(init).toHaveBeenCalledTimes(1));
    expect(init).toHaveBeenCalledWith("phc_prod", {
      api_host: "https://us.i.posthog.com",
      capture_pageview: "history_change",
    });
  });
});
