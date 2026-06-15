import { Car, CreditCard, Edit3, LogOut, Shield } from "lucide-react";
import { DemoCard, DemoShell, ListItem } from "@/components/demo/demo-shell";

export default function ProfilePage() {
  return (
    <DemoShell title="Profile" subtitle="NIT Trichy, member since Jun 2026">
      <div className="mx-auto grid max-w-2xl gap-4">
        <DemoCard className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#7f77dd] text-xl font-semibold text-white">
            S
          </div>
          <h2 className="mt-3 text-xl font-semibold">Sahana M</h2>
          <p className="text-sm text-gray-500">NIT Trichy TrustCircle</p>
          <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full bg-[#f0fff8] px-4 py-2 text-sm font-semibold text-[#0f6e56]">
            <Shield className="h-4 w-4" />
            96 reliability score
          </div>
        </DemoCard>

        <DemoCard>
          <ListItem icon={<Edit3 className="h-4 w-4" />} label="Edit profile" />
          <ListItem icon={<CreditCard className="h-4 w-4" />} label="Wallet and payments" />
          <ListItem icon={<Shield className="h-4 w-4" />} label="Emergency contacts" />
          <ListItem icon={<Car className="h-4 w-4" />} label="My vehicle" />
          <ListItem icon={<LogOut className="h-4 w-4" />} label="Log out" danger />
        </DemoCard>
      </div>
    </DemoShell>
  );
}

