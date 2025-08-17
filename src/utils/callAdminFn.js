// src/utils/callAdminFn.js
export async function callAdminFn(fnName, session, init = {}) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`, {
    method: init.method || "POST",
    headers: {
      "Authorization": `Bearer ${session?.access_token}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    body: init.body ? JSON.stringify(init.body) : undefined
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
