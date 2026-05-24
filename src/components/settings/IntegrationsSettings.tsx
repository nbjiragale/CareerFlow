// CAREERFLOW: Phase 1 — Settings → Integrations panel. Connect / disconnect
// Gmail, configure classification threshold, and manage the excluded
// email list.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Mail, RefreshCw, Unlink } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import { Badge } from "../ui/badge";
import { toast } from "../ui/use-toast";

interface GmailStatus {
  oauthConfigured: boolean;
  classifier: "huggingface" | "keyword";
  connected: boolean;
  email: string | null;
  lastUsedAt: string | null;
  lastSyncedAt: string | null;
  settings: {
    classificationThreshold: number;
    excludedEmails: string[];
    initialLookbackDays: number;
  };
}

const MIN_THRESHOLD = 0.5;
const MAX_THRESHOLD = 0.95;

function classifierBadge(kind: "huggingface" | "keyword") {
  if (kind === "huggingface") {
    return (
      <Badge variant="secondary">HuggingFace classifier</Badge>
    );
  }
  return (
    <Badge variant="outline">
      Built-in keyword classifier (results land in Needs Review)
    </Badge>
  );
}

function formatTime(value: string | null) {
  if (!value) return "Never";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function IntegrationsSettings() {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [thresholdLocal, setThresholdLocal] = useState<number>(0.7);
  const [excludedLocal, setExcludedLocal] = useState<string>("");

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gmail/status");
      if (!res.ok) throw new Error(`Status request failed (${res.status})`);
      const data: GmailStatus = await res.json();
      setStatus(data);
      setThresholdLocal(data.settings.classificationThreshold);
      setExcludedLocal(data.settings.excludedEmails.join("\n"));
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't load Gmail status",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Surface success/failure of OAuth callback via the ?gmail= query param
  // we redirect to from /api/gmail/callback.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const gmail = params.get("gmail");
    if (!gmail) return;
    if (gmail === "connected") {
      toast({
        variant: "success",
        title: "Gmail connected",
        description: "Your Gmail account is now linked to CareerFlow.",
      });
    } else if (gmail === "oauth_not_configured") {
      toast({
        variant: "destructive",
        title: "Google OAuth not configured",
        description:
          "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in your .env.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Gmail connection failed",
        description: `Reason: ${gmail}`,
      });
    }
    params.delete("gmail");
    const next = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${next ? `?${next}` : ""}`,
    );
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch("/api/gmail/connect");
      const data = await res.json();
      if (!res.ok || !data.authUrl) {
        toast({
          variant: "destructive",
          title: "Couldn't start Gmail OAuth",
          description: data.error ?? "Unknown error",
        });
        return;
      }
      window.location.href = data.authUrl;
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't start Gmail OAuth",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/gmail/disconnect", { method: "POST" });
      if (!res.ok) throw new Error(`Disconnect failed (${res.status})`);
      toast({ title: "Gmail disconnected" });
      await fetchStatus();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Disconnect failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Sync failed",
          description: data.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      const s = data.summary;
      toast({
        variant: "success",
        title: "Sync complete",
        description: `Fetched ${s.fetched}, jobs created ${s.jobsCreated}, needs review ${s.needsReview}.`,
      });
      await fetchStatus();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const excluded = excludedLocal
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const res = await fetch("/api/gmail/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classificationThreshold: thresholdLocal,
          excludedEmails: excluded,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Save failed",
          description: data.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      toast({ variant: "success", title: "Settings saved" });
      await fetchStatus();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const oauthMissing = useMemo(
    () => status && !status.oauthConfigured,
    [status],
  );

  if (loading && !status) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading Gmail status…
      </div>
    );
  }

  if (!status) {
    return (
      <div className="text-sm text-muted-foreground">
        Gmail status unavailable.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Gmail
          </CardTitle>
          <CardDescription>
            Connect your Gmail account to let CareerFlow auto-classify
            application emails into your job tracker. Only the
            <code className="mx-1 rounded bg-muted px-1">gmail.readonly</code>
            scope is requested. Email bodies are never persisted — only
            classification metadata is stored.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {oauthMissing && (
            <div className="rounded-md border border-yellow-500/40 bg-yellow-500/5 p-3 text-sm">
              Google OAuth credentials are not configured on this server.
              Set
              <code className="mx-1 rounded bg-muted px-1">
                GOOGLE_CLIENT_ID
              </code>
              ,
              <code className="mx-1 rounded bg-muted px-1">
                GOOGLE_CLIENT_SECRET
              </code>
              , and
              <code className="mx-1 rounded bg-muted px-1">
                GOOGLE_REDIRECT_URI
              </code>
              in
              <code className="mx-1 rounded bg-muted px-1">.env</code>
              before connecting.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Status:</span>{" "}
              {status.connected ? (
                <Badge className="bg-emerald-500 hover:bg-emerald-500">
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline">Not connected</Badge>
              )}
              {status.connected && status.email && (
                <span className="ml-2 font-medium">{status.email}</span>
              )}
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Classifier:</span>{" "}
              {classifierBadge(status.classifier)}
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Last successful sync:{" "}
            <span className="text-foreground">
              {formatTime(status.lastSyncedAt)}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {status.connected ? (
              <>
                <Button onClick={handleSync} disabled={syncing}>
                  {syncing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Sync now
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Unlink className="mr-2 h-4 w-4" />
                  )}
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                onClick={handleConnect}
                disabled={connecting || Boolean(oauthMissing)}
              >
                {connecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Connect Gmail
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Classification settings</CardTitle>
          <CardDescription>
            Threads below the confidence threshold are routed to the Needs
            Review queue for manual confirmation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label className="flex items-center justify-between">
              <span>Confidence threshold</span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {thresholdLocal.toFixed(2)}
              </span>
            </Label>
            <Slider
              min={MIN_THRESHOLD}
              max={MAX_THRESHOLD}
              step={0.05}
              value={[thresholdLocal]}
              onValueChange={(value) =>
                setThresholdLocal(value[0] ?? thresholdLocal)
              }
            />
            <p className="text-xs text-muted-foreground">
              Default 0.70. Higher = fewer auto-created jobs, more items in
              Needs Review.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="excluded-emails">Excluded senders</Label>
            <textarea
              id="excluded-emails"
              className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              placeholder={`noreply@indeed.com\n*@linkedin.com\n@spam.example`}
              value={excludedLocal}
              onChange={(e) => setExcludedLocal(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              One pattern per line. Supports exact match, <code>@domain.com</code>,
              <code> *@domain.com</code>, and substring contains.
            </p>
          </div>

          <div>
            <Button onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default IntegrationsSettings;
