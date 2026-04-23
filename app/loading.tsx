export default function Loading() {
  return (
    <main className="shell app-shell app-loading" aria-label="Loading BPHealth">
      <div className="loading-mark" aria-hidden="true">
        <svg viewBox="0 0 64 64" role="img" aria-hidden="true">
          <rect x="8" y="8" width="48" height="48" rx="16" fill="url(#loadingBg)" />
          <path
            d="M15 36h10l4-10 6 20 5-12h9"
            fill="none"
            stroke="url(#loadingLine)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient id="loadingBg" x1="10" y1="8" x2="54" y2="56" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6d28d9" />
              <stop offset="1" stopColor="#1d4ed8" />
            </linearGradient>
            <linearGradient id="loadingLine" x1="14" y1="19" x2="52" y2="45" gradientUnits="userSpaceOnUse">
              <stop stopColor="#eef2ff" />
              <stop offset="1" stopColor="#dbeafe" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <p className="loading-brand">BPHealth</p>
      <p className="loading-copy">Preparing your blood pressure tracker.</p>
    </main>
  );
}
