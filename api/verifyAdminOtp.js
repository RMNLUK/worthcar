import { getAdminOTP, markOTPUsed } from "./db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "Email and code required" });
    const result = await getAdminOTP(email, code);
    if (!result.success) return res.status(401).json({ error: result.error });
    await markOTPUsed(result.data.id);
    return res.status(200).json({ success: true, email });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
