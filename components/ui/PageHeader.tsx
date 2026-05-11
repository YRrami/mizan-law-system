export default function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: "black" | "blue" | "violet" | "emerald" | "amber" | "teal";
}) {
  return (
    <section className="min-w-0 rounded-[34px] border border-slate-200/80 bg-white/86 p-5 shadow-[0_25px_80px_rgba(15,23,42,0.07)] backdrop-blur-3xl lg:p-7">
      <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-3 inline-flex max-w-full rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-800 ring-1 ring-slate-200">
              <span className="min-w-0 truncate">{eyebrow}</span>
            </p>
          ) : null}

          <h1 className="min-w-0 break-words text-3xl font-black tracking-tight text-slate-950 lg:text-5xl">
            {title}
          </h1>

          {description ? (
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-slate-600">
              {description}
            </p>
          ) : null}
        </div>

        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </section>
  );
}
