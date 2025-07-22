// ... imports (inchangés)

export default function ModifierCourse() {
  // ... state init (inchangé)

  useEffect(() => {
    const fetchData = async () => {
      const { data: courseData } = await supabase
        .from("courses")
        .select("*")
        .eq("id", id)
        .single();

      const { data: formatsData } = await supabase
        .from("formats")
        .select("*")
        .eq("course_id", id);

      const formatsWithInscrits = await Promise.all(
        formatsData.map(async (format) => {
          const { count } = await supabase
            .from("inscriptions")
            .select("*", { count: "exact", head: true })
            .eq("format_id", format.id);

          return {
            ...format,
            nb_inscrits: count || 0,
            localId: uuidv4(),
          };
        })
      );

      setCourse(courseData);
      setFormats(formatsWithInscrits);
    };

    fetchData();
  }, [id]);

  const handleCourseChange = (e) => {
    const { name, value, files } = e.target;
    if (files) setNewImageFile(files[0]);
    else setCourse((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormatChange = (index, e) => {
    const { name, value, files, type, checked } = e.target;
    setFormats((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [name]: type === "checkbox" ? checked : files ? files[0] : value,
      };
      return updated;
    });
  };

  const addFormat = () => {
    setFormats((prev) => [
      ...prev,
      {
        localId: uuidv4(),
        nom: "",
        date: "",
        heure_depart: "",
        presentation_parcours: "",
        fichier_gpx: null,
        gpx_url: "",
        type_epreuve: "",
        distance_km: "",
        denivele_dplus: "",
        denivele_dmoins: "",
        adresse_depart: "",
        adresse_arrivee: "",
        prix: "",
        nombre_repas: "0",
        prix_repas: "",
        ravitaillements: "",
        remise_dossards: "",
        dotation: "",
        fichier_reglement: null,
        reglement_pdf_url: "",
        nb_max_coureurs: "",
        age_minimum: "",
        hebergements: "",
        imageFile: null,
        image_url: "",
        nb_inscrits: 0,
      },
    ]);
  };

  const duplicateFormat = (index) => {
    const original = formats[index];
    const duplicated = {
      ...original,
      localId: uuidv4(),
      id: undefined,
    };
    setFormats((prev) => [...prev, duplicated]);
  };

  const removeFormat = (index) => {
    setFormats((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let imageCourseUrl = course.image_url;
    if (newImageFile) {
      const { data, error } = await supabase.storage
        .from("courses")
        .upload(`course-${Date.now()}.jpg`, newImageFile);
      if (!error) {
        imageCourseUrl = supabase.storage.from("courses").getPublicUrl(data.path).data.publicUrl;
      }
    }

    await supabase
      .from("courses")
      .update({
        nom: course.nom,
        lieu: course.lieu,
        departement: course.departement,
        presentation: course.presentation,
        image_url: imageCourseUrl,
      })
      .eq("id", id);

    for (const format of formats) {
      let image_url = format.image_url;
      let gpx_url = format.gpx_url;
      let reglement_pdf_url = format.reglement_pdf_url;

      if (format.imageFile) {
        const { data } = await supabase.storage
          .from("formats")
          .upload(`format-${Date.now()}-${format.nom}.jpg`, format.imageFile);
        image_url = supabase.storage.from("formats").getPublicUrl(data.path).data.publicUrl;
      }
      if (format.fichier_gpx) {
        const { data } = await supabase.storage
          .from("formats")
          .upload(`gpx-${Date.now()}-${format.nom}.gpx`, format.fichier_gpx);
        gpx_url = supabase.storage.from("formats").getPublicUrl(data.path).data.publicUrl;
      }
      if (format.fichier_reglement) {
        const { data } = await supabase.storage
          .from("reglements")
          .upload(`reglement-${Date.now()}-${format.nom}.pdf`, format.fichier_reglement);
        reglement_pdf_url = supabase.storage.from("reglements").getPublicUrl(data.path).data.publicUrl;
      }

      const prix = parseFloat(format.prix || 0);
      const prix_repas = parseFloat(format.prix_repas || 0);
      const prix_total_inscription = prix + prix_repas;

      const formatData = {
        ...format,
        course_id: id,
        image_url,
        gpx_url,
        reglement_pdf_url,
        prix,
        prix_repas,
        prix_total_inscription,
        nombre_repas: format.nombre_repas,
      };

      delete formatData.localId;
      delete formatData.nb_inscrits;
      delete formatData.imageFile;
      delete formatData.fichier_gpx;
      delete formatData.fichier_reglement;

      if (format.id) {
        await supabase.from("formats").update(formatData).eq("id", format.id);
      } else {
        await supabase.from("formats").insert(formatData);
      }
    }

    alert("Épreuve modifiée avec succès !");
    navigate("/organisateur/mon-espace");
  };

  if (!course) return <div>Chargement...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Modifier l’épreuve</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <input name="nom" value={course.nom} onChange={handleCourseChange} className="border p-2 w-full" placeholder="Nom de l’épreuve" />
        <input name="lieu" value={course.lieu} onChange={handleCourseChange} className="border p-2 w-full" placeholder="Lieu" />
        <input name="departement" value={course.departement} onChange={handleCourseChange} className="border p-2 w-full" placeholder="Département" />
        <textarea name="presentation" value={course.presentation} onChange={handleCourseChange} className="border p-2 w-full" placeholder="Présentation" />
        <input type="file" name="image" onChange={handleCourseChange} />

        <h2 className="text-xl font-semibold mt-6">Formats</h2>
        {formats.map((f, index) => (
          <div key={f.localId} className="border p-4 space-y-2 bg-gray-50">
            <input name="nom" value={f.nom} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" placeholder="Nom du format" />
            {/* ... autres champs inchangés ... */}
            <input name="prix" value={f.prix} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" placeholder="Prix (€)" />
            <input name="nombre_repas" type="number" value={f.nombre_repas} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" placeholder="Nombre total de repas, mettre 0 si pas de repas" />
            {parseInt(f.nombre_repas || 0) > 0 && (
              <input name="prix_repas" value={f.prix_repas} onChange={(e) => handleFormatChange(index, e)} className="border p-2 w-full" placeholder="Prix d’un repas (€)" />
            )}
            {/* ... autres champs inchangés ... */}
          </div>
        ))}

        <button type="button" onClick={addFormat} className="bg-blue-600 text-white px-4 py-2 rounded">+ Ajouter un format</button>
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">✅ Enregistrer les modifications</button>
      </form>
    </div>
  );
}
