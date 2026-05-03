const tones = {
  blue: "bg-blue-50 text-blue-800",
  emerald: "bg-emerald-50 text-emerald-800",
  violet: "bg-violet-50 text-violet-800",
  amber: "bg-amber-50 text-amber-900",
  rose: "bg-rose-50 text-rose-800",
  teal: "bg-teal-50 text-teal-800",
  black: "bg-black text-white",
};

type Tone = keyof typeof tones;

export default function StatCard({
  label,
  value,
  hint,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="min-w-0 rounded-[30px] border border-white/70 bg-white/70 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.07)] backdrop-blur-3xl">
      <p
        className={`mb-4 inline-flex max-w-full rounded-full px-3 py-1 text-xs font-black ${tones[tone]}`}
      >
        <span className="min-w-0 truncate">{label}</span>
      </p>

      <h3 className="min-w-0 break-words text-3xl font-black text-black lg:text-4xl">
        {value}
      </h3>

      {hint ? (
        <p className="mt-2 text-xs font-bold leading-5 text-zinc-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}