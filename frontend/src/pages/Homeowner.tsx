import { useChat } from '@ai-sdk/react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

export function Homeowner() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: '/api/chat',
  });

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Home owner · chat</h1>
        <Link to="/" className="text-sm text-muted-foreground hover:underline">
          ← back
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ask the renewable-energy advisor</CardTitle>
          <CardDescription>
            Powered by a Mastra agent on Gemini 2.5 Flash. Streaming via the AI SDK.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto rounded-md border bg-muted/30 p-4">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Try: <em>“Does a heat pump make sense if I currently heat with gas?”</em>
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === 'user'
                    ? 'self-end rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground'
                    : 'self-start rounded-lg bg-background px-3 py-2 text-sm'
                }
              >
                {m.content}
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-destructive">Error: {error.message}</p>}

          <form onSubmit={handleSubmit} className="flex gap-2">
            <Textarea
              value={input}
              onChange={handleInputChange}
              placeholder="Ask about PV sizing, batteries, heat pumps…"
              className="min-h-[44px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? 'Thinking…' : 'Send'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
