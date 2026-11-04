// Sends real email when SMTP_* is set in .env, otherwise prints it to the server console (dev).
let transporter = null;
if (process.env.SMTP_HOST) {
  const port = Number(process.env.SMTP_PORT) || 587;
  transporter = require('nodemailer').createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
}
exports.sendMail = async (to, subject, text) => {
  if (!transporter) return console.log(`\n[email to ${to}] ${subject}\n${text}\n`);
  await transporter.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
};
