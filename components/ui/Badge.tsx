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
  black: "bg-slate-950 text-white",
  blue: "bg-slate-100 text-slate-800 ring-1 ring-slate-200",
  emerald: "bg-slate-100 text-slate-800 ring-1 ring-slate-200",
  violet: "bg-slate-100 text-slate-800 ring-1 ring-slate-200",
  amber: "bg-slate-100 text-slate-800 ring-1 ring-slate-200",
  rose: "bg-rose-50 text-rose-800 ring-1 ring-rose-100",
  zinc: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  teal: "bg-slate-100 text-slate-800 ring-1 ring-slate-200",
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
