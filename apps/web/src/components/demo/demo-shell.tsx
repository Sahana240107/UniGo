import Link from "next/link";
import {
  AlertTriangle,
  Car,
  ChevronRight,
  Home,
  Search,
  Shield,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";

export function DemoShell({
  title,
  subtitle,
  badge,
  children
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-4 text-gray-950 sm:px-6 lg:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="min-w-0">
            <Link href="/commute" className="text-sm font-medium text-[#534ab7]">
              UniGo
            </Link>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-normal">
              {title}
            </h1>
            {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
          </div>
          {badge ? (
            <span className="shrink-0 rounded-full bg-[#f9f7ff] px-3 py-1.5 text-xs font-semibold text-[#534ab7] ring-1 ring-[#e8e4ff]">
              {badge}
            </span>
          ) : null}
        </div>
        {children}
        <BottomNav />
      </div>
    </main>
  );
}

export function DemoCard({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-gray-200 bg-white p-4 shadow-sm", className)}>
      {children}
    </section>
  );
}

export function InfoRow({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: string;
  tone?: "neutral" | "green" | "red";
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "mt-1 h-3 w-3 shrink-0 rounded-full",
          tone === "green" && "bg-[#1d9e75]",
          tone === "red" && "bg-[#d85a30]",
          tone === "neutral" && "bg-[#7f77dd]"
        )}
      />
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

export function ListItem({
  icon,
  label,
  danger
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 border-b border-gray-100 py-3 text-left last:border-b-0"
    >
      <span className={cn("text-gray-500", danger && "text-[#e24b4a]")}>{icon}</span>
      <span className={cn("flex-1 text-sm font-medium", danger && "text-[#e24b4a]")}>
        {label}
      </span>
      <ChevronRight className="h-4 w-4 text-gray-300" />
    </button>
  );
}

function BottomNav() {
  const items = [
    { href: "/commute", label: "Home", icon: Home },
    { href: "/commute", label: "Find", icon: Search },
    { href: "/safety", label: "SOS", icon: AlertTriangle, sos: true },
    { href: "/driver/dashboard", label: "My rides", icon: Car },
    { href: "/profile", label: "Profile", icon: User }
  ];

  return (
    <nav className="sticky bottom-3 z-20 mt-5 grid grid-cols-5 items-center rounded-2xl border border-gray-200 bg-white/95 p-2 shadow-lg backdrop-blur">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={item.href}
            className="flex min-w-0 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-medium text-gray-500"
          >
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full",
                item.sos ? "bg-[#e24b4a] text-white" : "text-[#7f77dd]"
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

