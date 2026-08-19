export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="admin-skeleton">
      <span className="sr-only">Loading this view…</span>
      <div className="skeleton-block skeleton-heading">
        <span className="skeleton-line skeleton-line-eyebrow" />
        <span className="skeleton-line skeleton-line-title" />
      </div>
      <div className="skeleton-block skeleton-body">
        <span className="skeleton-line" />
        <span className="skeleton-line" />
        <span className="skeleton-line skeleton-line-short" />
      </div>
    </div>
  );
}
