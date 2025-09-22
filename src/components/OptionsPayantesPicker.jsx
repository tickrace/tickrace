import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { supabase } from "../supabase";

/**
 * Props:
 * - formatId: string (obligatoire pour charger le catalogue)
 * - onTotalCentsChange?: (totalCents:number) => void
 * - registerPersist?: (fn:(inscriptionId:string)=>Promise<void>) => void
 */
export default function OptionsPayantesPicker({ formatId, onTotalCentsChange, registerPersist }) {
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(true);
  const [options, setOptions] = useState([]);
  const [quantites, setQuantites] = useState({}); // option_id -> qty

  // Refs pour conserver les dernières valeurs dans persist()
  const optionsRef = useRef(options);
  const quantitesRef = useRef(quantites);
  useEffect(() => { optionsRef.current = options; }, [options]);
  useEffect(() => { quantitesRef.current = quantites; }, [quantites]);

  useEffect(() => {
    let abort = false;
    async function load() {
      if (!formatId) return;
      setLoading(true);

      const { data, error } = await supabase
        .from("options_catalogue")
        .select("*")
        .eq("format_id", formatId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (abort) return;

      if (error) {
        setSupported(false);
        setOptions([]);
        setQuantites({});
        setLoading(false);
        onTotalCentsChange?.(0);
        return;
      }

      const rows = data || [];
      setSupported(true);
      setOptions(rows);

      // init qty à 0
      const init = {};
      rows.forEach((o) => { init[o.id] = 0; });
      setQuantites(init);
      setLoading(false);
    }
    load();
    return () => { abort = true; };
  }, [formatId, onTotalCentsChange]);

  const totalOptionsCents = useMemo(() => {
    return options.reduce((acc, o) => {
      const q = Number(quantites[o.id] || 0);
      return acc + q * Number(o.price_cents || 0);
    }, 0);
  }, [options, quantites]);

  useEffect(() => {
    onTotalCentsChange?.(totalOptionsCents);
  }, [totalOptionsCents, onTotalCentsChange]);

  // Persistance dans inscriptions_options (pending)
  const persist = useCallback(async (inscriptionId) => {
    if (!supported || !inscriptionId) return;

    await supabase
      .from("inscriptions_options")
      .delete()
      .eq("inscription_id", inscriptionId)
      .eq("status", "pending");

    const curOptions = optionsRef.current || [];
    const curQty = quantitesRef.current || {};
    const rows = [];

    for (const o of curOptions) {
      const q = Number(curQty[o.id] || 0);
      const max = Number(o.max_qty_per_inscription ?? 10);
      if (q > 0 && q <= max) {
        rows.push({
          inscription_id: inscriptionId,
          option_id: o.id,
          quantity: q,
          prix_unitaire_cents: Number(o.price_cents || 0),
          status: "pending",
        });
      }
    }
    if (rows.length > 0) {
      const { error } = await supabase.from("inscriptions_options").insert(rows);
      if (error) console.error("❌ insert inscriptions_options:", error);
    }
  }, [supported]);

  // Expose persist() une seule fois
  useEffect(() => {
    registerPersist?.(persist);
  }, [registerPersist, persist]);

  if (!supported || !formatId) return null;
  if (loading) {
    return (
      <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="p-5 border-b border-neutral-100">
          <h2 className="text-lg font-semibold">Options payantes</h2>
        </div>
        <div className="p-5 text-sm text-neutral-500">Chargement…</div>
      </section>
    );
  }
  if (options.length === 0) return null;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="p-5 border-b border-neutral-100">
        <h2 className="text-lg font-semibold">Options payantes</h2>
        <p className="text-sm text-neutral-500">Sélectionne les quantités souhaitées.</p>
      </div>
      <div className="p-5 space-y-3">
        {options.map((o) => {
          const q = Number(quantites[o.id] || 0);
          const max = Number(o.max_qty_per_inscription ?? 10);
          const prixCents = Number(o.price_cents || 0);
          return (
            <div key={o.id} className="flex items-start justify-between gap-3 rounded-xl border border-neutral-200 p-3">
              <div className="text-sm">
                <div className="font-medium">
                  {o.label} · {(prixCents / 100).toFixed(2)} €
                </div>
                {o.description && (
                  <div className="text-neutral-600">{o.description}</div>
                )}
                <div className="text-xs text-neutral-500">
                  Quantité autorisée : 0–{max}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border px-2 py-1 text-sm"
                  onClick={() =>
                    setQuantites((s) => ({ ...s, [o.id]: Math.max(0, q - 1) }))
                  }
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  max={max}
                  value={q}
                  onChange={(e) => {
                    const v = Number(e.target.value || 0);
                    const clamped = Math.min(Math.max(v, 0), max);
                    setQuantites((s) => ({ ...s, [o.id]: clamped }));
                  }}
                  
                  className="w-16 rounded-lg border px-2 py-1 text-sm text-center"
                />
                <button
                  type="button"
                  className="rounded-lg border px-2 py-1 text-sm"
                  onClick={() =>
                    setQuantites((s) => ({ ...s, [o.id]: Math.min(max, q + 1) }))
                  }
                >
                  +
                </button>
              </div>
            </div>
          );
        })}

        <div className="mt-2 text-right text-sm">
          Total options : <b>{(totalOptionsCents / 100).toFixed(2)} €</b>
        </div>
      </div>
    </section>
  );
}
