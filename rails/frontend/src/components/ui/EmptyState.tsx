import { Button } from "./Button";

interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
  cta?: { label: string; onClick: () => void };
}

export function EmptyState({ message, icon, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      {icon && <div className="mb-4 text-gray-400">{icon}</div>}
      <p className="text-gray-500 mb-4">{message}</p>
      {cta && <Button onClick={cta.onClick}>{cta.label}</Button>}
    </div>
  );
}
