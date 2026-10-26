'use strict';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function safeEmail(value) {
  const address = String(value ?? '').trim().toLowerCase();
  return EMAIL_RE.test(address) ? address : '';
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value ?? ''));
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function interpolate(template, values) {
  return String(template ?? '')
    .replace(/\bNura\b(?![-_])/gi, String(values.store_name || 'our store'))
    .replace(/[\r\n]+/g, ' ')
    .replace(/\{([a-z_]+)\}/g, (match, key) => key in values ? String(values[key] ?? '') : '');
}

function renderEmail({ settings, templateId, template: templateOverride, values = {} }) {
  const template = templateOverride || settings?.templates?.[templateId];
  if (!template || typeof template.subject !== 'string' || typeof template.body !== 'string') {
    throw new Error('Email template is not configured.');
  }
  const brand = settings.branding || {};
  const storeName = String(brand.storeName || values.store_name || 'Online shop').trim().slice(0, 100);
  const templateValues = { ...values, store_name: storeName };
  const subject = interpolate(template.subject, templateValues).slice(0, 180).trim();
  if (!subject) throw new Error('Email subject is empty.');

  const plainText = String(template.body)
    .replace(/\bNura\b(?![-_])/gi, storeName)
    .replace(/\{([a-z_]+)\}/g, (match, key) =>
      key in templateValues ? String(templateValues[key] ?? '') : '');
  const previewText = String(template.previewText || '').slice(0, 180).trim();
  const banner = safeHttpsUrl(template.bannerUrl);
  const ctaLabel = String(template.ctaLabel || '').replace(/[\r\n<>]/g, '').trim().slice(0, 60);
  const ctaHref = safeHttpsUrl(template.ctaHref);
  const text = `${plainText}${ctaLabel ? `\n\n${ctaLabel}${ctaHref ? `: ${ctaHref}` : ''}` : ''}`;
  const accentColor = /^#[0-9a-f]{6}$/i.test(brand.accentColor || '') ? brand.accentColor : '#6b2447';
  const logo = safeHttpsUrl(brand.logoUrl);
  const logoMarkup = logo
    ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(storeName)} logo" style="display:block;max-width:180px;max-height:58px;margin:0 auto 22px;object-fit:contain">`
    : `<div style="margin:0 0 22px;color:#6b2447;font:700 23px Arial,sans-serif;letter-spacing:-1px;text-align:center">${escapeHtml(storeName)}</div>`;
  const links = brand.socialLinks || {};
  const social = [
    ['Instagram', safeHttpsUrl(links.instagram)],
    ['Facebook', safeHttpsUrl(links.facebook)],
    ['WhatsApp', links.whatsapp ? `https://wa.me/${String(links.whatsapp).replace(/\D/g, '')}` : ''],
  ].filter(([, url]) => url);
  const footerLinks = social.map(([label, url]) =>
    `<a href="${escapeHtml(url)}" style="color:${accentColor};margin:0 8px;text-decoration:none">${label}</a>`).join('');
  const bannerMarkup = banner
    ? `<img src="${escapeHtml(banner)}" alt="" style="display:block;width:100%;height:auto;max-height:320px;object-fit:cover;margin:0 0 22px;border-radius:6px">`
    : '';
  const preheaderMarkup = previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(previewText)}</div>`
    : '';
  const ctaMarkup = ctaLabel && ctaHref
    ? `<div style="margin-top:24px;text-align:center"><a href="${escapeHtml(ctaHref)}" style="display:inline-block;padding:13px 24px;border-radius:999px;background:${accentColor};color:#fffdf9;text-decoration:none;font-weight:700">${escapeHtml(ctaLabel)}</a></div>`
    : '';
  const html = [
    '<!doctype html><html><body style="margin:0;background:#f6f2eb;padding:24px 12px;font-family:Arial,sans-serif;color:#332d29">',
    preheaderMarkup,
    `<div style="max-width:600px;margin:0 auto;background:#fffdf9;border:1px solid #e9e1d8;border-radius:8px;overflow:hidden">`,
    `<div style="height:4px;background:${accentColor}"></div><div style="padding:30px 28px">`,
    logoMarkup,
    bannerMarkup,
    `<div style="font-size:15px;line-height:1.75;color:#4e4640">${escapeHtml(plainText).replace(/\n/g, '<br>')}</div>`,
    ctaMarkup,
    `<div style="margin-top:28px;padding-top:16px;border-top:1px solid #eee7df;color:#81766c;font-size:11px;text-align:center">`,
    `${escapeHtml(brand.footerCopyright || '')}${footerLinks ? `<div style="margin-top:9px">${footerLinks}</div>` : ''}`,
    '</div></div></div></body></html>',
  ].join('');
  return { subject, text, html };
}

function findSender(settings, profileId) {
  const profiles = Array.isArray(settings?.senderProfiles) ? settings.senderProfiles : [];
  const profile = profiles.find(item => item.id === profileId)
    || profiles.find(item => item.id === settings?.defaultSenderProfileId);
  if (!profile || !String(profile.name || '').trim() || !safeEmail(profile.email)) {
    throw new Error('Choose a sender profile with a valid name and email address.');
  }
  return {
    name: String(profile.name).replace(/[\r\n<>]/g, '').trim().slice(0, 100),
    email: safeEmail(profile.email),
  };
}

function providerStatus(settings, secrets = {}) {
  const provider = ['resend', 'sendgrid', 'smtp'].includes(settings?.provider)
    ? settings.provider
    : 'none';
  const hasSender = (settings?.senderProfiles || []).some(profile =>
    Boolean(String(profile.name || '').trim() && safeEmail(profile.email)));
  let credentialsConfigured = false;
  let detail = 'Choose an email provider. Provider credentials are not stored in the database.';

  if (provider === 'resend') {
    credentialsConfigured = Boolean(secrets.resendApiKey);
    detail = credentialsConfigured
      ? 'Resend credentials are available server-side. Verify the sender domain before sending.'
      : 'Add RESEND_API_KEY as a server-side Vercel environment variable when the custom domain is ready.';
  } else if (provider === 'sendgrid') {
    credentialsConfigured = Boolean(secrets.sendgridApiKey);
    detail = credentialsConfigured
      ? 'SendGrid credentials are available server-side. Verify the sender identity before sending.'
      : 'Add SENDGRID_API_KEY as a server-side Vercel environment variable when the custom domain is ready.';
  } else if (provider === 'smtp') {
    credentialsConfigured = Boolean(
      secrets.smtpPassword
      && String(settings?.smtp?.host || '').trim()
      && Number.isInteger(settings?.smtp?.port)
      && String(settings?.smtp?.username || '').trim(),
    );
    detail = credentialsConfigured
      ? 'SMTP settings and server-side password are available. Verify the sender domain before sending.'
      : 'Add SMTP_PASSWORD as a server-side Vercel environment variable and complete the non-secret SMTP fields.';
  }
  if (provider !== 'none' && !hasSender) detail = 'Add a valid sender profile before sending email.';
  return {
    provider,
    credentialsConfigured,
    canSend: provider !== 'none' && credentialsConfigured && hasSender,
    detail,
  };
}

async function deliverEmail({ settings, sender, to, subject, html, text, replyTo, secrets, fetchImpl = fetch, smtpModule }) {
  const recipient = safeEmail(to);
  if (!recipient) throw new Error('Recipient email address is invalid.');
  if (!sender || !safeEmail(sender.email)) throw new Error('Sender email address is invalid.');
  const fromName = String(sender.name || '').replace(/[\r\n<>]/g, '').trim().slice(0, 100);
  const from = `${fromName} <${sender.email}>`;
  const safeReplyTo = replyTo ? safeEmail(replyTo) : '';
  const provider = settings?.provider;

  if (provider === 'resend') {
    const apiKey = secrets?.resendApiKey;
    if (!apiKey) throw new Error('Resend API secret is not configured.');
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [recipient], subject, html, text, ...(safeReplyTo ? { reply_to: safeReplyTo } : {}) }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Resend rejected the message (HTTP ${response.status}).`);
    const payload = await response.json().catch(() => ({}));
    return { provider, messageId: typeof payload.id === 'string' ? payload.id : '' };
  }

  if (provider === 'sendgrid') {
    const apiKey = secrets?.sendgridApiKey;
    if (!apiKey) throw new Error('SendGrid API secret is not configured.');
    const response = await fetchImpl('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: recipient }] }],
        from: { email: sender.email, name: fromName },
        subject,
        content: [{ type: 'text/plain', value: text }, { type: 'text/html', value: html }],
        ...(safeReplyTo ? { reply_to: { email: safeReplyTo } } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (response.status !== 202 && !response.ok) throw new Error(`SendGrid rejected the message (HTTP ${response.status}).`);
    return { provider, messageId: response.headers.get('x-message-id') || '' };
  }

  if (provider === 'smtp') {
    const password = secrets?.smtpPassword;
    const smtp = settings.smtp || {};
    if (!password || !smtp.host || !smtp.username || !Number.isInteger(smtp.port)) {
      throw new Error('SMTP credentials or connection settings are incomplete.');
    }
    const nodemailer = smtpModule || require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure === true,
      auth: { user: smtp.username, pass: password },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
    const result = await transporter.sendMail({
      from,
      to: recipient,
      subject,
      html,
      text,
      ...(safeReplyTo ? { replyTo: safeReplyTo } : {}),
    });
    return { provider, messageId: String(result.messageId || '') };
  }

  throw new Error('Select and configure an email provider before sending.');
}

module.exports = {
  deliverEmail,
  findSender,
  providerStatus,
  renderEmail,
  safeEmail,
};
