--- a/src/pages/MonInscription.jsx
+++ b/src/pages/MonInscription.jsx
@@ -1,7 +1,7 @@
 // src/pages/MonInscription.jsx
 import React, { useEffect, useMemo, useState } from "react";
 import { useParams } from "react-router-dom";
 import { supabase } from "../supabase";
 import RefundModal from "../components/RefundModal";
 
 function eur(cents) {
   return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
 }
@@
 export default function MonInscription() {
   const { id } = useParams();
   const [inscription, setInscription] = useState(null);
+  const [group, setGroup] = useState(null);
+  const [teammates, setTeammates] = useState([]);
   const [loading, setLoading] = useState(true);
 
   const [saving, setSaving] = useState(false);
   const [saveMsg, setSaveMsg] = useState(null);
@@
   // 1) Charger l'inscription
   useEffect(() => {
     let abort = false;
     (async () => {
       setLoading(true);
-      const { data, error } = await supabase
-        .from("inscriptions")
-        .select("*")
-        .eq("id", id)
-        .single();
+      // on charge l'inscription + (facultatif) le groupe lié
+      const { data, error } = await supabase
+        .from("inscriptions")
+        .select(
+          "*, groupe:inscriptions_groupes(id, nom_groupe, team_size, statut)"
+        )
+        .eq("id", id)
+        .single();
       if (!abort) {
-        if (!error && data) setInscription(data);
+        if (!error && data) {
+          setInscription(data);
+          // si inscription d'équipe, charger les coéquipiers
+          if (data.groupe_id) {
+            const [{ data: grp }, { data: mates }] = await Promise.all([
+              supabase
+                .from("inscriptions_groupes")
+                .select("id, nom_groupe, team_size, statut")
+                .eq("id", data.groupe_id)
+                .maybeSingle(),
+              supabase
+                .from("inscriptions")
+                .select("id, nom, prenom, email, statut")
+                .eq("groupe_id", data.groupe_id)
+                .order("created_at", { ascending: true }),
+            ]);
+            setGroup(grp || null);
+            setTeammates(Array.isArray(mates) ? mates : []);
+          } else {
+            setGroup(null);
+            setTeammates([]);
+          }
+        }
         setLoading(false);
       }
     })();
     return () => {
       abort = true;
     };
   }, [id]);
@@
   const statut = inscription?.statut || "";
   const isAlreadyCancelled = useMemo(() => {
     const doneStatuses = new Set([
       "annulé",
       "remboursé",
       "annulée",
       "remboursée_partiellement",
       "remboursée_totalement",
     ]);
     return doneStatuses.has(statut);
   }, [statut]);
 
   const canCancel = inscription && !isAlreadyCancelled;
   const isLocked = isAlreadyCancelled; // verrou inputs si annulée/remboursée
@@
   if (loading || !inscription) {
     return (
       <div className="max-w-4xl mx-auto px-4 py-16 text-neutral-600">
         Chargement…
       </div>
     );
   }
 
   return (
     <div className="mx-auto max-w-4xl">
@@
         <div className="mt-6 rounded-2xl border border-neutral-200 bg-white shadow-sm">
           {/* En-tête statut */}
           <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-4 sm:px-6 py-4">
             <div className="text-sm text-neutral-600">
               Statut de l’inscription
             </div>
             {statusBadge}
           </div>
 
+          {/* Contexte équipe (si applicable) */}
+          {inscription.groupe_id && (
+            <div className="px-4 sm:px-6 py-4 border-b border-neutral-200">
+              <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
+                <div className="flex items-center justify-between">
+                  <div>
+                    <div className="text-xs text-neutral-600">Inscription d’équipe</div>
+                    <div className="text-base font-semibold">
+                      {group?.nom_groupe || inscription?.groupe?.nom_groupe || "Équipe"}
+                    </div>
+                  </div>
+                  <div className="text-xs px-2 py-1 rounded-full bg-neutral-200">
+                    {group?.team_size || inscription?.groupe?.team_size || teammates.length} membres
+                  </div>
+                </div>
+                {teammates?.length > 0 && (
+                  <div className="mt-3">
+                    <div className="text-xs text-neutral-600 mb-1">Membres</div>
+                    <ul className="grid sm:grid-cols-2 gap-2">
+                      {teammates.map((m) => (
+                        <li key={m.id} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm flex items-center justify-between">
+                          <div>
+                            <div className="font-medium">{m.nom} {m.prenom}</div>
+                            <div className="text-neutral-500 text-xs">{m.email || "—"}</div>
+                          </div>
+                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200">
+                            {m.statut}
+                          </span>
+                        </li>
+                      ))}
+                    </ul>
+                  </div>
+                )}
+              </div>
+            </div>
+          )}
+
           {/* Formulaire */}
           <div className="px-4 sm:px-6 py-6">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {[
                 { name: "nom", label: "Nom" },
                 { name: "prenom", label: "Prénom" },
                 { name: "genre", label: "Genre" },
                 { name: "date_naissance", label: "Date de naissance", type: "date" },
                 { name: "nationalite", label: "Nationalité" },
                 { name: "email", label: "Email", type: "email" },
                 { name: "telephone", label: "Téléphone" },
                 { name: "adresse", label: "Adresse", full: true },
                 { name: "adresse_complement", label: "Complément d'adresse", full: true },
                 { name: "code_postal", label: "Code postal" },
                 { name: "ville", label: "Ville" },
                 { name: "pays", label: "Pays" },
                 { name: "club", label: "Club (facultatif)", full: true },
                 { name: "justificatif_type", label: "Justificatif (licence / pps)" },
                 { name: "numero_licence", label: "N° de licence" },
                 { name: "contact_urgence_nom", label: "Contact d'urgence - Nom", full: true },
                 { name: "contact_urgence_telephone", label: "Contact d'urgence - Téléphone" },
                 { name: "pps_identifier", label: "Identifiant PPS" },
               ].map((f) => (
                 <label
                   key={f.name}
                   className={`flex flex-col ${f.full ? "sm:col-span-2" : ""}`}
                 >
                   <span className="text-xs font-semibold text-neutral-600">
                     {f.label}
                   </span>
                   <input
                     type={f.type || "text"}
                     name={f.name}
                     value={inscription[f.name] || ""}
                     onChange={handleChange}
                     disabled={isLocked}
                     className="mt-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300 disabled:bg-neutral-50"
                     placeholder={f.label}
                   />
                 </label>
               ))}
@@
             {/* Actions */}
             <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center">
               <button
                 onClick={handleSave}
                 className={`inline-flex justify-center items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                   isLocked
                     ? "bg-neutral-400 cursor-not-allowed"
                     : "bg-orange-500 hover:brightness-110"
                 }`}
                 disabled={isLocked || saving}
               >
                 {saving ? "Enregistrement…" : "Enregistrer les modifications"}
               </button>
 
               {canCancel ? (
                 <button
                   onClick={() => setOpenCancelModal(true)}
                   className={`inline-flex justify-center items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-neutral-900 border ${
                     quote && (quote.percent === 0 || quote.refund_cents <= 0)
                       ? "bg-neutral-100 border-neutral-200 cursor-not-allowed"
                       : "bg-white border-neutral-300 hover:bg-neutral-50"
                   }`}
                   disabled={quoteLoading || (quote && (quote.percent === 0 || quote.refund_cents <= 0))}
                   title={quote && quote.percent === 0 ? "Aucun remboursement à ce stade" : ""}
                 >
                   {quoteLoading ? "Calcul du remboursement…" : (quote
                     ? (quote.percent === 0 || quote.refund_cents <= 0
                         ? "Annuler — aucun remboursement (barème)"
                         : `Annuler — recevoir ~${eur(quote.refund_cents)}`)
                     : "Annuler mon inscription")}
                 </button>
               ) : (
                 <p className="text-rose-700 font-medium">Cette inscription est déjà {statut}.</p>
               )}
             </div>
           </div>
         </div>
       </div>
@@
       <RefundModal
         inscriptionId={id}
         open={openCancelModal}
         onClose={() => setOpenCancelModal(false)}
         onSuccess={() => window.location.reload()}
       />
     </div>
   );
 }
