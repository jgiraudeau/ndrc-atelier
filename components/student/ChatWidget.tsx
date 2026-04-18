"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  X,
  Send,
  Sparkles,
  RotateCcw,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type Message = {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
};

// ── Suggestions par contexte ─────────────────────────────────────────────────

const SUGGESTIONS: Record<string, string[]> = {
  wordpress: [
    "Comment installer un thème WordPress ?",
    "Comment optimiser le SEO avec Yoast ?",
    "Comment créer un article de blog ?",
  ],
  prestashop: [
    "Comment ajouter un produit sur PrestaShop ?",
    "Comment configurer les modes de paiement ?",
    "Comment optimiser une fiche produit ?",
  ],
  missions: [
    "C'est quoi une compétence E5B ?",
    "Comment préparer mon oral BTS NDRC ?",
    "Quelles compétences dois-je valider en priorité ?",
  ],
  default: [
    "Explique-moi le référentiel BTS NDRC",
    "Quelle est la différence entre E4 et E5 ?",
    "Comment bien préparer mon examen ?",
  ],
};

function getSuggestions(pathname: string): string[] {
  if (pathname.includes("wordpress")) return SUGGESTIONS.wordpress;
  if (pathname.includes("prestashop")) return SUGGESTIONS.prestashop;
  if (pathname.includes("missions") || pathname.includes("competency"))
    return SUGGESTIONS.missions;
  return SUGGESTIONS.default;
}

function getPlatform(pathname: string): string | undefined {
  if (pathname.includes("wordpress")) return "WORDPRESS";
  if (pathname.includes("prestashop")) return "PRESTASHOP";
  return undefined;
}

function getPageContext(pathname: string): string {
  if (pathname.includes("wordpress"))
    return "L'élève est sur la page WordPress de ses compétences";
  if (pathname.includes("prestashop"))
    return "L'élève est sur la page PrestaShop de ses compétences";
  if (pathname.includes("missions"))
    return "L'élève consulte ses missions d'entraînement";
  if (pathname.includes("competency"))
    return "L'élève consulte le détail d'une compétence";
  if (pathname === "/student")
    return "L'élève est sur son tableau de bord principal";
  return "Console élève NDRC Atelier";
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const suggestions = getSuggestions(pathname);
  const platform = getPlatform(pathname);
  const pageContext = getPageContext(pathname);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  // Focus input when drawer opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: Message = { role: "user", content: trimmed };
      const history = messages.filter((m) => !m.streaming);

      setMessages((prev) => [
        ...prev,
        userMsg,
        { role: "assistant", content: "", streaming: true },
      ]);
      setInput("");
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("ndrc_token")
            : null;

        const res = await fetch("/api/student/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            message: trimmed,
            platform,
            pageContext,
            history: history.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error("Erreur réseau");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const raw = decoder.decode(value, { stream: true });
          const lines = raw.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") break;
            try {
              const { text, error } = JSON.parse(payload);
              if (error) throw new Error(error);
              if (text) {
                accumulated += text;
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last?.role === "assistant") {
                    next[next.length - 1] = {
                      ...last,
                      content: accumulated,
                      streaming: true,
                    };
                  }
                  return next;
                });
              }
            } catch {
              // ignore parse errors mid-stream
            }
          }
        }

        // Finalise le message
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              content: accumulated || "Je n'ai pas pu générer de réponse.",
              streaming: false,
            };
          }
          return next;
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant" && last.streaming) {
            next[next.length - 1] = {
              role: "assistant",
              content:
                "Désolé, une erreur est survenue. Réessaie dans un instant.",
              streaming: false,
            };
          }
          return next;
        });
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [loading, messages, platform, pageContext]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const reset = () => {
    if (loading) {
      abortRef.current?.abort();
      setLoading(false);
    }
    setMessages([]);
    setInput("");
  };

  const isEmpty = messages.length === 0;

  return (
    <>
      {/* ── Drawer overlay ─────────────────────────────────────────────── */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setOpen(false)}
      />

      {/* ── Chat Panel ─────────────────────────────────────────────────── */}
      <div
        className={cn(
          "fixed z-50 flex flex-col transition-all duration-300 ease-out",
          // Mobile : slide-up depuis le bas
          "bottom-20 left-0 right-0 mx-3 rounded-3xl",
          // Desktop : panel fixe en bas à droite
          "md:bottom-6 md:right-6 md:left-auto md:mx-0 md:w-[400px]",
          "h-[75vh] md:h-[560px]",
          "bg-slate-900 border border-white/10 shadow-2xl shadow-black/60",
          open
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-6 scale-95 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 via-indigo-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-900/40">
            <Sparkles size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-white text-sm leading-tight">
              Assistant NDRC
            </h3>
            <p className="text-[11px] text-slate-400 font-medium truncate">
              {platform
                ? `Expert ${platform === "WORDPRESS" ? "WordPress" : "PrestaShop"}`
                : "Pédagogique BTS NDRC"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={reset}
                className="p-2 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-xl transition-colors"
                title="Nouvelle conversation"
              >
                <RotateCcw size={15} />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-2 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-xl transition-colors"
            >
              <ChevronDown size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-indigo-500/20 to-pink-500/20 border border-indigo-500/20 flex items-center justify-center">
                <Sparkles size={26} className="text-indigo-400" />
              </div>
              <div>
                <p className="text-white font-bold text-sm mb-1">
                  Bonjour, je suis ton assistant BTS !
                </p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Pose-moi tes questions sur tes compétences,
                  <br />
                  WordPress, PrestaShop ou ton examen.
                </p>
              </div>
              <div className="w-full space-y-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 border border-white/8 hover:border-indigo-500/30 px-4 py-2.5 rounded-xl transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-2.5",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-cyan-500 via-indigo-500 to-pink-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md shadow-indigo-900/30">
                      <Sparkles size={13} className="text-white" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-indigo-600 text-white rounded-tr-sm"
                        : "bg-white/8 border border-white/8 text-slate-200 rounded-tl-sm"
                    )}
                  >
                    {msg.content ? (
                      <FormattedMessage content={msg.content} />
                    ) : (
                      msg.streaming && (
                        <span className="flex gap-1 py-1">
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                        </span>
                      )
                    )}
                    {msg.streaming && msg.content && (
                      <span className="inline-block w-0.5 h-4 bg-indigo-400 ml-0.5 animate-pulse align-middle" />
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="px-4 pb-4 flex-shrink-0 border-t border-white/8 pt-3">
          <div className="flex items-end gap-2 bg-white/6 border border-white/10 rounded-2xl px-4 py-2 focus-within:border-indigo-500/50 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pose ta question… (Entrée pour envoyer)"
              rows={1}
              disabled={loading}
              className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 resize-none outline-none max-h-28 leading-relaxed py-1 disabled:opacity-50"
              style={{ scrollbarWidth: "none" }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white hover:from-indigo-500 hover:to-blue-500 disabled:opacity-40 transition-all mb-0.5"
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
            </button>
          </div>
          <p className="text-[10px] text-slate-600 text-center mt-2 font-medium">
            IA pédagogique — peut faire des erreurs
          </p>
        </div>
      </div>

      {/* ── FAB ─────────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed z-50 bottom-20 right-4 md:bottom-6 md:right-6",
          "w-14 h-14 rounded-2xl shadow-2xl shadow-indigo-900/60",
          "bg-gradient-to-br from-cyan-500 via-indigo-600 to-pink-600",
          "flex items-center justify-center text-white",
          "hover:scale-105 active:scale-95 transition-transform duration-150",
          open && "rotate-12"
        )}
        aria-label="Ouvrir l'assistant IA"
      >
        {open ? <X size={22} /> : <Sparkles size={22} />}
      </button>
    </>
  );
}

// ── Rendu Markdown simplifié ─────────────────────────────────────────────────

function FormattedMessage({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (line.startsWith("### "))
          return <p key={i} className="font-bold text-indigo-300 text-xs uppercase tracking-wide mt-2">{line.slice(4)}</p>;
        if (line.startsWith("## "))
          return <p key={i} className="font-bold text-white mt-2">{line.slice(3)}</p>;
        if (line.startsWith("**") && line.endsWith("**"))
          return <p key={i} className="font-bold text-slate-100">{line.slice(2, -2)}</p>;
        if (line.startsWith("- ") || line.startsWith("• "))
          return (
            <div key={i} className="flex gap-2">
              <span className="text-indigo-400 flex-shrink-0 mt-0.5">•</span>
              <span>{line.slice(2)}</span>
            </div>
          );
        if (line.trim() === "") return <div key={i} className="h-1" />;
        // Inline bold (**text**)
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        if (parts.length > 1) {
          return (
            <p key={i}>
              {parts.map((part, j) =>
                part.startsWith("**") && part.endsWith("**") ? (
                  <strong key={j} className="text-slate-100 font-bold">{part.slice(2, -2)}</strong>
                ) : (
                  <span key={j}>{part}</span>
                )
              )}
            </p>
          );
        }
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}
