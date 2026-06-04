export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-zinc-500">Loading dashboard...</p>
      </div>
    </div>
  );
}
