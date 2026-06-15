import Link from "next/link";
import { ArrowRight, Car, Clock3, MapPin, Users } from "lucide-react";
import { DemoCard, DemoShell } from "@/components/demo/demo-shell";
import { MapPanel } from "@/components/demo/map-panel";

export default function DriverOfferPage() {
  return (
    <DemoShell title="Offer a ride" subtitle="Set your route for today">
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <DemoCard>
          <div className="grid gap-3">
            <Field label="Pickup point" value="Gate 1, NIT Trichy" active />
            <Field label="Drop-off" value="Chennai Central" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Departure" value="8:15 AM" icon={<Clock3 className="h-4 w-4" />} />
              <Field label="Seats" value="3 seats" icon={<Users className="h-4 w-4" />} />
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-[#fbeaf0] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#7a2944]">Women-only ride</p>
                <p className="text-xs text-[#993556]">Only female riders can join.</p>
              </div>
              <div className="h-6 w-11 rounded-full bg-[#d4537e] p-1">
                <span className="block h-4 w-4 translate-x-5 rounded-full bg-white" />
              </div>
            </div>
          </div>
          <Link
            href="/driver/dashboard"
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#7f77dd] text-sm font-medium text-white"
          >
            Publish ride
            <ArrowRight className="h-4 w-4" />
          </Link>
        </DemoCard>
        <MapPanel label="Driver route preview" />
      </div>
    </DemoShell>
  );
}

function Field({
  label,
  value,
  active,
  icon
}: {
  label: string;
  value: string;
  active?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <div className={`flex items-center gap-2 rounded-xl px-3 py-3 ${active ? "border border-[#afa9ec] bg-white" : "bg-gray-100"}`}>
        {icon ?? <MapPin className={`h-4 w-4 ${active ? "text-[#7f77dd]" : "text-gray-500"}`} />}
        <span className="text-sm font-medium">{value}</span>
      </div>
    </label>
  );
}

