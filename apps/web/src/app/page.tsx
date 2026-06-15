import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto flex max-w-5xl flex-col gap-6">
        <div>
          <p className="text-sm font-medium text-emerald-700">UniGo Web</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-gray-950">
            Daily commute groups for safer shared rides.
          </h1>
          <p className="mt-3 max-w-2xl text-base text-gray-600">
            This is the initial web scaffold. The next step is building the login,
            commute confirmation, ride creation, route map, and rider matching flow.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex w-fit items-center rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white"
        >
          Start
        </Link>
      </section>
    </main>
  );
}

