import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function Home() {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Renewable Design Studio</CardTitle>
          <CardDescription>Pick the role you want to continue as.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <button
            onClick={() => navigate('/installer')}
            className="w-full rounded-lg bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-6 py-4 text-lg font-semibold text-white shadow-md transition-all hover:shadow-lg hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2"
          >
            Installer
          </button>
          <button
            onClick={() => navigate('/homeowner')}
            className="w-full rounded-lg bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 px-6 py-4 text-lg font-semibold text-white shadow-md transition-all hover:shadow-lg hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2"
          >
            Home owner
          </button>
        </CardContent>
      </Card>
    </main>
  );
}
