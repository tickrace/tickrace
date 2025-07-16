export default function Organisateur() {
  const [file, setFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadMessage("❌ Aucun fichier sélectionné.");
      return;
    }

    const fileName = `courses/${Date.now()}_${file.name}`;

    const { data, error } = await supabase.storage
      .from("courses")
      .upload(fileName, file);

    if (error) {
      console.error("Erreur Supabase :", error.message);
      setUploadMessage("❌ Upload échoué : " + error.message);
    } else {
      setUploadMessage("✅ Upload réussi !");
      const publicUrl = supabase.storage.from("courses").getPublicUrl(fileName);
      setImageUrl(publicUrl.data.publicUrl);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Espace Organisateur</h1>
      <p className="mb-4">Créez et gérez vos courses.</p>

      <input type="file" onChange={handleFileChange} className="mb-2" />
      <button onClick={handleUpload} className="bg-blue-500 text-white px-4 py-2 rounded">
        Upload
      </button>

      <p className="mt-4">{uploadMessage}</p>

      {imageUrl && (
        <div className="mt-4">
          <p>Image disponible à :</p>
          <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
            {imageUrl}
          </a>
          <div className="mt-2">
            <img src={imageUrl} alt="Upload réussi" className="w-64" />
          </div>
        </div>
      )}
    </div>
  );
}
