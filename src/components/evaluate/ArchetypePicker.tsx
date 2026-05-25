// CAREERFLOW: Phase 2 — archetype picker. Six fixed archetypes + auto-detect.
"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ARCHETYPES, type Archetype } from "@/models/ai.schemas";

export type ArchetypePickerValue = Archetype | "auto-detect";

const LABELS: Record<ArchetypePickerValue, string> = {
  "auto-detect": "Auto-detect",
  "ai-platform-llmops": "AI Platform / LLMOps",
  agentic: "Agentic Systems",
  "ai-pm": "AI Product Manager",
  "solutions-architect": "Solutions Architect",
  "forward-deployed": "Forward-Deployed Engineer",
  transformation: "AI Transformation",
};

interface ArchetypePickerProps {
  value: ArchetypePickerValue;
  onChange: (value: ArchetypePickerValue) => void;
  disabled?: boolean;
}

export function ArchetypePicker({
  value,
  onChange,
  disabled,
}: ArchetypePickerProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as ArchetypePickerValue)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full sm:w-[260px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Archetype framing</SelectLabel>
          <SelectSeparator />
          <SelectItem value="auto-detect">{LABELS["auto-detect"]}</SelectItem>
          {ARCHETYPES.map((a) => (
            <SelectItem key={a} value={a}>
              {LABELS[a]}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
