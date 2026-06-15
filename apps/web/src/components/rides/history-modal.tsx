"use client";

// FILE LOCATION: apps/web/src/components/rides/history-modal.tsx
//
// Bottom-sheet listing a rider's past ride_requests (completed / cancelled / no_show).
// Pure presentation — data is fetched by the parent (app/rides/page.tsx).

export interface RideHistoryItem {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  departure_time: string;
  status: string;
  fare_paid: number | null;
  driver_name: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const t = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  if (d.toDateString() === today.toDateString()) return `Today, ${t}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${t}`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + `, ${t}`;
}

function getStatusTag(status: string): { label: string; classes: string } {
  if (status === "completed") return { label: "Completed ✓", classes: "bg-green-50 text-green-800" };
  if (status === "no_show") return { label: "No show ✗", classes: "bg-red-50 text-red-800" };
  if (status === "cancelled") return { label: "Cancelled ✗", classes: "bg-red-50 text-red-800" };
  if (status === "accepted") return { label: "Accepted", classes: "bg-blue-50 text-blue-800" };
  return { label: status, classes: "bg-orange-50 text-orange-800" };
}

function getReliabilityImpact(status: string): { text: string; good: boolean } {
  if (status === "completed") return { text: "+0 pts", good: true };
  if (status === "no_show") return { text: "−15 pts", good: false };
  if (status === "cancelled") return { text: "−10 pts", good: false };
  return { text: "—", good: true };
}

export default function HistoryModal({
  open,
  onClose,
  history,
}: {
  open: boolean;
  onClose: () => void;
  history: RideHistoryItem[];
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="flex h-[88%] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl"
        style={{ animation: "slideUp 0.22s ease" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-gray-200" />

        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-bold text-gray-900">🕐 Ride history</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm text-gray-500 transition hover:bg-gray-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          {history.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <span className="mb-3 text-4xl">🚗</span>
              <p className="mb-1 text-base font-bold text-gray-900">No rides yet</p>
              <p className="text-sm text-gray-400">Your completed rides will appear here</p>
            </div>
          ) : (
            history.map((item, i) => {
              const tag = getStatusTag(item.status);
              const impact = getReliabilityImpact(item.status);
              const isGood = item.status === "completed";
              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 py-3.5 ${
                    i === history.length - 1 ? "" : "border-b border-gray-50"
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-base ${
                      isGood ? "bg-green-50" : "bg-red-50"
                    }`}
                  >
                    {isGood ? "🚗" : "✕"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {item.pickup_address} → {item.dropoff_address}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {formatDate(item.departure_time)} · {item.driver_name}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${tag.classes}`}>{tag.label}</span>
                      {item.status === "cancelled" && (
                        <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] text-orange-800">
                          Late cancel
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-bold text-gray-900">
                      {item.fare_paid ? `₹${item.fare_paid}` : "₹0"}
                    </p>
                    <p className={`mt-0.5 text-[11px] ${impact.good ? "text-green-700" : "text-red-700"}`}>
                      {impact.text}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}