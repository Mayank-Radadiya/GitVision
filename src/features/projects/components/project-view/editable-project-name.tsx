"use client";

import { useId, useState } from "react";
import { Check, Pencil, X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { trpc } from "@/src/lib/trpc/client";
import { projectRenameSchema } from "@/src/lib/validation/schemas";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

export default function EditableProjectName({
  projectId,
  name,
  compact = false,
}: {
  projectId: string;
  name: string;
  compact?: boolean;
}) {
  const errorId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const rename = trpc.project.rename.useMutation({
    onMutate: async ({ projectName }) => {
      await utils.project.getDetails.cancel({ projectId });
      const previous = utils.project.getDetails.getData({ projectId });
      utils.project.getDetails.setData({ projectId }, (data) =>
        data ? { ...data, projectName } : data,
      );
      return { previous };
    },
    onError: (failure, _input, context) => {
      if (context?.previous)
        utils.project.getDetails.setData({ projectId }, context.previous);
      setError(failure.message);
      toast.error(
        failure.message || "Couldn’t rename this project. Try again.",
      );
    },
    onSettled: () => {
      void utils.project.getDetails.invalidate({ projectId });
      void utils.project.getAll.invalidate();
      void utils.project.getDashboardData.invalidate();
    },
  });

  async function save(projectName: string, undoName?: string) {
    const result = projectRenameSchema.safeParse({ projectId, projectName });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    if (
      result.data.projectName ===
      (utils.project.getDetails.getData({ projectId })?.projectName ?? name)
    ) {
      setEditing(false);
      return;
    }
    setError(null);
    try {
      await rename.mutateAsync(result.data);
      setEditing(false);
      if (undoName) {
        toast(
          (notification) => (
            <div className="flex items-center gap-4 text-sm">
              <span>Project renamed</span>
              <button
                className="font-medium underline underline-offset-4 focus-visible:outline-2"
                onClick={() => {
                  toast.dismiss(notification.id);
                  void save(undoName);
                }}
              >
                Undo
              </button>
            </div>
          ),
          { duration: 6000 },
        );
      } else toast.success("Project name restored");
    } catch {
      /* Mutation restores the cache and shows the error. */
    }
  }

  if (!editing)
    return (
      <button
        type="button"
        aria-label={`Rename project ${name}`}
        title="Rename project"
        disabled={rename.isPending}
        onClick={() => {
          setDraft(name);
          setError(null);
          setEditing(true);
        }}
        className="group focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded-md text-left focus-visible:ring-2 focus-visible:outline-none"
      >
        <span
          className={
            compact
              ? "truncate text-sm font-medium"
              : "truncate text-2xl font-semibold tracking-tight sm:text-3xl"
          }
        >
          {name}
        </span>
        <Pencil
          aria-hidden="true"
          className="text-muted-foreground size-3.5 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      </button>
    );
  return (
    <form
      className="min-w-0 space-y-1"
      onSubmit={(event) => {
        event.preventDefault();
        void save(draft, name);
      }}
    >
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          aria-label="Project name"
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          maxLength={255}
          value={draft}
          disabled={rename.isPending}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setEditing(false);
            }
          }}
          className="min-w-0"
        />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          aria-label="Save project name"
          disabled={rename.isPending}
        >
          {rename.isPending ? <Loader2 className="animate-spin" /> : <Check />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Cancel rename"
          disabled={rename.isPending}
          onClick={() => setEditing(false)}
        >
          <X />
        </Button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </form>
  );
}
