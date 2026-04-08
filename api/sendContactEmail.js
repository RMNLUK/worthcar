import { saveContactEnquiry } from "./db.js";
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { full_name, email, phone, message } = req.body;
    if (!full_name || !email || !message) return res.status(400).json({ error: "Missing required fields" });
    await saveContactEnquiry(full_name, email, phone, message);
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "WorthCar <noreply@worthcar.co.uk>",
        to: ["support@ugm-inc.com"],
        subject: `New Contact from ${full_name}`,
        html: `<p><b>Name:</b> ${full_name}</p><p><b>Email:</b> ${email}</p><p><b>Phone:</b> ${phone}</p><p><b>Message:</b> ${message}</p>`,
      }),
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
