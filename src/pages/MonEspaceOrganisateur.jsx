const [repasParFormat, setRepasParFormat] = useState({});

const fetchCoursesAndFormats = async () => {
  const { data: coursesData, error } = await supabase
    .from("courses")
    .select("*, formats(*)")
    .eq("organisateur_id", session.user.id);

  if (!error) {
    setCourses(coursesData);

    const allFormatIds = coursesData.flatMap(c =>
      (c.formats || []).map(f => f.id)
    );

    if (allFormatIds.length > 0) {
      const { data: inscriptions, error: errIns } = await supabase
        .from("inscriptions")
        .select("format_id, nombre_repas");

      if (!errIns && inscriptions) {
        const counts = {};
        const repasCounts = {};

        inscriptions.forEach((i) => {
          counts[i.format_id] = (counts[i.format_id] || 0) + 1;
          const repas = parseInt(i.nombre_repas || 0);
          repasCounts[i.format_id] = (repasCounts[i.format_id] || 0) + repas;
        });

        setInscriptionsParFormat(counts);
        setRepasParFormat(repasCounts);
      }
    }
  }
};
