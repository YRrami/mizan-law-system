export default function LoadingCard({
  text = "جاري التحميل...",
}: {
  text?: string;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f6f7fb] p-4 text-slate-950">
      <div className="w-full max-w-sm rounded-[32px] border border-slate-200/80 bg-white/82 p-6 text-center shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur-3xl">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-700" />
        <p className="text-sm font-black text-slate-950">{text}</p>
      </div>
    </main>
  );
}
