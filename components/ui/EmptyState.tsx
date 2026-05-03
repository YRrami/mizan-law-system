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
    <div className="rounded-[28px] border border-dashed border-black/15 bg-white/55 p-8 text-center">
      <h3 className="text-lg font-black text-black">{title}</h3>

      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-7 text-zinc-600">
          {description}
        </p>
      ) : null}

      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}