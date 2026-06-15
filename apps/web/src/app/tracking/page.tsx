import { Car, Navigation, Phone, Shield } from "lucide-react";
import { DemoCard, DemoShell } from "@/components/demo/demo-shell";
import { MapPanel } from "@/components/demo/map-panel";

export default function TrackingPage() {
  return (
    <DemoShell title="Live tracking" subtitle="Ruvanthika is on her way" badge="ETA 4 min">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <MapPanel live label="Live OSM tracking" />
        <div className="grid gap-4">
          <DemoCard>
            <div className="flex gap-3 rounded-xl bg-[#faeeda] p-3 text-sm text-[#633806]">
              <Navigation className="mt-0.5 h-5 w-5 shrink-0 text-[#854f0b]" />
              <p>
                <span className="font-semibold">Driver is 1.2 km away.</span> Head
                to Gate 1, NIT Trichy. Route updated with 3 pickups.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#afa9ec] font-semibold text-[#3c3489]">
                RV
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-semibold">Ruvanthika P</h2>
                <p className="text-sm text-gray-500">TN 45 AB 2190, Blue Swift</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 text-sm font-medium">
                <Phone className="h-4 w-4" />
                Call
              </button>
              <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 text-sm font-medium">
                <Car className="h-4 w-4" />
                Ride info
              </button>
            </div>
          </DemoCard>
          <DemoCard className="border-[#f7c1c1] bg-[#fcebeb]">
            <div className="flex gap-3 text-sm text-[#791f1f]">
              <Shield className="mt-0.5 h-5 w-5 shrink-0 text-[#a32d2d]" />
              <p>Emergency contact will be notified if SOS is tapped.</p>
            </div>
          </DemoCard>
        </div>
      </div>
    </DemoShell>
  );
}

