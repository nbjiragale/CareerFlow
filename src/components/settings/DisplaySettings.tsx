"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "../ui/use-toast";
import { Button } from "../ui/button";
import { useTheme } from "next-themes";
import { Loader2 } from "lucide-react";
import { getUserSettings, updateDisplaySettings } from "@/actions/userSettings.actions";

// CAREERFLOW: redesign (PR E) — Appearance form now also captures density.
const appearanceFormSchema = z.object({
  theme: z.enum(["light", "dark", "system"], {
    error: "Please select a theme.",
  }),
  density: z.enum(["comfortable", "compact"], {
    error: "Please select a density.",
  }),
});

type AppearanceFormValues = z.infer<typeof appearanceFormSchema>;

const DENSITY_STORAGE_KEY = "careerflow-density";

// CAREERFLOW: redesign (PR E) — split the DOM attribute write (cheap, used
// for live preview while the user is toggling the radio) from the localStorage
// write (only happens on save, so an abandoned toggle doesn't desync with the
// server-persisted value on the next page load).
function previewDensityOnDocument(density: "comfortable" | "compact") {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-density", density);
}

function persistDensityToLocalStorage(density: "comfortable" | "compact") {
  try {
    window.localStorage.setItem(DENSITY_STORAGE_KEY, density);
  } catch {
    // localStorage may be unavailable (private mode, SSR snapshots, …);
    // density still applies for the rest of the session via the DOM attr.
  }
}

function applyDensityToDocument(density: "comfortable" | "compact") {
  previewDensityOnDocument(density);
  persistDensityToLocalStorage(density);
}

function DisplaySettings() {
  const { setTheme, theme, systemTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<AppearanceFormValues>({
    resolver: zodResolver(appearanceFormSchema),
    defaultValues: {
      theme: "system",
      density: "comfortable",
    },
  });

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const result = await getUserSettings();
        const savedTheme = result?.data?.settings?.display?.theme;
        const savedDensity = result?.data?.settings?.display?.density;
        const initialTheme: "light" | "dark" | "system" =
          savedTheme ?? (theme as "light" | "dark" | "system") ?? "system";
        const initialDensity: "comfortable" | "compact" =
          savedDensity ?? "comfortable";
        form.reset({ theme: initialTheme, density: initialDensity });
        if (savedTheme) setTheme(savedTheme);
        applyDensityToDocument(initialDensity);
      } catch (error) {
        console.error("Error fetching display settings:", error);
        if (theme) {
          form.reset({
            theme: theme as "light" | "dark" | "system",
            density: "comfortable",
          });
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(data: AppearanceFormValues) {
    setIsSaving(true);
    try {
      const result = await updateDisplaySettings({
        theme: data.theme,
        density: data.density,
      });
      if (result.success) {
        setTheme(data.theme);
        applyDensityToDocument(data.density);
        toast({
          variant: "success",
          title: "Your appearance preferences have been saved.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.message || "Failed to save display settings.",
        });
      }
    } catch (error) {
      console.error("Error saving display settings:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save display settings.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Appearance</h3>
          <p className="text-sm text-muted-foreground">
            Customize the look and feel of the application.
          </p>
        </div>
        <div className="flex items-center gap-2" role="status" aria-label="Loading settings">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Appearance</h3>
        <p className="text-sm text-muted-foreground">
          Customize the look and feel of the application.
        </p>
      </div>
      <div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="theme"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>Theme</FormLabel>
                    <FormDescription>
                      Select the theme for the app.
                    </FormDescription>
                    <FormMessage />
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="grid max-w-lg md:grid-cols-3 gap-8 pt-2"
                    >
                      <FormItem>
                        <FormLabel className="[&:has([data-state=checked])>div]:border-primary">
                          <FormControl>
                            <RadioGroupItem value="light" className="sr-only" />
                          </FormControl>
                          <LightThemeElement />
                          <span className="block w-full p-2 text-center font-normal">
                            Light
                          </span>
                        </FormLabel>
                      </FormItem>
                      <FormItem>
                        <FormLabel className="[&:has([data-state=checked])>div]:border-primary">
                          <FormControl>
                            <RadioGroupItem value="dark" className="sr-only" />
                          </FormControl>
                          <DarkThemeElement />
                          <span className="block w-full p-2 text-center font-normal">
                            Dark
                          </span>
                        </FormLabel>
                      </FormItem>
                      <FormItem>
                        <FormLabel className="[&:has([data-state=checked])>div]:border-primary">
                          <FormControl>
                            <RadioGroupItem
                              value="system"
                              className="sr-only"
                            />
                          </FormControl>
                          {systemTheme === "dark" ? (
                            <DarkThemeElement />
                          ) : (
                            <LightThemeElement />
                          )}
                          <span className="block w-full p-2 text-center font-normal">
                            System
                          </span>
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormItem>
                )}
              />

              {/* CAREERFLOW: redesign (PR E) — density picker. */}
              <FormField
                control={form.control}
                name="density"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>Density</FormLabel>
                    <FormDescription>
                      Comfortable adds breathing room; Compact tightens cards
                      and tables for power users.
                    </FormDescription>
                    <FormMessage />
                    <RadioGroup
                      onValueChange={(value) => {
                        field.onChange(value);
                        // CAREERFLOW: redesign (PR E) — preview only.
                        // The localStorage write is deferred to onSubmit
                        // so abandoned toggles don't persist past reload.
                        previewDensityOnDocument(
                          value as "comfortable" | "compact",
                        );
                      }}
                      value={field.value}
                      className="grid max-w-lg sm:grid-cols-2 gap-4 pt-2"
                    >
                      <FormItem>
                        <FormLabel className="[&:has([data-state=checked])>div]:border-primary block cursor-pointer">
                          <FormControl>
                            <RadioGroupItem
                              value="comfortable"
                              className="sr-only"
                              data-testid="density-comfortable"
                            />
                          </FormControl>
                          <div className="rounded-md border-2 border-muted p-3 hover:border-accent">
                            <div className="space-y-2">
                              <div className="h-2 w-[60%] rounded bg-muted-foreground/30" />
                              <div className="h-2 w-[80%] rounded bg-muted-foreground/30" />
                              <div className="h-2 w-[50%] rounded bg-muted-foreground/30" />
                            </div>
                          </div>
                          <span className="block w-full p-2 text-center font-normal">
                            Comfortable
                          </span>
                        </FormLabel>
                      </FormItem>
                      <FormItem>
                        <FormLabel className="[&:has([data-state=checked])>div]:border-primary block cursor-pointer">
                          <FormControl>
                            <RadioGroupItem
                              value="compact"
                              className="sr-only"
                              data-testid="density-compact"
                            />
                          </FormControl>
                          <div className="rounded-md border-2 border-muted p-2 hover:border-accent">
                            <div className="space-y-1">
                              <div className="h-1.5 w-[60%] rounded bg-muted-foreground/30" />
                              <div className="h-1.5 w-[80%] rounded bg-muted-foreground/30" />
                              <div className="h-1.5 w-[50%] rounded bg-muted-foreground/30" />
                              <div className="h-1.5 w-[70%] rounded bg-muted-foreground/30" />
                            </div>
                          </div>
                          <span className="block w-full p-2 text-center font-normal">
                            Compact
                          </span>
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update preferences
              </Button>
            </form>
          </Form>
      </div>
    </div>
  );
}

export default DisplaySettings;

function LightThemeElement() {
  return (
    <div className="cursor-pointer items-center rounded-md border-2 border-muted p-1 hover:border-accent">
      <div className="space-y-2 rounded-sm bg-[#ecedef] p-2">
        <div className="space-y-2 rounded-md bg-white p-2 shadow-sm">
          <div className="h-2 w-[80px] rounded-lg bg-[#ecedef]" />
          <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
        </div>
        <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm">
          <div className="h-4 w-4 rounded-full bg-[#ecedef]" />
          <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
        </div>
        <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm">
          <div className="h-4 w-4 rounded-full bg-[#ecedef]" />
          <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
        </div>
      </div>
    </div>
  );
}
function DarkThemeElement() {
  return (
    <div className="cursor-pointer items-center rounded-md border-2 border-muted bg-popover p-1 hover:bg-accent hover:text-accent-foreground">
      <div className="space-y-2 rounded-sm bg-slate-950 p-2">
        <div className="space-y-2 rounded-md bg-slate-800 p-2 shadow-sm">
          <div className="h-2 w-[80px] rounded-lg bg-slate-400" />
          <div className="h-2 w-[100px] rounded-lg bg-slate-400" />
        </div>
        <div className="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm">
          <div className="h-4 w-4 rounded-full bg-slate-400" />
          <div className="h-2 w-[100px] rounded-lg bg-slate-400" />
        </div>
        <div className="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm">
          <div className="h-4 w-4 rounded-full bg-slate-400" />
          <div className="h-2 w-[100px] rounded-lg bg-slate-400" />
        </div>
      </div>
    </div>
  );
}
