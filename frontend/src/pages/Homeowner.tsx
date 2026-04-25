import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { OfferCard, type Recommendation } from '@/components/OfferCard';

type HeatingType = 'Gas' | 'Oil' | 'HeatPump' | 'DistrictHeat' | 'OtherNonRenewable';

type HomeownerForm = {
  annualDemandKwh: number;
  priceEurKwh: number;
  houseSize: number;
  inhabitants: number;
  hasEv: boolean;
  evKm: number;
  heatingType: HeatingType;
  heatDemandKwh: number;
  heatingCost: number;
  roofSafety: number;
};

type OfferResponse = {
  recommendation: Recommendation | null;
  missing: string[];
  received?: unknown;
};

export function Homeowner() {
  const [form, setForm] = useState<Partial<HomeownerForm>>({});
  const [unknownFields, setUnknownFields] = useState<Set<string>>(new Set());
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [updating, setUpdating] = useState(false);

  const unknownArray = useMemo(() => [...unknownFields], [unknownFields]);

  const knownFieldsRef = useRef<string[]>([]);
  const unknownFieldsRef = useRef<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    knownFieldsRef.current = Object.keys(form);
  }, [form]);
  useEffect(() => {
    unknownFieldsRef.current = unknownArray;
  }, [unknownArray]);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
    useChat({
      api: '/api/homeowner/chat',
      maxSteps: 5,
      experimental_prepareRequestBody: ({ messages }) => ({
        messages,
        knownFields: knownFieldsRef.current,
        unknownFields: unknownFieldsRef.current,
      }),
      async onToolCall({ toolCall }) {
        if (toolCall.toolName === 'setFormFields') {
          const fields = toolCall.args as Partial<HomeownerForm>;
          const applied: Partial<HomeownerForm> = {};
          for (const [k, v] of Object.entries(fields)) {
            if (v === undefined || v === null) continue;
            (applied as Record<string, unknown>)[k] = v;
          }
          if (Object.keys(applied).length > 0) {
            setForm((prev) => ({ ...prev, ...applied }));
          }
          return { applied };
        }
        if (toolCall.toolName === 'markFieldUnknown') {
          const { field } = toolCall.args as { field: string };
          setUnknownFields((prev) => {
            if (prev.has(field)) return prev;
            const next = new Set(prev);
            next.add(field);
            return next;
          });
          return { marked: field };
        }
      },
    });

  const lastMessage = messages[messages.length - 1];
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, lastMessage?.content]);

  useEffect(() => {
    if (form.annualDemandKwh == null || form.houseSize == null) {
      setRecommendation(null);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setUpdating(true);
      try {
        const res = await fetch('/api/homeowner/offer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, unknownFields: unknownArray }),
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as OfferResponse;
        setRecommendation(data.recommendation);
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
      } finally {
        setUpdating(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [form, unknownArray]);

  return (
    <main className="mx-auto max-w-6xl p-6 pb-40">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Home owner</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[6fr_4fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ask the renewable-energy advisor</CardTitle>
            <CardDescription>
              Answer a few quick questions and an offer will appear on the right.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {messages.length === 0 && (
              <p className="self-start rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
                Say hi to get started — the advisor will ask one quick question at a time.
              </p>
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
            <div ref={messagesEndRef} aria-hidden className="scroll-mb-24" />
          </CardContent>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <OfferCard
            rec={recommendation}
            updating={updating}
            placeholder="Tell me your annual electricity use and house size to see your first offer."
          />
          {recommendation && (
            <Button
              size="lg"
              className="w-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-indigo-500 text-white shadow-lg shadow-fuchsia-500/30 transition-transform hover:scale-[1.02] hover:from-pink-400 hover:via-fuchsia-400 hover:to-indigo-400 hover:text-white"
            >
              Get quote
            </Button>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-6xl gap-2 px-6 py-3"
        >
          <Textarea
            value={input}
            onChange={handleInputChange}
            placeholder="Type your reply…"
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
      </div>
    </main>
  );
}
