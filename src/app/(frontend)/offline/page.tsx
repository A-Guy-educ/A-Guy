'use client'

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-card-padding">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m-2.829-2.829a5 5 0 010-7.07m-2.828 2.828a1 1 0 010 1.414"
            />
          </svg>
        </div>
        <h1 className="text-display-sm font-bold mb-2">You&apos;re Offline</h1>
        <p className="text-body-md text-muted-foreground mb-6">
          It looks like you&apos;ve lost your internet connection. Please check your connection and
          try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium transition-all duration-normal hover:scale-[1.02] active:scale-[0.98]"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
