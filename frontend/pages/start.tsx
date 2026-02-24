import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function StartPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to project 1 (or could use stored selected project)
    router.push('/project/1');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-slate-500 text-sm">Laddar projekt...</p>
      </div>
    </div>
  );
}
