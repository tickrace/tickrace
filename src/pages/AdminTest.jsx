// src/pages/AdminTest.jsx
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";

function Block({ title, children }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="p-5 border-b border-neutral-100">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function StatusPill({ ok, label }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
        ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
      }`}
    >
      {label}
    </span>
  );
}

export default function AdminTest() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const [courseId, setCourseId] = useState("");
  const [formatId, setFormatId] = useState("");

  const summary = useMemo(() => {
    if (!result) return null;
    const okCount = Object.values(result).filter((x) => x?.ok).length;
    const total = Object.values(result).length;
    return { okCount, total };
  }, [result]);

  async function runDiagnostics() {
    setRunning(true);
    try {
      const out = {};

      // Session
      const sess = await supabase.auth.getSession();
      out.session = {
        ok: !!sess?.data?.session?.user,
        data: sess?.data?.session?.user
          ? {
              id: sess.data.session.user.id,
              email: sess.data.session.user.email,
            }
          : null,
        error: null,
      };

      // Courses (liste)
      {
        const { data, error } = await supabase
          .from("courses")
          .select("id,nom,created_at")
          .order("created_at", { ascending: false })
          .limit(5);
        out.courses = { ok: !error, data: data || null, error: error?.message || null };
      }

      // Formats (liste)
      {
        const { data, error } = await supabase
          .from("formats")
          .select("id,course_id,nom,type_format,prix,created_at")
          .order("created_at", { ascending: false })
          .limit(5);
        out.formats = { ok: !error, data: data || null, error: error?.message || null };
      }

      // ✅ Check “accepted_justificatifs” (reproduit/valide ton erreur)
      {
        const { data, error } = await supabase
          .from("formats")
          .select("id,accepted_justificatifs")
          .limit(1);
        out.accepted_justificatifs_column = {
          ok: !error,
          data: data || null,
          error: error?.message || null,
        };
      }

      // course_justificatif_policies (global course)
      if (courseId) {
        const { data, error } = await supabase
          .from("course_justificatif_policies")
          .select("*")
          .eq("course_id", courseId)
          .is("format_id", null)
          .maybeSingle();
        out.policy_course = { ok: !error, data: data || null, error: error?.message || null };
      } else {
        out.policy_course = { ok: true, data: "(courseId vide)", error: null };
      }

      // justificatif_types
      {
        const { data, error } = await supabase
          .from("justificatif_types")
          .select("code,label,input_mode,is_medical,sort_order,is_active")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .limit(20);
        out.justificatif_types = { ok: !error, data: data || null, error: error?.message || null };
      }

      // options_catalogue (si formatId)
      if (formatId) {
        const { data, error } = await supabase
          .from("options_catalogue")
          .select("id,label,price_cents,is_active,max_qty_per_inscription,format_id")
          .eq("format_id", formatId)
          .eq("is_active", true)
          .limit(20);
        out.options_catalogue = { ok: !error, data: data || null, error: error?.message || null };
      } else {
        out.options_catalogue = { ok: true, data: "(formatId vide)", error: null };
      }

      setResult(out);
    } catch (e) {
      setResult({ fatal: { ok: false, data: null, error: String(e?.message || e) } });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link to="/test" className="text-sm text-neutral-500 hover:text-neutral-800">
            ← Index tests
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">AdminTest</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Diagnostics rapides Supabase + check colonne <code>accepted_justificatifs</code>.
          </p>
        </div>

        <button
          type="button"
          onClick={runDiagnostics}
          disabled={running}
          className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
            running ? "bg-neutral-400 cursor-not-allowed" : "bg-neutral-900 hover:bg-black"
          }`}
        >
          {running ? "Diagnostic..." : "Lancer le diagnostic"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Block title="Paramètres (optionnels)">
          <div className="space-y-3">
            <label className="block text-sm">
              <div className="font-medium mb-1">courseId (pour policy)</div>
              <input
                className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                placeholder="uuid course"
              />
            </label>
            <label className="block text-sm">
              <div className="font-medium mb-1">formatId (pour options_catalogue)</div>
              <input
                className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                value={formatId}
                onChange={(e) => setFormatId(e.target.value)}
                placeholder="uuid format"
              />
            </label>

            {summary && (
              <div className="pt-2 text-sm">
                <b>{summary.okCount}</b> / {summary.total} checks OK
              </div>
            )}
          </div>
        </Block>

        <div className="lg:col-span-2 space-y-6">
          <Block title="Résultats">
            {!result ? (
              <div className="text-sm text-neutral-600">Lance le diagnostic pour afficher les résultats.</div>
            ) : (
              <div className="space-y-4">
                {Object.entries(result).map(([key, val]) => (
                  <div key={key} className="rounded-xl border border-neutral-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-sm">{key}</div>
                      <StatusPill ok={!!val?.ok} label={val?.ok ? "OK" : "KO"} />
                    </div>

                    {val?.error ? (
                      <div className="mt-2 text-sm text-red-700">{val.error}</div>
                    ) : null}

                    {val?.data ? (
                      <pre className="mt-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl p-3 overflow-auto">
{JSON.stringify(val.data, null, 2)}
                      </pre>
                    ) : (
                      <div className="mt-2 text-xs text-neutral-500">—</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Block>
        </div>
      </div>
    </div>
  );
}
