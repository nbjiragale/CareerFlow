// CAREERFLOW: Phase 3 (PR #9) — Settings → Data panel. Downloads a full JSON
// export of the user's data from GET /api/settings/data-export.
"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { toast } from "../ui/use-toast";

export default function DataExportSettings() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/settings/data-export");
      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          message = body.error ?? message;
        } catch {
          // non-JSON error response
        }
        throw new Error(message);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const filename =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="?([^"]+)"?/)?.[1] ??
        `careerflow-export-${new Date().toISOString().slice(0, 10)}.json`;

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({ variant: "success", title: "Export downloaded" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Export failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" /> Export your data
          </CardTitle>
          <CardDescription>
            Download a single JSON file containing every record tied to your
            account — jobs, emails, resumes, tasks, activities, and more. API
            keys and OAuth tokens are redacted (their secret values are never
            exported), and your password is never included.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download my data (JSON)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
