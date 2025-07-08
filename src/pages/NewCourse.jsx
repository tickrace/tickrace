import React, { useState } from "react";

export default function NewCourse() {
  const [nom, setNom] = useState("");
  const [lieu, setLieu] = useState("");
  const [date, setDate] = useState("");
  const [formats, setFormats] = useState([{ distance_km: "", dplus: "" }]);
  const [submitted, setSubmitted] = useState(false);

  const handleAddFormat = () => {
    setFormats([...formats, { distance_km: "", dplus: "" }]);
  };

  const handleChangeFormat = (index, field, value) => {
    const newFormats = [...formats];
    newFormats[index][field] = value;
    setFormats(newFormats);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Créer une nouvelle course</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input className="border p-2 w-full" placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)} />
        <input className="border p-2 w-full" placeholder="Lieu" value={lieu} onChange={(e) => setLieu(e.target.value)} />
        <input type="date" className="border p-2 w-full" value={date} onChange={(e) => setDate(e.target.value)} />
        <h2 className="font-semibold">Formats :</h2>
        {formats.map((f, i) => (
          <div key={i} className="flex gap-2">
            <input className="border p-2 w-full" placeholder="Distance (km)" value={f.distance_km} onChange={(e) => handleChangeFormat(i, "distance_km", e.target.value)} />
            <input className="border p-2 w-full" placeholder="D+ (m)" value={f.dplus} onChange={(e) => handleChangeFormat(i, "dplus", e.target.value)} />
          </div>
        ))}
        <button type="button" onClick={handleAddFormat} className="bg-gray-200 px-4 py-2 rounded">Ajouter un format</button>
        <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded">Enregistrer</button>
      </form>
      {submitted && (
        <div className="mt-6 p-4 bg-green-100 border border-green-300 rounded">
          ✅ Course enregistrée (mock) : <strong>{nom}</strong> à <strong>{lieu}</strong> le <strong>{date}</strong>
        </div>
      )}
    </div>
  );
}