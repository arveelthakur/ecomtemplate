export type EmailProvider = 'none' | 'resend' | 'sendgrid' | 'smtp';
export type EmailTriggerId = 'orderReceipt' | 'shippingUpdate' | 'cancellation' | 'abandonedCart';
export type EmailTemplateId = EmailTriggerId;

export type SenderEmailProfile = {
  id: string;
  name: string;
  email: string;
};

export type EmailTriggerSetting = {
  enabled: boolean;
  senderProfileId: string;
};

export type EmailTemplate = {
  subject: string;
  body: string;
};

export type EmailBranding = {
  logoUrl: string;
  accentColor: string;
  footerCopyright: string;
  socialLinks: {
    instagram: string;
    facebook: string;
    whatsapp: string;
  };
};

export type SmtpSettings = {
  host: string;
  port: number;
  username: string;
  secure: boolean;
};

export type EmailSettings = {
  masterEnabled: boolean;
  provider: EmailProvider;
  defaultSenderProfileId: string;
  senderProfiles: SenderEmailProfile[];
  triggers: Record<EmailTriggerId, EmailTriggerSetting>;
  templates: Record<EmailTemplateId, EmailTemplate>;
  branding: EmailBranding;
  smtp: SmtpSettings;
};

export type EmailProviderStatus = {
  provider: EmailProvider;
  credentialsConfigured: boolean;
  canSend: boolean;
  detail: string;
};

export const EMAIL_TRIGGER_LABELS: Record<EmailTriggerId, string> = {
  orderReceipt: 'New order receipt',
  shippingUpdate: 'Shipped order & tracking',
  cancellation: 'Cancellation / refund',
  abandonedCart: 'Abandoned checkout recovery',
};

export const EMAIL_TEMPLATE_VARIABLES = [
  'store_name',
  'customer_name',
  'order_id',
  'order_total',
  'items_list',
  'courier_name',
  'tracking_number',
  'tracking_url',
] as const;

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  masterEnabled: false,
  provider: 'none',
  defaultSenderProfileId: '',
  senderProfiles: [],
  triggers: {
    orderReceipt: { enabled: false, senderProfileId: '' },
    shippingUpdate: { enabled: false, senderProfileId: '' },
    cancellation: { enabled: false, senderProfileId: '' },
    abandonedCart: { enabled: false, senderProfileId: '' },
  },
  templates: {
    orderReceipt: {
      subject: 'Your {store_name} order {order_id} is confirmed',
      body: 'Hello {customer_name},\\n\\nThank you for your order. We are preparing it with care.\\n\\nOrder: {order_id}\\nTotal: {order_total}\\n\\n{items_list}',
    },
    shippingUpdate: {
      subject: 'Your {store_name} order {order_id} is on its way',
      body: 'Hello {customer_name},\\n\\nYour order has been dispatched.\\n\\nCourier: {courier_name}\\nTracking number: {tracking_number}\\nTrack your parcel: {tracking_url}',
    },
    cancellation: {
      subject: 'An update about your {store_name} order {order_id}',
      body: 'Hello {customer_name},\\n\\nYour order {order_id} has been cancelled. Please contact our support team if you have questions about a refund.',
    },
    abandonedCart: {
      subject: 'Your {store_name} checkout is waiting',
      body: 'Hello {customer_name},\\n\\nYou left a few things in your checkout. Your selection is still here when you are ready.\\n\\n{items_list}',
    },
  },
  branding: {
    logoUrl: '',
    accentColor: '#6b2447',
    footerCopyright: 'Made thoughtfully in Pakistan.',
    socialLinks: { instagram: '', facebook: '', whatsapp: '' },
  },
  smtp: { host: '', port: 587, username: '', secure: false },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const safeString = (value: unknown, fallback: string, maxLength: number) =>
  typeof value === 'string' ? value.slice(0, maxLength) : fallback;

export function normalizeEmailSettings(value: unknown): EmailSettings {
  const source = isRecord(value) ? value : {};
  const branding = isRecord(source.branding) ? source.branding : {};
  const socialLinks = isRecord(branding.socialLinks) ? branding.socialLinks : {};
  const smtp = isRecord(source.smtp) ? source.smtp : {};
  const rawProfiles = Array.isArray(source.senderProfiles) ? source.senderProfiles : [];
  const senderProfiles = rawProfiles.slice(0, 20).flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const id = safeString(item.id, '', 80).trim();
    if (!id) return [];
    return [{
      id,
      name: safeString(item.name, `Sender ${index + 1}`, 100),
      email: safeString(item.email, '', 254).trim().toLowerCase(),
    }];
  });
  const profileIds = new Set(senderProfiles.map(profile => profile.id));
  const triggers = {} as EmailSettings['triggers'];
  const templates = {} as EmailSettings['templates'];

  for (const id of Object.keys(EMAIL_TRIGGER_LABELS) as EmailTriggerId[]) {
    const setting = isRecord(source.triggers) && isRecord(source.triggers[id]) ? source.triggers[id] as Record<string, unknown> : {};
    const template = isRecord(source.templates) && isRecord(source.templates[id]) ? source.templates[id] as Record<string, unknown> : {};
    triggers[id] = {
      enabled: setting.enabled === true,
      senderProfileId: profileIds.has(String(setting.senderProfileId || '')) ? String(setting.senderProfileId) : '',
    };
    templates[id] = {
      subject: safeString(template.subject, DEFAULT_EMAIL_SETTINGS.templates[id].subject, 180),
      body: safeString(template.body, DEFAULT_EMAIL_SETTINGS.templates[id].body, 12000),
    };
  }

  const provider = ['resend', 'sendgrid', 'smtp'].includes(String(source.provider))
    ? source.provider as EmailProvider
    : 'none';
  const requestedDefault = safeString(source.defaultSenderProfileId, '', 80);

  return {
    masterEnabled: source.masterEnabled === true,
    provider,
    defaultSenderProfileId: profileIds.has(requestedDefault) ? requestedDefault : '',
    senderProfiles,
    triggers,
    templates,
    branding: {
      logoUrl: safeString(branding.logoUrl, '', 1500),
      accentColor: /^#[0-9a-f]{6}$/i.test(String(branding.accentColor || ''))
        ? String(branding.accentColor)
        : DEFAULT_EMAIL_SETTINGS.branding.accentColor,
      footerCopyright: safeString(branding.footerCopyright, DEFAULT_EMAIL_SETTINGS.branding.footerCopyright, 300),
      socialLinks: {
        instagram: safeString(socialLinks.instagram, '', 500),
        facebook: safeString(socialLinks.facebook, '', 500),
        whatsapp: safeString(socialLinks.whatsapp, '', 80),
      },
    },
    smtp: {
      host: safeString(smtp.host, '', 255),
      port: Number.isInteger(smtp.port) && Number(smtp.port) > 0 && Number(smtp.port) <= 65535 ? Number(smtp.port) : 587,
      username: safeString(smtp.username, '', 254),
      secure: smtp.secure === true,
    },
  };
}
