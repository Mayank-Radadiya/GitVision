"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FolderGit2 } from "lucide-react";

import { trpc } from "@/src/lib/trpc/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/shared/components/ui/command";
import {
  PROJECT_COMMAND_EVENT,
  OPEN_COMMAND_EVENT,
  PROJECT_SECTIONS,
} from "@/features/projects/components/project-view/workspace-navigation";
import { PRIMARY_NAVIGATION } from "./sidebar/sidebar.constants";

/**
 * Every shortcut the app actually handles, with the page each one is scoped to.
 * `⌘K` is this palette. `Esc` is Radix's dialog default and costs nothing to
 * list, but it is listed because a shortcut guide that omits how to get out is
 * worse than none.
 */
const SHORTCUTS: { keys: string; label: string; scope: string }[] = [
  { keys: "⌘K", label: "Open the command palette", scope: "anywhere" },
  { keys: "⌘B", label: "Toggle the sidebar", scope: "anywhere" },
  { keys: "⌘↵", label: "Submit the repository form", scope: "add repository" },
  {
    keys: "1 2 3",
    label: "Fill the React / TypeScript / Tailwind preset",
    scope: "add repository",
  },
  { keys: "Esc", label: "Close this palette", scope: "anywhere" },
];

/**
 * The project fields the palette needs, and the only ones it reads.
 * `getAll` and `getDashboardData` select the same columns, so narrowing to
 * these three is what lets the two sources merge without a cast.
 */
interface PaletteProject {
  id: string;
  projectName: string;
  githubUrl: string;
}

/**
 * Global ⌘K palette. Mounted once by `DashboardShell`, so it covers every route
 * under `app/(main)/` and is always inside the tRPC provider.
 *
 * Both project reads are `enabled: false`. That is the whole design: the hook
 * subscribes to whatever the route already hydrated and can never issue a
 * request of its own, so the palette is guaranteed to be free rather than free
 * by timing. The cost is that a cold route shows no projects — a user who lands
 * on `/chat` first sees navigation and shortcuts only until they visit the
 * dashboard. That is the trade the zero-request rule buys, and hydration
 * (`prefetch` in the page + `HydrateClient`) puts the data there the moment they
 * do.
 */
export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const inProject = /^\/dashboard\/user-project\/[^/]+/.test(pathname);
  const [open, setOpen] = useState(false);

  // Handle keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const openPalette = () => setOpen(true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener(OPEN_COMMAND_EVENT, openPalette);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(OPEN_COMMAND_EVENT, openPalette);
    };
  }, []);

  const { data: dashboard } = trpc.project.getDashboardData.useQuery(
    undefined,
    {
      enabled: false,
    },
  );
  const { data: codeViewerProjects } = trpc.project.getAll.useQuery(undefined, {
    enabled: false,
  });

  // Dashboard first so its rows win the `id` collision; it is the source that
  // hydrates on the app's default landing route.
  const projects = useMemo<PaletteProject[]>(() => {
    const byId = new Map<string, PaletteProject>();
    for (const project of dashboard?.projects ?? [])
      byId.set(project.id, project);
    for (const project of codeViewerProjects ?? []) {
      if (!byId.has(project.id)) byId.set(project.id, project);
    }
    return [...byId.values()];
  }, [dashboard, codeViewerProjects]);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a project or run a command..." />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        {inProject && (
          <CommandGroup heading="This project">
            {PROJECT_SECTIONS.map(({ id, label, icon: Icon }) => (
              <CommandItem
                key={id}
                keywords={["project", "section"]}
                onSelect={() => {
                  setOpen(false);
                  window.dispatchEvent(
                    new CustomEvent(PROJECT_COMMAND_EVENT, { detail: id }),
                  );
                }}
              >
                <Icon />
                Go to {label}
              </CommandItem>
            ))}
            <CommandItem
              onSelect={() => {
                setOpen(false);
                window.dispatchEvent(
                  new CustomEvent(PROJECT_COMMAND_EVENT, { detail: "details" }),
                );
              }}
            >
              <FolderGit2 />
              Open project details<CommandShortcut>Shift D</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        )}

        <CommandGroup heading="Navigation">
          {PRIMARY_NAVIGATION.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem key={item.href} onSelect={() => navigate(item.href)}>
                <Icon />
                {item.name}
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandGroup heading="Projects">
          {projects.length === 0 ? (
            <CommandItem disabled>
              Projects appear here once you have visited the dashboard
            </CommandItem>
          ) : (
            projects.map((project) => (
              <CommandItem
                key={project.id}
                keywords={[project.githubUrl]}
                onSelect={() =>
                  navigate(`/dashboard/user-project/${project.id}`)
                }
              >
                <FolderGit2 />
                {project.projectName}
              </CommandItem>
            ))
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Keyboard Shortcuts">
          {SHORTCUTS.map((shortcut) => (
            <CommandItem key={shortcut.keys} disabled>
              {shortcut.label}
              <span className="text-muted-foreground text-xs">
                {shortcut.scope}
              </span>
              <CommandShortcut>{shortcut.keys}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
