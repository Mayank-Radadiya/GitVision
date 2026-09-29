import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SparklesCore } from "@/shared/components/animation/sparkles";

type Frame = { id: number; cb: FrameRequestCallback };

let context2d: {
  scale: ReturnType<typeof vi.fn>;
  clearRect: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  arc: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
  fillStyle: string;
  globalAlpha: number;
};

let frames: Frame[];
let nextId: number;
let cancelled: number[];
let observers: { callback: IntersectionObserverCallback; elements: Element[] }[];
let motionListeners: ((event: MediaQueryListEvent) => void)[];
let reducedMotion: boolean;
let hidden: boolean;

/** Runs every frame the component has pending, like the browser would. */
function flushFrame() {
  const pending = frames.splice(0, frames.length);
  for (const frame of pending) {
    if (cancelled.includes(frame.id)) continue;
    frame.cb(0);
  }
}

function setIntersecting(isIntersecting: boolean) {
  act(() => {
    for (const observer of observers) {
      observer.callback(
        observer.elements.map(
          (target) => ({ isIntersecting, target }) as IntersectionObserverEntry,
        ),
        {} as IntersectionObserver,
      );
    }
  });
}

function setTabHidden(value: boolean) {
  hidden = value;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

beforeEach(() => {
  frames = [];
  nextId = 1;
  cancelled = [];
  observers = [];
  motionListeners = [];
  reducedMotion = false;
  hidden = false;

  context2d = {
    scale: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillStyle: "",
    globalAlpha: 0,
  };

  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context2d as unknown as CanvasRenderingContext2D,
  );

  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = nextId++;
    frames.push({ id, cb });
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    cancelled.push(id);
  });

  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        observers.push({ callback, elements: [] });
      }
      observe(element: Element) {
        observers[observers.length - 1].elements.push(element);
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );

  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return reducedMotion;
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      motionListeners.push(listener);
    },
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));

  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SparklesCore", () => {
  it("observes its own canvas so an off-screen section can be paused", () => {
    render(<SparklesCore />);
    expect(observers).toHaveLength(1);
    expect(observers[0].elements[0].tagName).toBe("CANVAS");
  });

  it("stops the loop when the tab is hidden and resumes when it comes back", () => {
    render(<SparklesCore />);
    expect(frames).toHaveLength(1);

    setTabHidden(true);
    flushFrame();
    expect(frames).toHaveLength(0);

    setTabHidden(false);
    flushFrame();
    expect(frames).toHaveLength(1);
  });

  it("stops the loop when the canvas scrolls out of view", () => {
    render(<SparklesCore />);
    setIntersecting(false);
    flushFrame();
    expect(frames).toHaveLength(0);

    setIntersecting(true);
    flushFrame();
    expect(frames).toHaveLength(1);
  });

  it("cancels its animation frame on unmount", () => {
    const { unmount } = render(<SparklesCore />);
    const pending = frames[0].id;

    unmount();

    expect(cancelled).toContain(pending);
    flushFrame();
    expect(frames).toHaveLength(0);
  });

  it("does not animate when the user prefers reduced motion", () => {
    reducedMotion = true;
    render(<SparklesCore />);
    expect(frames).toHaveLength(0);
  });

  it("stops when the user switches on reduced motion and resumes when they switch it off", () => {
    render(<SparklesCore />);
    expect(frames).toHaveLength(1);

    act(() => {
      reducedMotion = true;
      for (const listener of motionListeners) listener({} as MediaQueryListEvent);
    });
    flushFrame();
    expect(frames).toHaveLength(0);

    act(() => {
      reducedMotion = false;
      for (const listener of motionListeners) listener({} as MediaQueryListEvent);
    });
    flushFrame();
    expect(frames).toHaveLength(1);
  });

  it("caps the particle count per frame", () => {
    render(<SparklesCore />);
    flushFrame();
    // The density formula saturates its cap on any viewport at least
    // 80x smaller than the default 100, so this is the real per-frame cost.
    expect(context2d.arc.mock.calls.length).toBeLessThanOrEqual(300);
  });
});
