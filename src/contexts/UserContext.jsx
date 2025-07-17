useEffect(() => {
  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);

    if (session?.user?.id) {
      const { data, error } = await supabase
        .from("profils_utilisateurs")
        .select("role")
        .eq("user_id", session.user.id);

      if (!error) {
        const fetchedRoles = data.map((item) => item.role);
        setRoles(fetchedRoles);
      }
    }

    setLoading(false);
  };

  init();

  const { data: unsubscribe } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
    init(); // ← recharge les rôles après connexion/déconnexion
  });

  return () => {
    unsubscribe?.(); // ✅ C'est une fonction, on l'appelle directement
  };
}, []);
