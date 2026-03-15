interface BadgeProps {
  variant: "success" | "error" | "warning" | "neutral";
  children: React.ReactNode;
}

export function Badge({ variant, children }: BadgeProps) {
  const variantStyles = {
    success: "bg-green-100 text-green-800",
    error: "bg-red-100 text-red-800",
    warning: "bg-amber-100 text-amber-800",
    neutral: "bg-gray-100 text-gray-800",
  };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]}`}>
      {children}
    </span>
  );
}
