/**
 * Loading Component - Spinner and Loading States
 */

export function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    </div>
  );
}

export function LoadingBar() {
  return (
    <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-blue-400 to-primary animate-pulse" />
  );
}

interface LoadingPageProps {
  message?: string;
}

export function LoadingPage({ message = 'Loading...' }: LoadingPageProps) {
  return (
    <div className="min-h-screen bg-white flex flex-col justify-center items-center">
      <LoadingSpinner />
      <p className="mt-4 text-gray-600 font-medium">{message}</p>
    </div>
  );
}

interface LoadingCardProps {
  count?: number;
}

export function LoadingCard({ count = 3 }: LoadingCardProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-6 bg-gray-100 rounded-lg animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-1/3 mb-4" />
          <div className="h-8 bg-gray-300 rounded w-2/3 mb-4" />
          <div className="h-4 bg-gray-300 rounded w-full" />
        </div>
      ))}
    </div>
  );
}

export default LoadingSpinner;
