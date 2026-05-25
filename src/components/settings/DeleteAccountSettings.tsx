// CAREERFLOW: Phase 3 (PR #9) — Settings → Account panel. Hard account deletion
// behind a type-your-email gate plus a final confirmation dialog. On success it
// signs the user out and redirects to /signin.
"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { AlertTriangle, Loader2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { toast } from "../ui/use-toast";
import { getCurrentUserEmail } from "@/actions/auth.actions";

export default function DeleteAccountSettings() {
  const [email, setEmail] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getCurrentUserEmail().then(setEmail);
  }, []);

  const matches =
    email !== null && typed.trim().toLowerCase() === email.trim().toLowerCase();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/settings/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: typed }),
      });
      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          message = body.error ?? message;
        } catch {
          // non-JSON error
        }
        throw new Error(message);
      }
      // Data is gone — clear the session and leave the dashboard.
      await signOut({ callbackUrl: "/signin" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't delete account",
        description: err instanceof Error ? err.message : "Unknown error",
      });
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Delete account
          </CardTitle>
          <CardDescription>
            Permanently deletes your account and <strong>all</strong> associated
            data — jobs, emails, resumes, tasks, activities, API keys, and
            connected integrations. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-email">
              Type your email{" "}
              {email ? (
                <span className="font-mono">({email})</span>
              ) : null}{" "}
              to confirm
            </Label>
            <Input
              id="confirm-email"
              autoComplete="off"
              placeholder="you@example.com"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={!matches || deleting}>
                {deleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <AlertTriangle className="mr-2 h-4 w-4" />
                )}
                Delete my account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes your account and every record tied to
                  it. There is no recovery. Consider exporting your data first
                  (Settings → Data).
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete();
                  }}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, delete everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
