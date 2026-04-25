import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type Role = 'installer' | 'homeowner';

export function Home() {
  const [role, setRole] = useState<Role>('installer');
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Renewable Design Studio</CardTitle>
          <CardDescription>Pick the role you want to continue as.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup value={role} onValueChange={(v) => setRole(v as Role)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="installer" id="role-installer" />
              <Label htmlFor="role-installer">Installer</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="homeowner" id="role-homeowner" />
              <Label htmlFor="role-homeowner">Home owner</Label>
            </div>
          </RadioGroup>
          <Button className="w-full" onClick={() => navigate(`/${role}`)}>
            Continue
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
