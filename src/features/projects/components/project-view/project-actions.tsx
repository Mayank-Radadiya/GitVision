"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { trpc } from "@/src/lib/trpc/client";
import { isSearchableIndexingStatus } from "@/src/lib/indexing-status";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/shared/components/ui/alert-dialog";

export function useProjectActionController(
  projectId: string,
  status?: string | null,
) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const chatLock = useRef(false);
  const syncLock = useRef(false);
  const deleteLock = useRef(false);
  const deleteTrigger = useRef<HTMLElement | null>(null);
  const remove = trpc.project.delete.useMutation({
    onSuccess: () => {
      setDeleteOpen(false);
      void utils.project.getAll.invalidate();
      void utils.project.getDashboardData.invalidate();
      toast.success("Project deleted");
      router.push("/dashboard");
      router.refresh();
    },
    onError: (error) =>
      toast.error(error.message || "Couldn’t delete this project"),
    onSettled: () => {
      deleteLock.current = false;
    },
  });
  const sync = trpc.project.resync.useMutation({
    onSuccess: () => {
      void utils.project.getDetails.invalidate({ projectId });
      toast.success("File sync queued. It runs in the background.");
    },
    onError: (error) => toast.error(error.message || "Couldn’t start sync"),
    onSettled: () => {
      syncLock.current = false;
    },
  });
  const chat = trpc.chat.create.useMutation({
    onSuccess: (data) => {
      router.push(`/chat/${data.id}`);
    },
    onError: (error) =>
      toast.error(error.message || "Couldn’t open a project chat"),
    onSettled: () => {
      chatLock.current = false;
    },
  });
  const canAsk = isSearchableIndexingStatus(status ?? "");
  return {
    canAsk,
    asking: chat.isPending,
    syncing: sync.isPending,
    deleting: remove.isPending,
    deleteOpen,
    setDeleteOpen,
    requestDelete: () => {
      const active =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      deleteTrigger.current = active?.closest('[role="menu"]')
        ? document.querySelector<HTMLElement>(
            '[aria-label="Project actions menu"]',
          )
        : active;
      setDeleteOpen(true);
    },
    restoreDeleteFocus: () => {
      if (deleteTrigger.current?.isConnected) deleteTrigger.current.focus();
    },
    confirmDelete: () => {
      if (deleteLock.current || syncLock.current) return;
      deleteLock.current = true;
      remove.mutate({ projectId });
    },
    syncProject: () => {
      if (syncLock.current || deleteLock.current) return;
      syncLock.current = true;
      sync.mutate({ projectId });
    },
    askAI: () => {
      if (!canAsk || chatLock.current || deleteLock.current) return;
      chatLock.current = true;
      chat.mutate({ type: "project", projectId });
    },
  };
}

type ProjectActions = ReturnType<typeof useProjectActionController>;
const ActionsContext = createContext<ProjectActions | null>(null);
export function useProjectActions() {
  const actions = useContext(ActionsContext);
  if (!actions)
    throw new Error("Project actions require ProjectActionsProvider");
  return actions;
}

export function ProjectActionsProvider({
  actions,
  projectName,
  children,
}: {
  actions: ProjectActions;
  projectName: string;
  children: ReactNode;
}) {
  return (
    <ActionsContext.Provider value={actions}>
      {children}
      <AlertDialog
        open={actions.deleteOpen}
        onOpenChange={(open) => {
          if (!actions.deleting) actions.setDeleteOpen(open);
        }}
      >
        <AlertDialogContent
          className="project-workspace"
          overlayClassName="project-workspace bg-black/35 backdrop-blur-none"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            actions.restoreDeleteFocus();
          }}
          onEscapeKeyDown={(e) => {
            if (actions.deleting) e.preventDefault();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes {projectName} and its project data from
              GitVision. Your GitHub repository will remain available.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actions.deleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={actions.confirmDelete}
              disabled={actions.deleting || actions.syncing}
            >
              {actions.deleting ? "Deleting…" : "Delete project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ActionsContext.Provider>
  );
}
