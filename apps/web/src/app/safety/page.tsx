import { AlertTriangle, MapPin, Phone, Shield } from "lucide-react";
import { DemoCard, DemoShell } from "@/components/demo/demo-shell";
import { MapPanel } from "@/components/demo/map-panel";

export default function SafetyPage() {
  return (
    <DemoShell title="Emergency alert sent" subtitle="Mom has been notified with your live location" badge="SOS">
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <DemoCard className="border-[#f7c1c1] bg-[#fcebeb] text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e24b4a] text-white">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-[#a32d2d]">SOS active</h2>
          <p className="mt-2 text-sm text-[#791f1f]">
            Your current route, ride ID, and live location are ready to share with
            emergency contacts.
          </p>
          <div className="mt-5 grid gap-2">
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#e24b4a] text-sm font-medium text-white">
              <Phone className="h-4 w-4" />
              Call emergency contact
            </button>
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#f7c1c1] bg-white text-sm font-medium text-[#a32d2d]">
              <Shield className="h-4 w-4" />
              Mark safe
            </button>
          </div>
        </DemoCard>
        <div className="grid gap-4">
          <MapPanel live label="Live safety location" />
          <DemoCard>
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 text-[#e24b4a]" />
              <div>
                <p className="text-sm font-semibold">Current location</p>
                <p className="text-sm text-gray-500">NIT Trichy main road, near Gate 1</p>
              </div>
            </div>
          </DemoCard>
        </div>
      </div>
    </DemoShell>
  );
}

