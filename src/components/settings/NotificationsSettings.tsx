// CAREERFLOW: Phase 3 — Settings → Notifications panel. Request browser
// notification permission, toggle the default channels, set the default lead
// time, and fire a test reminder to verify the end-to-end flow.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { toast } from "../ui/use-toast";
import { useReminderStream } from "@/hooks/useReminderStream";
import {
  getUserSettings,
  updateNotificationSettings,
} from "@/actions/userSettings.actions";
import { createTestReminder } from "@/actions/task.actions";
import {
  defaultUserSettings,
  type NotificationSettings,
} from "@/models/userSettings.model";

const LEAD_OPTIONS = [
  { label: "At due time", value: 0 },
  { label: "15 minutes before", value: 15 },
  { label: "1 hour before", value: 60 },
  { label: "1 day before", value: 1440 },
];

export default function NotificationsSettings() {
  const [prefs, setPrefs] = useState<NotificationSettings>(
    defaultUserSettings.notifications,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const { permission, requestPermission } = useReminderStream({
    onFallback: (reminder) => {
      toast({
        title: reminder.payload?.taskTitle ?? "Reminder",
        description: reminder.payload?.taskDescription ?? undefined,
      });
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUserSettings();
      if (res?.success && res.data?.settings?.notifications) {
        setPrefs(res.data.settings.notifications);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (next: NotificationSettings) => {
    setSaving(true);
    setPrefs(next);
    try {
      const res = await updateNotificationSettings(next);
      if (res?.success) {
        toast({ variant: "success", title: "Notification settings saved" });
      } else {
        toast({
          variant: "destructive",
          title: "Save failed",
          description: res?.message ?? "Unknown error",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPermission = async () => {
    const result = await requestPermission();
    if (result === "granted") {
      toast({ variant: "success", title: "Browser notifications enabled" });
    } else if (result === "denied") {
      toast({
        variant: "destructive",
        title: "Permission denied",
        description: "Reminders will appear as in-app toasts instead.",
      });
    }
  };

  const handleTestReminder = async () => {
    setTesting(true);
    try {
      const res = await createTestReminder();
      if (res?.success) {
        toast({
          variant: "success",
          title: "Test reminder scheduled",
          description: "It will fire within about a minute.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Couldn't schedule test reminder",
          description: res?.message ?? "Unknown error",
        });
      }
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading notification
        settings…
      </div>
    );
  }

  const permissionBadge = () => {
    if (permission === "granted") {
      return <Badge className="bg-emerald-500 hover:bg-emerald-500">Granted</Badge>;
    }
    if (permission === "denied") {
      return <Badge variant="destructive">Denied</Badge>;
    }
    if (permission === "unsupported") {
      return <Badge variant="outline">Unsupported</Badge>;
    }
    return <Badge variant="outline">Not requested</Badge>;
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" /> Browser notifications
          </CardTitle>
          <CardDescription>
            CareerFlow fires a notification when a task reminder is due. Browser
            notifications only appear while a CareerFlow tab is open; when
            permission is denied, reminders fall back to an in-app toast.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">Permission:</span>
            {permissionBadge()}
            {permission !== "granted" && permission !== "unsupported" && (
              <Button size="sm" variant="outline" onClick={handleRequestPermission}>
                Enable browser notifications
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Browser channel by default</Label>
              <p className="text-xs text-muted-foreground">
                New tasks fire a browser reminder unless changed.
              </p>
            </div>
            <Switch
              checked={prefs.browserEnabled}
              onCheckedChange={(v) => save({ ...prefs, browserEnabled: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Email channel by default</Label>
              <p className="text-xs text-muted-foreground">
                Requires SMTP configured on the server (SMTP_HOST). Otherwise
                email reminders are skipped.
              </p>
            </div>
            <Switch
              checked={prefs.emailEnabled}
              onCheckedChange={(v) => save({ ...prefs, emailEnabled: v })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Default reminder lead time</Label>
            <div className="flex flex-wrap gap-2">
              {LEAD_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  size="sm"
                  variant={
                    prefs.defaultLeadMinutes === opt.value ? "default" : "outline"
                  }
                  onClick={() =>
                    save({ ...prefs, defaultLeadMinutes: opt.value })
                  }
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Button onClick={handleTestReminder} disabled={testing}>
              {testing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BellRing className="mr-2 h-4 w-4" />
              )}
              Send test reminder
            </Button>
            {saving && (
              <span className="ml-3 text-xs text-muted-foreground">Saving…</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
