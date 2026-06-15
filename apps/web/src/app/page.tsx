import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] px-6 py-8">
      <section className="mx-auto flex max-w-5xl flex-col gap-6">
        <div>
          <p className="text-sm font-medium text-[#534ab7]">UniGo Web</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-gray-950 sm:text-5xl">
            Daily commute groups for safer shared rides.
          </h1>
          <p className="mt-3 max-w-2xl text-base text-gray-600">
            A responsive hackathon build for daily pulse check-ins, ride
            creation, route matching, and women-only commute options.
          </p>
        </div>
        <Link
          href="/commute"
          className="inline-flex w-fit items-center rounded-md bg-[#7f77dd] px-4 py-2 text-sm font-medium text-white shadow-sm"
        >
          Open commute flow
        </Link>
      </section>
    </main>
  );
}
