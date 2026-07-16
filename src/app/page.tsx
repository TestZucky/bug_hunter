"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Bug, Star, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { useUserStore } from "@/stores/userStore";

type Lang = "mixed" | "javascript" | "python";

const LANGS: { id: Lang; label: string; hint: string }[] = [
  { id: "javascript", label: "JavaScript", hint: "JS / TS bugs" },
  { id: "python", label: "Python", hint: "Python bugs" },
  { id: "mixed", label: "Mixed", hint: "A bit of both" },
];

export default function StartScreen() {
  const router = useRouter();
  const storedName = useUserStore((s) => s.displayName);
  const setDisplayName = useUserStore((s) => s.setDisplayName);
  const best = useUserStore((s) => s.bestScores.classic ?? 0);

  const [name, setName] = useState("");
  const [lang, setLang] = useState<Lang>("javascript");
  const [ready, setReady] = useState(false);

  // Prefill the name from local storage once hydrated.
  useEffect(() => {
    if (storedName && storedName !== "you") setName(storedName);
    setReady(true);
  }, [storedName]);

  function start() {
    const finalName = name.trim() || "Player";
    setDisplayName(finalName);
    router.push(`/play?lang=${lang}`);
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-5 py-8 max-w-[440px] mx-auto w-full">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full"
      >
        {/* Logo */}
        <div className="flex flex-col items-center text-center mb-8">
          <div
            className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #6366f1, #a78bfa)" }}
          >
            <Bug className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Bug<span style={{ color: "#6366f1" }}>Hunter</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tap the buggy line. Beat the clock.
          </p>
        </div>

        {/* Name */}
        <label className="block text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
          Your name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && start()}
          placeholder="Enter a name"
          maxLength={24}
          autoComplete="off"
          className="w-full px-4 py-3.5 rounded-2xl border border-border bg-transparent outline-none focus:border-primary text-base mb-6"
          style={{ background: "rgba(255,255,255,0.03)" }}
        />

        {/* Language */}
        <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
          Language
        </div>
        <div className="flex flex-col gap-2 mb-7">
          {LANGS.map((l) => (
            <button
              key={l.id}
              onClick={() => setLang(l.id)}
              className={cn(
                "flex items-center justify-between px-4 py-3.5 rounded-2xl border text-left transition-colors active:scale-[0.99]",
                lang === l.id ? "border-transparent" : "border-border",
              )}
              style={
                lang === l.id
                  ? { background: "linear-gradient(135deg, #6366f1, #7c3aed)" }
                  : { background: "rgba(255,255,255,0.03)" }
              }
            >
              <span
                className={cn(
                  "font-semibold text-sm",
                  lang === l.id ? "text-white" : "text-foreground",
                )}
              >
                {l.label}
              </span>
              <span
                className={cn(
                  "text-xs",
                  lang === l.id ? "text-white/70" : "text-muted-foreground",
                )}
              >
                {l.hint}
              </span>
            </button>
          ))}
        </div>

        {/* Start */}
        <button
          onClick={start}
          disabled={!ready}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-base transition-transform active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #6366f1, #7c3aed)",
            color: "#fff",
            boxShadow: "0 8px 32px rgba(99,102,241,0.4)",
          }}
        >
          <Bug className="w-5 h-5" /> Start game
        </button>

        {/* Best + stats */}
        <div className="flex items-center justify-center gap-4 mt-6 text-sm">
          {ready && best > 0 && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Star className="w-4 h-4" style={{ color: "#fbbf24" }} /> Best{" "}
              {best.toLocaleString()}
            </span>
          )}
          <Link
            href="/profile"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Trophy className="w-4 h-4" /> Stats
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
