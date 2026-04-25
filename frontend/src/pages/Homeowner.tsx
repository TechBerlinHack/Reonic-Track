import { useChat } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

export function Homeowner() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setInput } = useChat({
    api: '/api/chat',
  });

  const suggestion = 'Does a heat pump make sense if I currently heat with gas?';

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
            Ready to help
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            {messages.length === 0 && (
              <button
                type="button"
                onClick={() => setInput(suggestion)}
                className="self-start rounded-md border bg-background px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Try: <em>“{suggestion}”</em>
              </button>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === 'user'
                    ? 'self-end rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground'
                    : 'self-start max-w-full rounded-lg bg-background px-3 py-2 text-sm [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_h1]:mt-2 [&_h1]:mb-1 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-semibold [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:font-semibold [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&>:first-child]:mt-0 [&>:last-child]:mb-0'
                }
              >
                {m.role === 'user' ? (
                  m.content
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                )}
              </div>
            ))}

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
