export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-lg shadow-md ${className || ""}`}>{children}</div>;
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-4 border-b border-gray-200">{children}</div>;
}

export function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-4">{children}</div>;
}
