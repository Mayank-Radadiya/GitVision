"use client";

/**
 * Danger Zone — self-serve account deletion.
 *
 * Two gates, deliberately unequal in weight:
 *  - the disabled button, so the phrase is not mistyped into a live request;
 *  - `z.literal` on the server, which is the one that actually decides.
 *
 * The client gate is a courtesy, not a control. Anything that can reach the
 * mutation can bypass the disabled attribute, and the server accepts exactly
 * one string and nothing else.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import { trpc } from "@/src/lib/trpc/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

/** Must match `DELETE_CONFIRMATION` in the user router's `deleteAccount`. */
const CONFIRMATION_PHRASE = "delete my account";

export default function DangerZoneSection() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  const armed = confirmation === CONFIRMATION_PHRASE;

  const remove = trpc.user.deleteAccount.useMutation({
    onSuccess: () => {
      // The account is gone; leaving a dead user's theme in localStorage would
      // repaint the next person to sign in on a shared machine.
      localStorage.removeItem("theme");
      toast.success("Account deleted.");
      setOpen(false);
      router.push("/sign-in");
      router.refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setConfirmation("");
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Danger Zone</CardTitle>
        <CardDescription>
          Deleting your account is permanent. Your repositories, chat history
          and embeddings are removed with it and cannot be recovered.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Delete account
        </Button>

        <AlertDialog open={open} onOpenChange={handleOpenChange}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This signs you out everywhere and permanently erases your
                account, projects and credit history. To confirm, type{" "}
                <span className="text-foreground font-mono">
                  {CONFIRMATION_PHRASE}
                </span>{" "}
                below.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-2">
              <Label htmlFor="delete-confirmation">Confirmation</Label>
              <Input
                id="delete-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={CONFIRMATION_PHRASE}
                autoComplete="off"
                disabled={remove.isPending}
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={remove.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={!armed || remove.isPending}
                onClick={(event) => {
                  // Keep the dialog open while the mutation runs so a failure
                  // leaves the user in front of the error, not an empty page.
                  event.preventDefault();
                  // Sent as the constant, not the field: the button only arms
                  // when the two are equal, and the constant is what the
                  // server's `z.literal` is typed against.
                  remove.mutate({ confirmation: CONFIRMATION_PHRASE });
                }}
              >
                {remove.isPending ? "Deleting…" : "Delete permanently"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
