// src/components/OrgaBenevolesCard.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";

export default function OrgaBenevolesCard() {
  const { session } = useUser();
  const userId = session?.user?.id || null;
  const [loading, setLoading] = useState(true);
  const [countNew, setCountNew] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let abort = false;

    (async () => {
      setLoading(true);
      // 1) Récupérer les courses de l'orga
      const { data: courses } = await supabase
        .from("courses")
        .select("id")
        .eq("organisateur_id", userId);

      const ids = (courses || []).map((c) => c.id);

      // 2) Compter les inscriptions bénévoles statut = 'nouveau' sur ces courses
      let total = 0;
      if (ids.length) {
        const { count } = await supabase
          .from("benevoles_inscriptions")
          .select("id", { count: "exact", head: true })
          .in("course_id", ids)
          .eq("statut", "nouveau");
        total = count || 0;
      }

      if (!abort) {
        setCountNew(total);
        setLoading(false);
      }
    })();

    return () => { abort = true; };
  }, [userId]);

  return (
    <div className="rounded-2xl border bg-white shadow-sm p-5 flex items-start justify-between gap-4">
      <div>
        <div className="text-sm text-neutral-600">Gestion</div>
        <h3 className="text-lg font-semibold">Bénévoles</h3>
        <p className="mt-1 text-sm text-neutral-600">
          Consultez, changez le statut, ajoutez des notes, exportez en CSV.
        </p>
        <Link
          to="/organisateur/benevoles"
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-white text-sm font-semibold hover:brightness-110"
        >
          Ouvrir la page bénévoles
        </Link>
      </div>
      <div className="shrink-0">
        <div className="text-sm text-neutral-600">Nouveaux</div>
        <div className="mt-1 inline-flex items-center justify-center rounded-xl border px-3 py-2 font-semibold text-neutral-900 min-w-[56px] text-center">
          {loading ? "…" : countNew}
        </div>
      </div>
    </div>
  );
}
