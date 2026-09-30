"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Download,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/src/shared/components/ui/button";
import { Input } from "@/src/shared/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/shared/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/shared/components/ui/alert-dialog";
import { trpc } from "@/src/lib/trpc/client";
import {
  chatToMarkdown,
  downloadMarkdown,
  slugifyTitle,
  type ExportableMessage,
} from "../lib/export-markdown";

interface ChatActionsMenuProps {
  chatId: string;
  title: string;
  /** Header = full menu (rename/delete/export). Row = rename/delete only. */
  variant: "header" | "row";
  /** Absent on list rows, which never load messages — so no Export item. */
  messages?: ExportableMessage[];
  projectName?: string | null;
  /** True when this is the open chat: deleting it navigates away. */
  isActive?: boolean;
  onRenamed?: (title: string) => void;
  onDeleted?: () => void;
}

export function ChatActionsMenu({
  chatId,
  title,
  variant,
  messages,
  projectName,
  isActive = false,
  onRenamed,
  onDeleted,
}: ChatActionsMenuProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const renameMutation = trpc.chat.rename.useMutation({
    onSuccess: (data) => {
      if (!data.renamed) {
        toast.error("Chat not found — it may already be gone");
        return;
      }
      const next = draft.trim();
      toast.success("Chat renamed");
      onRenamed?.(next);
      setRenaming(false);
    },
    onError: (err) => {
      // Stay in rename mode so the user can fix and retry.
      toast.error(err.message || "Could not rename chat");
    },
  });

  const deleteMutation = trpc.chat.delete.useMutation({
    onSuccess: (data) => {
      if (!data.deleted) {
        toast.error("Chat not found — it may already be gone");
        return;
      }
      toast.success("Chat deleted");
      setConfirmOpen(false);
      void utils.chat.getAll.invalidate();
      onDeleted?.();
      if (isActive) {
        router.push("/chat");
        router.refresh();
      }
    },
    onError: (err) => {
      toast.error(err.message || "Could not delete chat");
      setConfirmOpen(false);
    },
  });

  const startRename = () => {
    setDraft(title);
    setRenaming(true);
  };

  const submitRename = () => {
    const next = draft.trim();
    if (!next || next === title) {
      setRenaming(false);
      return;
    }
    renameMutation.mutate({ chatId, title: next });
  };

  const handleExport = () => {
    if (!messages) return;
    try {
      const md = chatToMarkdown({ title, projectName, messages });
      downloadMarkdown(`${slugifyTitle(title)}.md`, md);
      toast.success("Conversation exported as Markdown");
    } catch {
      toast.error("Could not export conversation");
    }
  };

  // Rename mode swaps the trigger for an inline editor, in the same spot.
  // Parent clicks must not leak through: the landing row navigates onClick.
  if (renaming) {
    return (
      <form
        className="flex min-w-0 flex-1 items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          submitRename();
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") setRenaming(false);
          e.stopPropagation();
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // Focus is the edit affordance: this form exists only for the rename.
          autoFocus
          onFocus={(e) => e.target.select()}
          aria-label="New chat title"
          maxLength={255}
          disabled={renameMutation.isPending}
          className="h-7 text-sm"
        />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          aria-label="Save new title"
          disabled={renameMutation.isPending}
          className="h-7 w-7 shrink-0 cursor-pointer"
        >
          {renameMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Cancel rename"
          onClick={() => setRenaming(false)}
          disabled={renameMutation.isPending}
          className="h-7 w-7 shrink-0 cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </form>
    );
  }

  const showExport = variant === "header" && messages && messages.length > 0;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for chat "${title}"`}
            onClick={(e) => e.stopPropagation()}
            className={
              variant === "header"
                ? "h-8 w-8 shrink-0 cursor-pointer"
                : "h-7 w-7 shrink-0 cursor-pointer opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
            }
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              startRename();
            }}
            className="cursor-pointer"
          >
            <Pencil className="mr-2 h-4 w-4" />
            Rename
          </DropdownMenuItem>
          {showExport && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                handleExport();
              }}
              className="cursor-pointer"
            >
              <Download className="mr-2 h-4 w-4" />
              Export as Markdown
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setConfirmOpen(true);
            }}
            disabled={deleteMutation.isPending}
            className="cursor-pointer text-red-500 hover:bg-red-500/10 hover:text-red-600 focus:bg-red-500/10 focus:text-red-600"
          >
            {deleteMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete “{title}”? The conversation and
              its messages are gone for good. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate({ chatId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete chat"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
