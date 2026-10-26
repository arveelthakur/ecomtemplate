function normalizeWhatsAppPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 11) return `92${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('3')) return `92${digits}`;
  return digits;
}

async function sendWhatsAppText({ token, phoneNumberId, to, body, fetchImpl = globalThis.fetch }) {
  if (!token || !phoneNumberId || !to) return false;
  if (typeof fetchImpl !== 'function') throw new Error('WhatsApp delivery is unavailable in this runtime.');
  const response = await fetchImpl(`https://graph.facebook.com/v23.0/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizeWhatsAppPhone(to),
      type: 'text',
      text: { body: String(body).slice(0, 4096) },
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Meta Cloud API rejected the message (${response.status}).`);
  return true;
}

async function sendWhatsAppTemplate({
  token,
  phoneNumberId,
  to,
  name,
  language = 'en',
  parameters = [],
  fetchImpl = globalThis.fetch,
}) {
  if (!token || !phoneNumberId || !to || !name) return false;
  if (typeof fetchImpl !== 'function') throw new Error('WhatsApp delivery is unavailable in this runtime.');
  const response = await fetchImpl(`https://graph.facebook.com/v23.0/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizeWhatsAppPhone(to),
      type: 'template',
      template: {
        name,
        language: { code: language },
        components: parameters.length
          ? [{ type: 'body', parameters: parameters.map(value => ({ type: 'text', text: String(value).slice(0, 500) })) }]
          : [],
      },
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Meta Cloud API rejected the template (${response.status}).`);
  return true;
}

module.exports = { normalizeWhatsAppPhone, sendWhatsAppText, sendWhatsAppTemplate };
