import cronstrue from "cronstrue";

interface CronPreviewProps {
  expression: string;
}

export function CronPreview({ expression }: CronPreviewProps) {
  if (!expression.trim()) return null;

  let description: string;
  try {
    description = cronstrue.toString(expression);
  } catch {
    description = "Invalid cron expression";
  }

  const isValid = description !== "Invalid cron expression";

  return (
    <p style={{ color: isValid ? "var(--color-text-muted)" : "var(--color-error)", fontSize: "0.875rem" }}>
      {description}
    </p>
  );
}
