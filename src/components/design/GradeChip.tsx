// CAREERFLOW: redesign — A–F grade chip primitive.
import { cn } from "@/lib/utils";

const GRADE_CLASS: Record<string, string> = {
  a: "grade-a",
  b: "grade-b",
  c: "grade-c",
  d: "grade-d",
  f: "grade-f",
};

export default function GradeChip({
  grade,
  className,
}: {
  grade: string | null | undefined;
  className?: string;
}) {
  if (!grade) return null;
  const letter = grade.trim().charAt(0).toLowerCase();
  return (
    <span className={cn("grade uppercase", GRADE_CLASS[letter], className)}>
      {grade.trim().charAt(0).toUpperCase()}
    </span>
  );
}
