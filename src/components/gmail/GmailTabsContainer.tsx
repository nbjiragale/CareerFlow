// CAREERFLOW: Phase 1 — top-level Gmail tab. Renders All Threads + Needs
// Review queues, both backed by /api/gmail/threads with a needsReview
// filter. Sync now button triggers /api/gmail/sync and refreshes both
// lists on completion.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Settings as SettingsIcon } from "lucide-react";

import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { toast } from "../ui/use-toast";

import GmailThreadList from "./GmailThreadList";

interface GmailStatus {
  oauthConfigured: boolean;
  connected: boolean;
  email: string | null;
  lastSyncedAt: string | null;
  classifier: "huggingface" | "keyword";
}

function GmailTabsContainer() {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gmail/status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus(await res.json());
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
      setRefreshKey((k) => k + 1);
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

  if (loading && !status) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading Gmail…
      </div>
    );
  }

  if (!status) {
    return null;
  }

  if (!status.connected) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border bg-card p-6">
        <h2 className="text-2xl font-semibold tracking-tight">Gmail</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Connect your Gmail account to start tracking job application emails
          automatically. CareerFlow classifies messages into the labels
          <span className="mx-1 rounded bg-muted px-1 font-mono">
            Applied / Interview / NextPhase / Offer / Rejected
          </span>
          and creates or links a Job for each one. Items below the confidence
          threshold land in the Needs Review queue for manual confirmation.
        </p>
        <Link href="/dashboard/settings?section=integrations">
          <Button>
            <SettingsIcon className="mr-2 h-4 w-4" /> Connect Gmail in Settings
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Gmail</h2>
          <p className="text-sm text-muted-foreground">
            Connected as <span className="font-medium">{status.email}</span>{" "}
            · Classifier:{" "}
            <span className="font-medium capitalize">{status.classifier}</span>{" "}
            · Last sync:{" "}
            <span className="font-medium">
              {status.lastSyncedAt
                ? new Date(status.lastSyncedAt).toLocaleString()
                : "Never"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/settings?section=integrations">
            <Button variant="outline" size="sm">
              <SettingsIcon className="mr-2 h-4 w-4" /> Settings
            </Button>
          </Link>
          <Button size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync now
          </Button>
        </div>
      </div>

      <Tabs defaultValue="needs-review">
        <TabsList>
          <TabsTrigger value="needs-review">Needs Review</TabsTrigger>
          <TabsTrigger value="all">All Threads</TabsTrigger>
        </TabsList>
        <TabsContent value="needs-review" className="mt-4">
          <GmailThreadList
            key={`needs-${refreshKey}`}
            needsReview
            emptyMessage="Inbox zero. No low-confidence classifications waiting on you."
            allowCorrection
          />
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          <GmailThreadList
            key={`all-${refreshKey}`}
            emptyMessage="No classified threads yet. Click Sync now to fetch your recent Primary inbox."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default GmailTabsContainer;
