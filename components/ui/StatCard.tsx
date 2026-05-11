export default function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "blue" | "emerald" | "violet" | "amber" | "rose" | "teal" | "black";
}) {
  return (
    <div className="min-w-0 rounded-[30px] border border-slate-200/80 bg-white/86 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.06)] backdrop-blur-3xl">
      <p className="mb-4 inline-flex max-w-full rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
        <span className="min-w-0 truncate">{label}</span>
      </p>

      <h3 className="min-w-0 break-words text-3xl font-black text-slate-950 lg:text-4xl">
        {value}
      </h3>

      {hint ? (
        <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
