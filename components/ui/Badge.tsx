type BadgeTone =
  | "black"
  | "blue"
  | "emerald"
  | "violet"
  | "amber"
  | "rose"
  | "zinc"
  | "teal";

const tones: Record<BadgeTone, string> = {
  black: "bg-black text-white",
  blue: "bg-blue-100 text-blue-800",
  emerald: "bg-emerald-100 text-emerald-800",
  violet: "bg-violet-100 text-violet-800",
  amber: "bg-amber-100 text-amber-900",
  rose: "bg-rose-100 text-rose-800",
  zinc: "bg-zinc-100 text-zinc-800",
  teal: "bg-teal-100 text-teal-800",
};

export default function Badge({
  children,
  tone = "zinc",
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full px-3 py-1 text-xs font-black ${tones[tone]}`}
    >
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}