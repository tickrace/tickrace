
import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";

export default function NouvelleCourse() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nom: "",
    sous_nom: "",
    lieu: "",
    date: "",
    type_epreuve: "",
    image: null,
  });

  const [formats, setFormats] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setFormData({ ...formData, image: file });
    setPreviewImage(URL.createObjectURL(file));
  };

  const handleAddFormat = () => {
    setFormats([...formats, {
      nom: "",
      distance_km: "",
      denivele_dplus: "",
      denivele_dmoins: "",
      heure_depart: "",
      prix: ""
    }]);
  };

  const handleFormatChange = (index, e) => {
    const { name, value } = e.target;
    const updatedFormats = [...formats];
    updatedFormats[index][name] = value;
    setFormats(updatedFormats);
  };

  const uploadImage = async () => {
    const file = formData.image;
    if (!file) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage
      .from("course-images")
      .upload(fileName, file);

    if (error) {
      setError("Erreur lors de l'upload de l'image.");
      return null;
    }

    const { data: publicUrl } = supabase
      .storage
      .from("course-images")
      .getPublicUrl(fileName);

    return publicUrl.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    setError(null);

    const {
      nom, sous_nom, lieu, date, type_epreuve, image
    } = formData;

    const session = await supabase.auth.getSession();
    const user = session.data.session?.user;

    if (!user) {
      setError("Veuillez vous connecter.");
      return;
    }

    let image_url = null;
    if (image) {
      image_url = await uploadImage();
    }

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .insert([{
        nom, sous_nom, lieu, date,
        type_epreuve,
        image_url,
        organisateur_id: user.id,
      }])
      .select()
      .single();

    if (courseError) {
      setError("Erreur lors de l'enregistrement de la course.");
      setUploading(false);
      return;
    }

    for (let format of formats) {
      const formatData = {
        ...format,
        event_id: course.id,
      };

      const { error: formatError } = await supabase
        .from("formats")
        .insert([formatData]);

      if (formatError) {
        setError("Erreur lors de l'enregistrement des formats.");
        break;
      }
    }

    setUploading(false);
    navigate("/organisateur/espace");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nouvelle course</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block">Nom de l’épreuve</label>
          <input name="nom" value={formData.nom} onChange={handleInputChange} className="border px-3 py-2 w-full rounded" required />
        </div>
        <div>
          <label className="block">Sous-nom</label>
          <input name="sous_nom" value={formData.sous_nom} onChange={handleInputChange} className="border px-3 py-2 w-full rounded" />
        </div>
        <div>
          <label className="block">Lieu</label>
          <input name="lieu" value={formData.lieu} onChange={handleInputChange} className="border px-3 py-2 w-full rounded" required />
        </div>
        <div>
          <label className="block">Date</label>
          <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="border px-3 py-2 w-full rounded" required />
        </div>
        <div>
          <label className="block">Type d’épreuve</label>
          <input name="type_epreuve" value={formData.type_epreuve} onChange={handleInputChange} className="border px-3 py-2 w-full rounded" />
        </div>
        <div>
          <label className="block">Image (JPG/PNG)</label>
          <input type="file" accept="image/*" onChange={handleImageChange} className="border px-3 py-2 w-full rounded" />
          {previewImage && <img src={previewImage} alt="Prévisualisation" className="mt-2 w-48" />}
        </div>

        <h2 className="text-xl font-bold mt-6 mb-2">Formats</h2>
        {formats.map((format, index) => (
          <div key={index} className="border p-4 rounded space-y-2 mb-4 bg-gray-50">
            <div>
              <label className="block">Nom</label>
              <input name="nom" value={format.nom} onChange={(e) => handleFormatChange(index, e)} className="border px-3 py-2 w-full rounded" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block">Distance (km)</label>
                <input name="distance_km" value={format.distance_km} onChange={(e) => handleFormatChange(index, e)} className="border px-3 py-2 w-full rounded" />
              </div>
              <div>
                <label className="block">D+ (m)</label>
                <input name="denivele_dplus" value={format.denivele_dplus} onChange={(e) => handleFormatChange(index, e)} className="border px-3 py-2 w-full rounded" />
              </div>
              <div>
                <label className="block">D- (m)</label>
                <input name="denivele_dmoins" value={format.denivele_dmoins} onChange={(e) => handleFormatChange(index, e)} className="border px-3 py-2 w-full rounded" />
              </div>
              <div>
                <label className="block">Heure de départ</label>
                <input name="heure_depart" value={format.heure_depart} onChange={(e) => handleFormatChange(index, e)} className="border px-3 py-2 w-full rounded" />
              </div>
              <div>
                <label className="block">Prix (€)</label>
                <input name="prix" value={format.prix} onChange={(e) => handleFormatChange(index, e)} className="border px-3 py-2 w-full rounded" />
              </div>
            </div>
          </div>
        ))}
        <button type="button" onClick={handleAddFormat} className="bg-gray-200 px-4 py-2 rounded">+ Ajouter un format</button>
        <div>
          <button type="submit" disabled={uploading} className="bg-black text-white px-4 py-2 rounded mt-4">
            {uploading ? "Enregistrement..." : "Créer l’épreuve"}
          </button>
        </div>
      </form>
    </div>
  );
}
