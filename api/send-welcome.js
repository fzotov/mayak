import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, name, password } = req.body;
  try {
    await resend.emails.send({
      from: 'Mayak <onboarding@resend.dev>',
      to: email,
      subject: 'Welcome to Mayak',
      html: '<h2>Hello ' + name + '!</h2><p>Your account is created.</p><p>Email: ' + email + '</p><p>Password: ' + password + '</p>'
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
