import Link from "next/link";
import { ArrowRight, Clock3, Route, Users } from "lucide-react";
import { DemoCard, DemoShell, InfoRow } from "@/components/demo/demo-shell";
import { MapPanel } from "@/components/demo/map-panel";

export default function RideDetailPage() {
  return (
    <DemoShell
      title="Ruvanthika's ride"
      subtitle="Mon 15 Jun, departs 8:15 AM"
      badge="Women only"
    >
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-4">
          <MapPanel label="Route optimised" />
          <DemoCard>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="Pickup" value="Gate 1, NIT Trichy" tone="green" />
              <InfoRow label="Drop" value="Central Library, NIT Trichy" tone="red" />
            </div>
            <div className="mt-4 rounded-xl bg-[#eaf3de] p-3 text-sm font-medium text-[#27500a]">
              <div className="flex items-center gap-2">
                <Route className="h-4 w-4" />
                RouteMorph will adjust pickup order as riders join.
              </div>
            </div>
          </DemoCard>
        </div>

        <DemoCard>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#afa9ec] font-semibold text-[#3c3489]">
                RV
              </div>
              <div>
                <h2 className="text-lg font-semibold">Ruvanthika P</h2>
                <p className="text-sm text-gray-500">4.9 rating, verified driver</p>
              </div>
            </div>
            <p className="text-right text-lg font-semibold">Rs. 80</p>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <MiniStat icon={<Clock3 className="h-4 w-4" />} label="Time" value="8:15 AM" />
            <MiniStat icon={<Users className="h-4 w-4" />} label="Seats" value="2 left" />
            <MiniStat icon={<Route className="h-4 w-4" />} label="Match" value="78%" />
          </div>

          <div className="mt-5 rounded-xl bg-[#f9f7ff] p-3">
            <p className="text-sm font-semibold text-[#534ab7]">Route overlap</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e8e4ff]">
              <div className="h-full w-[78%] rounded-full bg-[#7f77dd]" />
            </div>
            <p className="mt-2 text-xs font-medium text-[#3b6d11]">
              Saves 12 min compared with travelling solo.
            </p>
          </div>

          <Link
            href="/tracking"
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#7f77dd] text-sm font-medium text-white"
          >
            Request to join
            <ArrowRight className="h-4 w-4" />
          </Link>
        </DemoCard>
      </div>
    </DemoShell>
  );
}

function MiniStat({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-gray-100 p-3 text-center">
      <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#534ab7]">
        {icon}
      </div>
      <p className="mt-2 text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

