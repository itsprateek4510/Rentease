// Sends an SMS through Twilio when TWILIO_* is set in .env, otherwise prints it to the server console (dev).
exports.sendSms = async (phone, text) => {
  const { TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM } = process.env;
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    if (process.env.NODE_ENV === 'production') throw Object.assign(new Error('SMS service is not configured'), { status: 503 });
    return console.log(`\n[SMS to +91${phone}] ${text}\n`);
  }
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST', signal: AbortSignal.timeout(10000), headers: { Authorization: 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: '+91' + phone, From: TWILIO_FROM, Body: text })
  });
  if (!r.ok) throw new Error('The SMS could not be sent. Please try again.');
};
