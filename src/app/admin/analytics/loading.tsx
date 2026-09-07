export default function AdminAnalyticsLoading() {
  return (
    <div>
      <h1 className="text-xl font-bold text-ink">אנליטיקה</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-white" />
        ))}
      </div>
    </div>
  );
}
