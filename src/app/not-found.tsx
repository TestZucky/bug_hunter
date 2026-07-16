import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center">
      <div className="text-5xl mb-4" aria-hidden>
        🔍
      </div>
      <h1 className="text-xl font-bold mb-2">Page not found</h1>
      <p className="text-sm text-muted-foreground mb-6">
        That route doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-2xl font-semibold text-sm"
        style={{
          background: "linear-gradient(135deg, #6366f1, #7c3aed)",
          color: "#fff",
        }}
      >
        Back to Bug Hunter
      </Link>
    </div>
  );
}
