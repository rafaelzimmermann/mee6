export function LoadingSpinner({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizeStyles = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-2",
    lg: "w-8 h-8 border-3",
  };
  
  return (
    <div className={`animate-spin rounded-full border-gray-200 border-t-indigo-600 ${sizeStyles[size]} ${className}`} />
  );
}
