export default function LoadingCard({
  text = "جاري التحميل...",
}: {
  text?: string;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f5f5f7] p-4 text-black">
      <div className="w-full max-w-sm rounded-[32px] border border-white/70 bg-white/75 p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.12)] backdrop-blur-3xl">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-black" />
        <p className="text-sm font-black text-black">{text}</p>
      </div>
    </main>
  );
}