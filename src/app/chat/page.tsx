"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureAnonymousAuth } from "@/lib/auth";
import { getStartNode } from "@/lib/chat/question-graph";
import {
  generateKeywords,
  generateZodiacChart,
} from "@/lib/chat/llm-engine";
import MessageBubble from "@/components/chat/MessageBubble";
import OptionCards from "@/components/chat/OptionCards";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import ResultsPanel from "@/components/results/ResultsPanel";
import EmailLinkDialog from "@/components/auth/EmailLinkDialog";
import type {
  ChatMessage,
  OptionItem,
  SessionSummary,
  ZodiacMatch,
} from "@/types";

export default function ChatPage() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [phase, setPhase] = useState<string>("sketch");
  const [summary, setSummary] = useState<SessionSummary>({});
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [lastPortraitUrl, setLastPortraitUrl] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isFreeTier, setIsFreeTier] = useState(true);

  // Result cards data
  const [keywords, setKeywords] = useState<string[]>([]);
  const [zodiacMatches, setZodiacMatches] = useState<ZodiacMatch[]>([]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  // Initialize: auth + session + first message
  const initRef = useRef(false);
  const init = useCallback(async () => {
    setAuthError(null);
    setInitializing(true);
    async function run() {
      // Check age gate
      const ageVerified = localStorage.getItem("soulsketch_age_verified");
      if (ageVerified !== "true") {
        router.replace("/age-gate");
        return;
      }

      try {
        // Ensure anonymous auth
        await ensureAnonymousAuth();

        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) throw new Error("Auth failed");

        // Check entitlements for plan
        const { data: entitlement } = await supabase
          .from("entitlements")
          .select("plan, export_credits")
          .eq("user_id", user.id)
          .single();
        if (entitlement && entitlement.plan !== "free") {
          setIsFreeTier(false);
        }

        // Get or create session
        const { data: existing } = await supabase
          .from("persona_sessions")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        let session = existing;

        if (!session) {
          const { data: created, error } = await supabase
            .from("persona_sessions")
            .insert({ user_id: user.id })
            .select()
            .single();
          if (error) throw error;
          session = created;
        }

        setSessionId(session.id);
        setPhase(session.current_phase);
        setSummary((session.summary_json as SessionSummary) ?? {});

        // Load existing messages
        const { data: existingMessages } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("session_id", session.id)
          .order("created_at", { ascending: true });

        if (existingMessages && existingMessages.length > 0) {
          setMessages(existingMessages as ChatMessage[]);

          // Find the current node from message history
          if (session.current_phase === "sketch") {
            // Count assistant messages to determine which question we're on
            const assistantMsgs = existingMessages.filter(
              (m) => m.role === "assistant" && m.content_options,
            );
            const nodeMap = [
              "q1_gender",
              "q2_body_type",
              "q3_vibe",
              "q4_style",
              "q5_hair",
            ];
            const nextIdx = Math.min(
              assistantMsgs.length,
              nodeMap.length - 1,
            );
            setCurrentNodeId(nodeMap[nextIdx]);
          }

          // Check if session is done
          if (session.current_phase === "done") {
            const smry = (session.summary_json as SessionSummary) ?? {};
            setShowResults(true);
            setKeywords(generateKeywords(smry));
            if (smry.zodiac) {
              setZodiacMatches(generateZodiacChart(smry.zodiac));
            }
            // Find last portrait URL
            const lastImg = [...existingMessages]
              .reverse()
              .find((m) => m.content_image_url);
            if (lastImg) setLastPortraitUrl(lastImg.content_image_url);
          }

          setInitializing(false);
          return;
        }

        // Send first message (opening)
        const startNode = getStartNode();
        setCurrentNodeId(startNode.id);

        const firstMessage: Omit<ChatMessage, "id" | "created_at"> = {
          session_id: session.id,
          role: "assistant",
          content_text: startNode.question_text,
          content_options: startNode.options,
          content_image_url: null,
          sketch_level: startNode.detail_level,
        };

        const { data: saved } = await supabase
          .from("chat_messages")
          .insert({
            ...firstMessage,
            content_options: JSON.stringify(firstMessage.content_options),
          })
          .select()
          .single();

        if (saved) {
          setMessages([saved as ChatMessage]);
        }
      } catch (error) {
        console.error("Init error:", error);
        setAuthError(
          error instanceof Error ? error.message : "Failed to connect. Please try again.",
        );
      } finally {
        setInitializing(false);
      }
    }

    run();
  }, [router]);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      init();
    }
  }, [init]);

  async function sendMessage(text: string, selectedOption?: string) {
    if (!sessionId || loading) return;
    setLoading(true);

    // Add user message locally
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      role: "user",
      content_text: selectedOption || text,
      content_options: null,
      content_image_url: null,
      sketch_level: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          user_message: text || undefined,
          selected_option: selectedOption || undefined,
          current_node_id: currentNodeId,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Chat failed");
      }

      const data = await response.json();

      if (data.message) {
        // Parse content_options if it's a string
        const msg = {
          ...data.message,
          content_options:
            typeof data.message.content_options === "string"
              ? JSON.parse(data.message.content_options)
              : data.message.content_options,
        } as ChatMessage;

        setMessages((prev) => [...prev, msg]);

        // Track portrait URL
        if (msg.content_image_url) {
          setLastPortraitUrl(msg.content_image_url);
        }
      }

      if (data.phase) setPhase(data.phase);
      if (data.next_node_id) setCurrentNodeId(data.next_node_id);
      if (data.summary) setSummary(data.summary);

      // Show results if done
      if (data.show_results && data.summary) {
        const smry = data.summary as SessionSummary;
        setShowResults(true);
        setKeywords(generateKeywords(smry));
        if (smry.zodiac) {
          setZodiacMatches(generateZodiacChart(smry.zodiac));
        }

        // Prompt anonymous users to link their email to save results
        const { isAnonymousUser } = await import("@/lib/auth");
        const anon = await isAnonymousUser();
        if (anon) {
          setShowEmailDialog(true);
        }
      }
    } catch (error) {
      console.error("Send error:", error);
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        session_id: sessionId,
        role: "assistant",
        content_text:
          "Oops, something went wrong! Please try again.",
        content_options: null,
        content_image_url: null,
        sketch_level: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }

  function handleOptionSelect(option: OptionItem) {
    sendMessage("", option.value);
  }

  function handleTextSend(text: string) {
    sendMessage(text);
  }

  // Get latest options from the last assistant message
  const lastAssistantMsg = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && m.content_options);

  const currentOptions: OptionItem[] | null = lastAssistantMsg?.content_options
    ? typeof lastAssistantMsg.content_options === "string"
      ? JSON.parse(lastAssistantMsg.content_options)
      : lastAssistantMsg.content_options
    : null;

  if (authError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface p-6">
        <div className="max-w-sm rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
          <div className="mb-4 text-4xl">&#9888;&#65039;</div>
          <h2 className="text-lg font-semibold text-red-400">Connection Error</h2>
          <p className="mt-2 text-sm text-red-300/70">{authError}</p>
          <button
            onClick={init}
            className="mt-6 rounded-xl bg-primary px-6 py-2.5 font-medium text-white transition-colors hover:bg-primary-dark"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (initializing) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <div className="text-center">
          <div className="mb-4 flex justify-center gap-1">
            <div className="typing-dot h-3 w-3 rounded-full bg-primary" />
            <div className="typing-dot h-3 w-3 rounded-full bg-primary" />
            <div className="typing-dot h-3 w-3 rounded-full bg-primary" />
          </div>
          <p className="text-sm text-text-muted">Setting up your session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-surface-lighter bg-surface/80 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-text">SoulSketch</h1>
            <p className="text-xs text-text-muted">
              {phase === "sketch" && "Drawing your soulmate..."}
              {phase === "ai_gen" && "AI portrait generation"}
              {phase === "calibration" && "Final calibration"}
              {phase === "done" && "Results ready!"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary-light">
              {phase === "sketch"
                ? `Round ${messages.filter((m) => m.role === "user").length + 1}`
                : phase}
            </span>
          </div>
        </div>
      </header>

      {/* Messages area */}
      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 py-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isFreeTier={isFreeTier} />
        ))}

        {loading && <TypingIndicator />}

        {/* Results panel */}
        {showResults && (
          <ResultsPanel
            portraitUrl={lastPortraitUrl || ""}
            keywords={keywords}
            zodiacMatches={zodiacMatches}
            userSign={summary.zodiac || "Unknown"}
            sessionId={sessionId || undefined}
            isFreeTier={isFreeTier}
            onRequireEmail={() => setShowEmailDialog(true)}
          />
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Options + Input */}
      {!showResults && (
        <div className="mx-auto w-full max-w-2xl">
          {currentOptions && !loading && (
            <OptionCards
              options={currentOptions}
              onSelect={handleOptionSelect}
              disabled={loading}
            />
          )}
          <ChatInput
            onSend={handleTextSend}
            disabled={loading || phase === "done"}
            placeholder={
              phase === "calibration"
                ? "Enter your zodiac sign..."
                : "Type a message or pick an option..."
            }
          />
        </div>
      )}

      {/* Email link dialog */}
      <EmailLinkDialog
        open={showEmailDialog}
        onClose={() => setShowEmailDialog(false)}
        onLinked={() => {
          setShowEmailDialog(false);
        }}
      />
    </div>
  );
}
