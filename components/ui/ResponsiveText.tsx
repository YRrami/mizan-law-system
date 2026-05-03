export default function ResponsiveText({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`block min-w-0 break-words text-black ${className}`}>
      {children || "—"}
    </span>
  );
}