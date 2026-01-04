import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabase";
import { Loader2, ArrowLeft, Hash, Mail, Info } from "lucide-react";

const Container = ({ children }) => (
  <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-8">{children}</div>
);

const Card = ({ children }) => (
  <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">{children}</div>
);

export default function TiragePublic() {
  const { formatId } = useParams();
  const [loading, setLoading] = useState(true);
  const [format, setFormat] = useState(null);
  const [course, setCourse] = useState(null);
  const [draw, setDraw] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data: f, error: fe } = await supabase
          .from("formats")
          .select("id, course_id, nom, date, heure_depart")
          .eq("id", formatId)
          .maybeSingle();
        if (fe) throw fe;
        if (!f) {
          setError("Format introuvable.");
          return;
        }
        setFormat(f);

        const { data: c, error: ce } = await supabase
          .from("courses")
          .select("id, nom, lieu")
          .eq("id", f.course_id)
          .maybeSingle();
        if (ce) throw ce;
        setCourse(c || null);

        const { data: d, error: de } = await supabase
          .from("lottery_draws")
          .select("id, created_at, candidate_count")
          .eq("format_id", formatId)
          .maybeSingle();
        if (de) throw de;
        setDraw(d || null);
      } catch (e) {
        console.error(e);
        setError("Impossible de charger les informations du tirage.");
      } finally {
        setLoading(false);
      }
    };

    if (formatId) load();
  }, [formatId]);

  if (loading) {
    return (
      <Container>
        <div className="flex items-center gap-3 text-gray-700">
          <Loader2 className="h-5 w-5 animate-spin" />
          <div>Chargement…</div>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="mb-4">
        <Link to={course?.id ? `/courses/${course.id}` : "/courses"} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          Retour à l’épreuve
        </Link>
      </div>

      <Card>
        <div className="p-5 border-b border-gray-100">
          <div className="text-lg font-semibold text-gray-900">Tirage au sort</div>
          <div className="text-sm text-gray-600 mt-1">
            {course?.nom ? <div className="font-medium text-gray-900">{course.nom}</div> : null}
            <div className="mt-1">
              <span className="font-medium text-gray-800">{format?.nom || "Format"}</span>
              {course?.lieu ? <span className="text-gray-400"> • </span> : null}
              {course?.lieu ? <span>{course.lieu}</span> : null}
            </div>
          </div>
        </div>

        <div className="p-5 space-y-3">
          {error ? (
            <div className="rounded-xl bg-rose-50 ring-1 ring-rose-200 p-4 text-rose-800 text-sm">{error}</div>
          ) : (
            <>
              <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 p-4 text-sm text-gray-800">
                <div className="flex items-center gap-2 font-semibold text-gray-900">
                  <Info className="h-4 w-4" />
                  Comment ça marche
                </div>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">
                  <li>Le tirage classe tous les candidats.</li>
                  <li>L’organisateur libère ensuite des lots d’invitations (par email).</li>
                  <li>Si tu es tiré(e), tu reçois un email avec un lien d’inscription et un délai (TTL).</li>
                </ul>
              </div>

              {draw ? (
                <div className="rounded-xl bg-white ring-1 ring-gray-200 p-4 text-sm">
                  <div className="flex items-center gap-2 font-semibold text-gray-900">
                    <Hash className="h-4 w-4" />
                    Tirage effectué
                  </div>
                  <div className="mt-2 text-gray-700">
                    Candidats : <strong>{draw.candidate_count ?? "—"}</strong>
                    <div className="text-xs text-gray-500 mt-1">
                      Les invitations sont envoyées par lots. Surveille ta boîte mail.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-white ring-1 ring-gray-200 p-4 text-sm text-gray-700">
                  Tirage pas encore effectué pour ce format.
                </div>
              )}

              <div className="rounded-xl bg-orange-50 ring-1 ring-orange-200 p-4 text-sm text-orange-900">
                <div className="flex items-center gap-2 font-semibold">
                  <Mail className="h-4 w-4" />
                  Astuce
                </div>
                <div className="mt-1">
                  Vérifie aussi tes spams. Les invitations viennent de Tickrace.
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </Container>
  );
}
