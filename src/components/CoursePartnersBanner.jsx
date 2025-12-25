import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { ExternalLink } from "lucide-react";

export default function CoursePartnersBanner({ courseId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const withLogoUrl = useMemo(() => {
    return items.map((p) => {
      const logoUrl =
        p.logo_path
          ? supabase.storage.from("courses").getPublicUrl(p.logo_path).data.publicUrl
          : null;
      return { ...p, logoUrl };
    });
  }, [items]);

  useEffect(() => {
    if (!courseId) return;

    let alive = true;
    const fetchPartners = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("course_partenaires")
        .select("id, nom, site_url, logo_path, type, ordre")
        .eq("course_id", courseId)
        .eq("is_active", true)
        .order("ordre", { ascending: true })
        .order("created_at", { ascending: true });

      if (!alive) return;
      if (error) {
        console.error(error);
        setItems([]);
      } else {
        setItems(data || []);
      }
      setLoading(false);
    };

    fetchPartners();
    return () => {
      alive = false;
    };
  }, [courseId]);

  if (loading) return null;
  if (!withLogoUrl.length) return null;

  const sponsors = withLogoUrl.filter((x) => x.type === "sponsor");
  const partenaires = withLogoUrl.filter((x) => x.type !== "sponsor");

  const Block = ({ title, list }) => {
    if (!list.length) return null;
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-extrabold text-neutral-900">{title}</h3>
          <span className="text-xs text-neutral-500">{list.length}</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {list.map((p) => {
            const content = (
              <div className="group inline-flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 hover:bg-white transition">
                {p.logoUrl ? (
                  <img
                    src={p.logoUrl}
                    alt={p.nom}
                    className="h-8 w-8 rounded-lg object-contain bg-white border border-neutral-200"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-white border border-neutral-200" />
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-neutral-900">
                    {p.nom}
                  </div>
                  {p.site_url ? (
                    <div className="flex items-center gap-1 text-xs text-neutral-500">
                      Site <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-500">Partenaire</div>
                  )}
                </div>
              </div>
            );

            if (!p.site_url) return <div key={p.id}>{content}</div>;

            return (
              <a
                key={p.id}
                href={p.site_url}
                target="_blank"
                rel="noopener noreferrer"
                className="outline-none focus:ring-2 focus:ring-orange-300 rounded-2xl"
              >
                {content}
              </a>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section className="mt-10">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4">
          <Block title="Sponsors" list={sponsors} />
          <Block title="Partenaires" list={partenaires} />
        </div>
      </div>
    </section>
  );
}
