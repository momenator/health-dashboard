import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, HeartPulse, User, ArrowRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { type CopilotResponse } from "@/lib/ai-mock";
import { askData } from "@/lib/api";
import { ExternalContextChip } from "@/components/ExternalContextPanel";
import { ChatChart } from "@/components/ChatChart";

export const Route = createFileRoute("/_app/projects/$projectId/ask")({
  component: ProjectAskPage,
});

import { useParams } from "@tanstack/react-router";
import { getProject, type Project } from "@/lib/projects";
function useProject(): Project {
  const { projectId } = useParams({ from: "/_app/projects/$projectId" });
  return getProject(projectId)!;
}

type Msg = { role: "user"; text: string } | { role: "assistant"; resp: CopilotResponse };

function ProjectAskPage() {
  const project = useProject();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Reset chat when switching projects.
  useEffect(() => {
    setMessages([]);
  }, [project.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    const resp = await askData({ question: text, projectId: project.id });
    setMessages((m) => [...m, { role: "assistant", resp }]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)]">
      <div className="mb-3 text-sm text-muted-foreground">
        Ask anything about <span className="font-medium text-foreground">{project.name}</span>.
        Answers are grounded in this project's data; external context is suggested as a possible
        explanation.
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.length === 0 && (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" /> Try a {project.name}-specific question
              </div>
              <div className="mt-3 grid sm:grid-cols-2 gap-2">
                {project.suggestedPrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="text-left text-sm rounded-lg border bg-card hover:bg-accent/40 hover:border-primary/40 px-3 py-2.5 transition"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex items-start gap-3 justify-end">
              <div className="rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 max-w-[80%] text-sm">
                {m.text}
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <User className="h-4 w-4" />
              </div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <HeartPulse className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-3">
                <div className="prose prose-sm max-w-none text-foreground">
                  <ReactMarkdown>{m.resp.answer}</ReactMarkdown>
                </div>
                {m.resp.chart && <ChatChart chart={m.resp.chart} />}
                {m.resp.metric && (
                  <Card className="bg-muted/40 border-muted">
                    <CardContent className="p-3 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        {m.resp.metric.label}
                      </span>
                      <span className="font-semibold tabular-nums">{m.resp.metric.value}</span>
                    </CardContent>
                  </Card>
                )}
                {m.resp.context && <ExternalContextChip event={m.resp.context} />}
                <div className="flex items-start gap-2 text-sm rounded-lg border-l-2 border-primary bg-primary/5 px-3 py-2">
                  <ArrowRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <span>
                    <span className="font-medium">Next step:</span> {m.resp.nextStep}
                  </span>
                </div>
              </div>
            </div>
          ),
        )}
        {loading && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <HeartPulse className="h-4 w-4 animate-pulse" />
            </div>
            <div className="text-sm text-muted-foreground">Analyzing {project.name} data…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="mt-4 flex gap-2 items-end border rounded-2xl bg-card p-2 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder={`Ask about ${project.name}…`}
          className="min-h-[44px] max-h-32 border-0 shadow-none focus-visible:ring-0 resize-none"
        />
        <Button type="submit" size="icon" disabled={loading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
