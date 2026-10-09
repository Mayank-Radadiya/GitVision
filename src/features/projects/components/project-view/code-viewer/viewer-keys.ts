/**
 * Code Viewer — global key bindings.
 *
 * The viewer is a reading surface people hold for a long time, so the two
 * motions worth a shortcut are "get me to a file" and "get me out of the way".
 * Everything else stays on the pointer.
 *
 * The binding table lives here rather than in the component for two reasons:
 * the shortcut sheet renders it, and `resolveViewerCommand` is pure enough to
 * assert on without mounting anything — including the two cases that matter
 * most, "the user is typing" and "a browser chord is being pressed".
 *
 * Deliberately unbound: `j`/`k`/`g`/`G`/arrows/`Enter`. Those belong to the
 * file tree, which already implements the WAI-ARIA tree key contract; taking
 * them here would mean two owners for one key.
 */

export type ViewerCommand =
  | "open-palette"
  | "focus-search"
  | "toggle-insights"
  | "toggle-rail"
  | "show-shortcuts";

export interface ViewerKeyBinding {
  id: ViewerCommand;
  /** Human label, used by the shortcut sheet. */
  label: string;
  /** Key caps rendered in the sheet. */
  caps: string[];
  description: string;
}

export const VIEWER_KEY_BINDINGS: readonly ViewerKeyBinding[] = [
  {
    id: "open-palette",
    label: "Command palette",
    caps: ["⌘", "K"],
    description: "Jump to any file by path, or run a viewer action.",
  },
  {
    id: "focus-search",
    label: "Search files",
    caps: ["/"],
    description: "Filter the explorer without leaving the keyboard.",
  },
  {
    id: "toggle-insights",
    label: "Index insights",
    caps: ["T"],
    description: "Show or hide the language, token, and entry-point panel.",
  },
  {
    id: "toggle-rail",
    label: "Hide explorer",
    caps: ["⌘", "B"],
    description: "Give the code the full width.",
  },
  {
    id: "show-shortcuts",
    label: "Keyboard shortcuts",
    caps: ["?"],
    description: "Open this list.",
  },
] as const;

/** Standard DOM modifier keys: any of them means this is not a viewer chord. */
function hasModifier(
  input: Pick<ResolveKeyInput, "metaKey" | "ctrlKey" | "altKey">,
): boolean {
  return Boolean(input.metaKey || input.ctrlKey || input.altKey);
}

export interface ResolveKeyInput {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  /**
   * True when the event target is a text field, a contenteditable, or any
   * element that consumes printable keys itself.
   */
  typing: boolean;
}

/**
 * Map one key event to a viewer command, or `null` to let it pass through.
 *
 * `⌘K`/`Ctrl+K` and `⌘B`/`Ctrl+B` are resolved *before* the typing check:
 * opening the palette from inside the explorer's search box is the point of the
 * shortcut. Every other binding is suppressed while typing, because `/` and
 * `T` are ordinary characters in a search query.
 */
export function resolveViewerCommand(
  input: ResolveKeyInput,
): ViewerCommand | null {
  if (hasModifier(input)) {
    const key = input.key.toLowerCase();
    if (key === "k") return "open-palette";
    if (key === "b") return "toggle-rail";
    return null;
  }
  // `typing` is only meaningful without a modifier: a chord is a command
  // wherever it is pressed.
  if (input.typing) return null;

  switch (input.key) {
    case "/":
      return "focus-search";
    case "t":
    case "T":
      return "toggle-insights";
    case "?":
      return "show-shortcuts";
    default:
      return null;
  }
}

/**
 * True when `target` is an element that handles its own key input.
 *
 * `closest` rather than `tagName` because the explorer's search box is an
 * `<input>` inside a wrapper, and a contenteditable subtree can be several
 * nodes deep.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.closest('[contenteditable="true"]') !== null;
}
