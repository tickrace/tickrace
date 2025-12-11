// supabase/functions/delete-account/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Récupération des variables d'environnement
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  // CORS basique
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  // Client "user" (pour récupérer l'utilisateur courant)
  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  // Client admin (service role) pour suppression / updates
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // 1) Récupérer l'utilisateur courant via le token
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

    // 2) Anonymiser les inscriptions
    // Cas 1 : l'utilisateur n'avait PAS coché "apparaître dans les résultats"
    {
      const { error } = await supabaseAdmin
        .from("inscriptions")
        .update({
          nom: "[supprimé]",
          prenom: null,
          email: null,
          telephone: null,
          adresse: null,
          code_postal: null,
          ville: null,
          pays: null,
          date_naissance: null,
          nationalite: null,
          club: null,
          contact_urgence_nom: null,
          contact_urgence_telephone: null,
          // si tu as d'autres champs perso, les mettre à null ici
        })
        .eq("coureur_id", userId)
        .eq("afficher_resultats", false);

      if (error) {
        console.error("Erreur update inscriptions (afficher_resultats=false):", error);
        return new Response(
          JSON.stringify({
            error:
              "Erreur lors de l'anonymisation des inscriptions (afficher_resultats=false)",
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

    // Cas 2 : l'utilisateur AVAIT coché "apparaître dans les résultats"
    // -> on garde nom/prénom, on anonymise tout le reste
    {
      const { error } = await supabaseAdmin
        .from("inscriptions")
        .update({
          email: null,
          telephone: null,
          adresse: null,
          code_postal: null,
          ville: null,
          pays: null,
          date_naissance: null,
          nationalite: null,
          club: null,
          contact_urgence_nom: null,
          contact_urgence_telephone: null,
        })
        .eq("coureur_id", userId)
        .eq("afficher_resultats", true);

      if (error) {
        console.error("Erreur update inscriptions (afficher_resultats=true):", error);
        return new Response(
          JSON.stringify({
            error:
              "Erreur lors de l'anonymisation des inscriptions (afficher_resultats=true)",
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

    // 3) Supprimer le profil dans profils_utilisateurs
    {
      const { error } = await supabaseAdmin
        .from("profils_utilisateurs")
        .delete()
        .eq("user_id", userId);

      if (error) {
        console.error("Erreur delete profils_utilisateurs:", error);
        // Ce n'est pas bloquant pour la suite, mais on peut décider de stopper ici.
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

    // 4) (Optionnel) Supprimer les fichiers PPS dans le bucket "ppsjustificatifs"
    // Ici on suppose que tu stockes les fichiers sous le dossier `${userId}/...`
    // Adapte si ton path est différent.
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
          console.warn("Erreur suppression fichiers PPS (non bloquant):", removeError);
        }
      }
    } catch (e) {
      console.warn("Exception storage PPS (non bloquant):", e);
    }

    // 5) (Optionnel) Nettoyage d'autres tables liées
    // Exemple : crédits Tickrace, bénévoles, etc.
    // À adapter selon ton schéma.
    //
    // await supabaseAdmin
    //   .from("tickrace_credits")
    //   .update({ user_id: null })
    //   .eq("user_id", userId);
    //
    // await supabaseAdmin
    //   .from("benevoles")
    //   .delete()
    //   .eq("user_id", userId);

    // 6) Supprimer l'utilisateur dans auth.users (via l'admin)
    const { error: deleteUserError } =
      await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      console.error("Erreur deleteUser:", deleteUserError);
      return new Response(
        JSON.stringify({
          error: "Erreur lors de la suppression du compte auth",
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

    // 7) Réponse OK
    return new Response(
      JSON.stringify({
        success: true,
        message: "Compte et données personnelles supprimés / anonymisés.",
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
