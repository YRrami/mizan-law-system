export default function PageHeader({
  eyebrow,
  title,
  description,
  action,
  tone = "black",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: "black" | "blue" | "violet" | "emerald" | "amber" | "teal";
}) {
  const tones = {
    black: "bg-black text-white",
    blue: "bg-blue-600 text-white",
    violet: "bg-violet-600 text-white",
    emerald: "bg-emerald-600 text-white",
    amber: "bg-amber-400 text-black",
    teal: "bg-teal-600 text-white",
  };

  return (
    <section className="min-w-0 rounded-[34px] border border-white/70 bg-white/70 p-5 shadow-[0_25px_80px_rgba(0,0,0,0.08)] backdrop-blur-3xl lg:p-7">
      <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p
              className={`mb-3 inline-flex max-w-full rounded-full px-4 py-2 text-xs font-black ${tones[tone]}`}
            >
              <span className="min-w-0 truncate">{eyebrow}</span>
            </p>
          ) : null}

          <h1 className="min-w-0 break-words text-3xl font-black tracking-tight text-black lg:text-5xl">
            {title}
          </h1>

          {description ? (
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-zinc-700">
              {description}
            </p>
          ) : null}
        </div>

        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </section>
  );
}