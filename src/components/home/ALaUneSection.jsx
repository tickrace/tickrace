// src/components/home/ALaUneSection.jsx
import React, { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { supabase } from "../../supabase";

const fmtDate = (d) =>
  d
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(typeof d === "string" ? new Date(d) : d)
    : "";

function Card({ children, className = "" }) {
  return (
    <div
      className={[
        "rounded-2xl bg-white shadow-lg shadow-neutral-900/5 ring-1 ring-neutral-200",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export default function ALaUneSection({
  // fallback local (si aucune Une en DB)
  fallback = {
    title: "Le site est en cours de développement",
    body:
      "Tickrace évolue chaque semaine : nouvelles fonctionnalités, pages organisateurs, outils de gestion, etc.",
    link_url: "/fonctionnalites",
    image_url: "/OIP.jpg", // tu peux changer par OIP2/3/4
    published_at: new Date(),
  },
}) {
  const [loading, setLoading] = useState(true);
  const [une, setUne] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from("home_a_la_une")
          .select("id, title, body, link_url, image_url, published_at")
          .eq("is_active", true)
          .order("published_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        setUne(data || null);
      } catch (e) {
        console.error("[ALaUneSection] fetch error:", e);
        setUne(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const content = useMemo(() => {
    if (loading) return null;
    return une || fallback;
  }, [loading, une, fallback]);

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-5">
          <div className="lg:col-span-2 h-44 lg:h-full bg-neutral-100 animate-pulse" />
          <div className="lg:col-span-3 p-5 space-y-3">
            <div className="h-4 w-28 bg-neutral-100 rounded animate-pulse" />
            <div className="h-6 w-2/3 bg-neutral-100 rounded animate-pulse" />
            <div className="h-4 w-full bg-neutral-100 rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-neutral-100 rounded animate-pulse" />
            <div className="h-10 w-40 bg-neutral-100 rounded-xl animate-pulse" />
          </div>
        </div>
      </Card>
    );
  }

  if (!content) return null;

  const img = content.image_url || fallback.image_url;

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-5">
        <div className="lg:col-span-2 relative">
          <div className="absolute left-4 top-4 z-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-neutral-900/80 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/10">
              À LA UNE
            </span>
          </div>
          <div className="h-48 lg:h-full bg-neutral-100">
            {img ? (
              <img
                src={img}
                alt={content.title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full grid place-items-center text-neutral-400">
                (image)
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {fmtDate(content.published_at)}
            </span>
            <span className="text-neutral-300">•</span>
            <span>Mis à jour régulièrement</span>
          </div>

          <h3 className="mt-2 text-xl sm:text-2xl font-black tracking-tight">
            {content.title}
          </h3>

          <p className="mt-2 text-sm text-neutral-700 whitespace-pre-line">
            {content.body}
          </p>

          {content.link_url && (
            <a
              href={content.link_url}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              En savoir plus <ArrowUpRight className="h-4 w-4 opacity-80" />
            </a>
          )}

          {/* Petit disclaimer “site en cours de dev” (toujours visible, discret) */}
          <div className="mt-4 text-[11px] text-neutral-500">
            Le site est en cours de développement : certaines fonctionnalités et pages évoluent chaque semaine.
          </div>
        </div>
      </div>
    </Card>
  );
}
