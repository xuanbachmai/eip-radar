import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-xl">
      <div className="eyebrow">404</div>
      <h1 className="display text-3xl font-extrabold">Not on the radar</h1>
      <p className="mt-3 text-muted">
        That page doesn&apos;t exist. Try the <Link href="/eips">explorer</Link> or the <Link href="/">dashboard</Link>.
      </p>
    </div>
  );
}
