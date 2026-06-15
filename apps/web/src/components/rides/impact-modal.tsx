"use client";

// FILE LOCATION: apps/web/src/components/rides/impact-modal.tsx
//
// Lightweight placeholder for "My Impact". Shows totals already loaded by
// app/rides/page.tsx (from impact_summary). The full forest / CO2 breakdown
// view (matching the RN ImpactModal) will be built later — likely as its own
// route at app/rides/impact/page.tsx, with this sheet linking to it.

export default function ImpactModal({
  open,
  onClose,
  totalRides,
  totalSaved,
}: {
  open: boolean;
  onClose: () => void;
  totalRides: number;
  totalSaved: number;
}) {
  if (!open) return null;

  const co2Total = Math.round(totalRides * 0.8 * 10) / 10;
  const treesPlanted = Math.min(totalRides, 15);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="flex h-[60%] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl shadow-2xl"
        style={{ background: "#0D1B0F", animation: "slideUp 0.22s ease" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-white/20" />

        <div className="flex items-start justify-between px-5 pt-3 pb-5">
          <div>
            <h2 className="text-xl font-bold text-white">🌍 Your impact</h2>
            <p className="mt-1 text-sm text-white/40">{totalRides} rides · all time</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm text-white/60 transition hover:bg-white/20"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/[0.07] p-4">
              <p className="text-2xl font-bold text-[#34A853]">{co2Total.toFixed(1)} kg</p>
              <p className="mt-1 text-xs text-white/50">CO₂ saved</p>
              <p className="mt-0.5 text-[11px] text-white/25">vs solo cab</p>
            </div>
            <div className="rounded-2xl bg-white/[0.07] p-4">
              <p className="text-2xl font-bold text-white">{totalRides}</p>
              <p className="mt-1 text-xs text-white/50">Total rides</p>
              <p className="mt-0.5 text-[11px] text-white/25">shared trips</p>
            </div>
          </div>

          <div className="mb-4 rounded-2xl bg-white/[0.05] p-4">
            <p className="mb-2 text-[10px] tracking-widest text-white/35">YOUR FOREST — 1 RIDE = 1 TREE</p>
            <p className="text-3xl">{"🌳".repeat(treesPlanted) || "🌱"}</p>
            <p className="mt-2 text-[11px] text-white/35">
              {treesPlanted} trees growing · keep riding to grow your forest
            </p>
          </div>

          <div className="mb-2 flex items-center gap-3 rounded-2xl bg-green-500/10 p-4">
            <span className="text-2xl">🏆</span>
            <p className="text-sm leading-relaxed text-white/65">
              You're a UniGo Green Rider! Every shared ride helps SRM campus breathe cleaner. Total saved: ₹
              {totalSaved.toLocaleString("en-IN")}.
            </p>
          </div>
          <p className="pb-6 text-center text-xs text-white/30">Full impact breakdown coming soon 🌿</p>
        </div>
      </div>
    </div>
  );
}