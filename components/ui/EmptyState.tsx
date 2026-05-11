export default function EmptyState({
  title = "لا توجد بيانات",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/65 p-8 text-center">
      <h3 className="text-lg font-black text-slate-950">{title}</h3>

      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-7 text-slate-600">
          {description}
        </p>
      ) : null}

      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
