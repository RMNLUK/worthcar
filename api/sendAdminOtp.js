import { supabase } from "./db.js";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Invalid email or password" });
    
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    
    await supabase.from("AdminOTP").insert([{ email, code, expires_at: expiresAt, used: false }]);
    
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "WorthCar <noreply@worthcar.co.uk>",
        to: [email],
        subject: "WorthCar Admin — Verification Code",
        html: `<div style="font-family:sans-serif;padding:20px"><h2>Admin Verification</h2><div style="font-size:36px;font-weight:bold;letter-spacing:8px;background:#f0f0f0;padding:20px;text-align:center;margin:20px 0">${code}</div><p style="color:#666;font-size:12px">Expires in 10 minutes.</p></div>`,
      }),
    });
    
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
