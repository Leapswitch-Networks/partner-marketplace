"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { navIcon } from "@/components/dashboard/navIcons";
import { aiApi, type ChatReply } from "@/lib/api/aiApi";
import { extractApiError } from "@/lib/utils/apiError";

/**
 * The assistant, in the corner of every signed-in page.
 *
 * **It renders nothing at all unless the integration is on and the caller may
 * use it.** That is one request on mount to `/ai/availability` — two booleans,
 * needing only `ai-assistant-use`, deliberately separate from the settings route
 * which reports configuration and needs a credential permission.
 *
 * ## Two things this shows that the reference's widget does not
 *
 * **Which tools ran.** An answer drawn from the database and an answer composed
 * without touching it look identical, and the difference is the single most
 * useful thing a reader can know about a reply. It is printed under each answer.
 *
 * **A failed exchange keeps the question.** The server persists the user's
 * message before it calls the model, so a 502 leaves the thread showing what was
 * asked. The panel matches that: the question stays on screen with the error
 * beneath it, rather than the input clearing into nothing.
 */

type Turn = {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  tools?: string[];
};

const TOOL_LABELS: Record<string, string> = {
  describe_schema: "read the schema",
  database_query: "queried the database",
  locate_data: "searched the app",
};

export default function AssistantWidget() {
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [rated, setRated] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await aiApi.availability();
        if (live) setAvailable(res.data.available && res.data.can_use);
      } catch {
        // A 401/403 here is the normal case for most roles. The widget simply
        // does not appear; an error banner for a feature you cannot use would be
        // noise on every page.
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, open]);

  const send = useCallback(async () => {
    const message = draft.trim();
    if (!message || sending) return;

    setDraft("");
    setSending(true);
    setTurns((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: message }]);

    try {
      const res = await aiApi.chat(message, conversationId);
      const reply: ChatReply = res.data;
      setConversationId(reply.conversation_id);
      setRated(false);
      setTurns((prev) => [
        ...prev,
        {
          id: `a-${reply.conversation_id}-${prev.length}`,
          role: "assistant",
          content: reply.reply || "The assistant returned nothing.",
          tools: reply.tools_used,
        },
      ]);
    } catch (err) {
      setTurns((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "error",
          content: extractApiError(err, "The assistant could not respond right now."),
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [draft, sending, conversationId]);

  const rate = async (helpful: boolean) => {
    setRated(true);
    try {
      await aiApi.feedback(helpful, conversationId);
    } catch {
      // Feedback failing is not worth telling anyone about — the answer is
      // already on screen and this is a background signal.
    }
  };

  if (!available) return null;

  return (
    <>
      {open && (
        <section
          aria-label="AI assistant"
          className="fixed bottom-20 right-4 z-40 flex h-[28rem] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[8px] border border-brand/20 bg-white shadow-xl dark:border-night-border dark:bg-night-card"
        >
          <header className="flex items-center justify-between gap-2 border-b border-brand/15 px-3 py-2 dark:border-night-border">
            <p className="text-xs font-semibold text-ink dark:text-gray-100">Assistant</p>
            <button
              type="button"
              onClick={() => {
                setTurns([]);
                setConversationId(null);
              }}
              className="text-[11px] font-semibold text-brand hover:underline dark:text-brand-on-dark"
            >
              New conversation
            </button>
          </header>

          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
            {turns.length === 0 && (
              <p className="pt-6 text-center text-[11px] text-ink-label dark:text-night-muted">
                Ask about users, roles, partners or where something lives.
                <br />
                Answers come from this application&apos;s data — never from memory.
              </p>
            )}

            {turns.map((turn) => (
              <div
                key={turn.id}
                className={
                  turn.role === "user"
                    ? "ml-6 rounded-[6px] bg-brand/10 px-2.5 py-1.5 text-xs text-ink dark:text-gray-100"
                    : turn.role === "error"
                      ? "mr-6 rounded-[6px] border border-tone-danger/40 bg-tone-danger/10 px-2.5 py-1.5 text-xs text-tone-danger"
                      : "mr-6 rounded-[6px] bg-surface-tile px-2.5 py-1.5 text-xs text-ink dark:bg-night-body dark:text-gray-200"
                }
              >
                <p className="whitespace-pre-wrap">{turn.content}</p>
                {turn.tools && turn.tools.length > 0 && (
                  <p className="mt-1 text-[10px] text-ink-label dark:text-night-muted">
                    {turn.tools.map((tool) => TOOL_LABELS[tool] ?? tool).join(" · ")}
                  </p>
                )}
              </div>
            ))}

            {sending && (
              <p className="mr-6 text-[11px] text-ink-label dark:text-night-muted">Thinking…</p>
            )}

            {turns.some((t) => t.role === "assistant") && !rated && !sending && (
              <div className="flex items-center gap-2 pt-1 text-[10px] text-ink-label dark:text-night-muted">
                Was that useful?
                <button type="button" onClick={() => rate(true)} className="hover:underline">
                  Yes
                </button>
                <button type="button" onClick={() => rate(false)} className="hover:underline">
                  No
                </button>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
            className="flex items-end gap-2 border-t border-brand/15 p-2 dark:border-night-border"
          >
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                // Enter sends, Shift+Enter breaks the line — the convention every
                // chat input uses, and getting it backwards is instantly annoying.
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              rows={2}
              maxLength={4000}
              placeholder="Ask a question…"
              aria-label="Message the assistant"
              className="min-h-[2.5rem] flex-1 resize-none rounded-[5px] border-2 border-brand/20 bg-white px-2.5 py-1.5 text-xs text-ink outline-none transition focus:border-brand dark:border-night-border dark:bg-night-body dark:text-gray-100"
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              className="rounded-[5px] bg-brand px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close the assistant" : "Open the assistant"}
        aria-expanded={open}
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-lg transition hover:bg-brand/90"
      >
        {navIcon("ai")}
      </button>
    </>
  );
}
