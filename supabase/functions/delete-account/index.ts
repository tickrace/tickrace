// supabase/functions/delete-account/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Méthode non autorisée, utilisez POST" }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Authorization Bearer token manquant" }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // 1) Récupérer l'utilisateur courant
    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      console.error("Erreur getUser:", userError);
      return new Response(
        JSON.stringify({ error: "Utilisateur non authentifié" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const userId = user.id;

    // =============================
    // 2) Anonymiser les inscriptions
    // =============================

    // 2.1) apparaitre_resultats = true → garder nom/prénom, anonymiser le reste
    {
      const { error } = await supabaseAdmin
        .from("inscriptions")
        .update({
          email: null,
          telephone: null,
          adresse: null,
          adresse_complement: null,
          code_postal: null,
          ville: null,
          pays: null,
          date_naissance: null,
          nationalite: null,
          club: null,
          contact_urgence_nom: null,
          contact_urgence_telephone: null,
          justificatif_type: null,
          numero_licence: null,
          justificatif_url: null,
          pps_identifier: null,
          pps_expiry_date: null,
        })
        .eq("coureur_id", userId)
        .eq("apparaitre_resultats", true);

      if (error) {
        console.error(
          "Erreur update inscriptions (apparaitre_resultats=true):",
          error
        );
        return new Response(
          JSON.stringify({
            error:
              "Erreur lors de l'anonymisation des inscriptions (apparaitre_resultats=true)",
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }

    // 2.2) apparaitre_resultats = false → anonymiser tout
    {
      const { error } = await supabaseAdmin
        .from("inscriptions")
        .update({
          nom: "[supprimé]",
          prenom: null,
          email: null,
          telephone: null,
          adresse: null,
          adresse_complement: null,
          code_postal: null,
          ville: null,
          pays: null,
          date_naissance: null,
          nationalite: null,
          club: null,
          contact_urgence_nom: null,
          contact_urgence_telephone: null,
          justificatif_type: null,
          numero_licence: null,
          justificatif_url: null,
          pps_identifier: null,
          pps_expiry_date: null,
        })
        .eq("coureur_id", userId)
        .eq("apparaitre_resultats", false);

      if (error) {
        console.error(
          "Erreur update inscriptions (apparaitre_resultats=false):",
          error
        );
        return new Response(
          JSON.stringify({
            error:
              "Erreur lors de l'anonymisation des inscriptions (apparaitre_resultats=false)",
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }

    // 2.3) apparaitre_resultats IS NULL → anonymiser tout (par défaut)
    {
      const { error } = await supabaseAdmin
        .from("inscriptions")
        .update({
          nom: "[supprimé]",
          prenom: null,
          email: null,
          telephone: null,
          adresse: null,
          adresse_complement: null,
          code_postal: null,
          ville: null,
          pays: null,
          date_naissance: null,
          nationalite: null,
          club: null,
          contact_urgence_nom: null,
          contact_urgence_telephone: null,
          justificatif_type: null,
          numero_licence: null,
          justificatif_url: null,
          pps_identifier: null,
          pps_expiry_date: null,
        })
        .eq("coureur_id", userId)
        .is("apparaitre_resultats", null);

      if (error) {
        console.error(
          "Erreur update inscriptions (apparaitre_resultats IS NULL):",
          error
        );
        return new Response(
          JSON.stringify({
            error:
              "Erreur lors de l'anonymisation des inscriptions (apparaitre_resultats IS NULL)",
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }

    // =============================
    // 3) Supprimer le profil
    // =============================
    {
      const { error } = await supabaseAdmin
        .from("profils_utilisateurs")
        .delete()
        .eq("user_id", userId);

      if (error) {
        console.error("Erreur delete profils_utilisateurs:", error);
        return new Response(
          JSON.stringify({
            error: "Erreur lors de la suppression du profil utilisateur",
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }

    // =============================
    // 4) Supprimer fichiers PPS (non bloquant)
    // =============================
    try {
      const bucket = supabaseAdmin.storage.from("ppsjustificatifs");
      const { data: files, error: listError } = await bucket.list(userId, {
        limit: 1000,
      });

      if (listError) {
        console.warn("Erreur list fichiers PPS (non bloquant):", listError);
      } else if (files && files.length > 0) {
        const pathsToRemove = files.map((f) => `${userId}/${f.name}`);
        const { error: removeError } = await bucket.remove(pathsToRemove);
        if (removeError) {
          console.warn(
            "Erreur suppression fichiers PPS (non bloquant):",
            removeError
          );
        }
      }
    } catch (e) {
      console.warn("Exception storage PPS (non bloquant):", e);
    }

    // =============================
    // 5) Essayer de supprimer l'utilisateur auth
    // =============================
    let authUserDeleted = false;
    let authUserDisabled = false;

    try {
      const { error: deleteUserError } =
        await supabaseAdmin.auth.admin.deleteUser(userId);

      if (!deleteUserError) {
        authUserDeleted = true;
      } else {
        console.warn("Erreur deleteUser, on tente un fallback:", deleteUserError);
      }
    } catch (e) {
      console.warn("Exception deleteUser, on tente un fallback:", e);
    }

    // =============================
    // 6) Fallback : si deleteUser échoue, on BAN + change l'email
    // =============================
    if (!authUserDeleted) {
      try {
        // email poubelle unique
        const pseudoEmail = `deleted+${userId}@deleted.tickrace`;
        // ban très long (Supabase gère un champ ban_duration en texte: "87600h" ≈ 10 ans)
        const { error: updateError } =
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            email: pseudoEmail,
            ban_duration: "87600h", // ~10 ans
          });

        if (updateError) {
          console.warn(
            "Erreur fallback updateUserById (ban + email poubelle):",
            updateError
          );
        } else {
          authUserDisabled = true;
        }
      } catch (e) {
        console.warn(
          "Exception fallback updateUserById (ban + email poubelle):",
          e
        );
      }
    }

    // =============================
    // 7) Réponse OK
    // =============================
    return new Response(
      JSON.stringify({
        success: true,
        message:
          "Compte et données personnelles supprimés / anonymisés. " +
          (authUserDeleted
            ? "Compte d'authentification supprimé."
            : authUserDisabled
            ? "Compte d'authentification désactivé et anonymisé."
            : "Le compte d'authentification n'a pas pu être supprimé, mais vos données personnelles ont été anonymisées."),
        authUserDeleted,
        authUserDisabled,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (e) {
    console.error("Exception générale delete-account:", e);
    return new Response(
      JSON.stringify({
        error: "Erreur interne lors de la suppression du compte",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
