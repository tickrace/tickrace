export default function handler(req, res) {
  res.status(200).json({
    hasViteUrl: Boolean(process.env.VITE_SUPABASE_URL),
    hasNextUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    nodeEnv: process.env.NODE_ENV || null,
    vercelEnv: process.env.VERCEL_ENV || null,
  });
}
