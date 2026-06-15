import { Car, Play, Route, Users } from "lucide-react";
import { DemoCard, DemoShell } from "@/components/demo/demo-shell";
import { MapPanel } from "@/components/demo/map-panel";

export default function DriverDashboardPage() {
  const stops = ["Sahana, Gate 1", "Krithika, Hostel Road", "Ananya, Library Signal"];

  return (
    <DemoShell title="Your ride" subtitle="NIT Trichy to Chennai Central" badge="3 riders">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <MapPanel label="RouteMorph order" />
        <div className="grid gap-4">
          <DemoCard>
            <div className="flex gap-3 rounded-xl bg-[#f9f7ff] p-3 text-sm text-[#3c3489]">
              <Route className="mt-0.5 h-5 w-5 shrink-0 text-[#534ab7]" />
              <p>
                <span className="font-semibold">RouteMorph updated your route.</span>{" "}
                Optimised stop order: Sahana to Krithika to Ananya.
              </p>
            </div>
            <h2 className="mt-4 text-sm font-semibold">Rider pickups</h2>
            <div className="mt-3 grid gap-2">
              {stops.map((stop, index) => (
                <div key={stop} className="flex items-center gap-3 rounded-xl bg-gray-100 p-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#7f77dd] text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium">{stop}</span>
                </div>
              ))}
            </div>
            <button className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1d9e75] text-sm font-medium text-white">
              <Play className="h-4 w-4" />
              Start ride
            </button>
          </DemoCard>
          <div className="grid grid-cols-3 gap-3">
            <DriverStat icon={<Users className="h-4 w-4" />} value="3" label="Riders" />
            <DriverStat icon={<Car className="h-4 w-4" />} value="4.8 km" label="Route" />
            <DriverStat icon={<Route className="h-4 w-4" />} value="Rs. 240" label="Fare" />
          </div>
        </div>
      </div>
    </DemoShell>
  );
}

function DriverStat({
  icon,
  value,
  label
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <DemoCard className="p-3 text-center">
      <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#f9f7ff] text-[#534ab7]">
        {icon}
      </div>
      <p className="mt-2 text-sm font-semibold">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </DemoCard>
  );
}

