import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 antialiased flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <p className="text-8xl font-bold text-pink-500 mb-4 leading-none">404</p>
        <h1 className="text-2xl font-semibold text-zinc-100 mb-2">Page not found</h1>
        <p className="text-zinc-400 text-sm mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="text-pink-500 hover:text-pink-400 text-sm transition-colors"
        >
          ← Back to board
        </Link>
      </div>
    </div>
  );
}
