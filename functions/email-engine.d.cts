type ProviderSecrets = {
  resendApiKey?: string;
  sendgridApiKey?: string;
  smtpPassword?: string;
};

export function providerStatus(
  settings: Record<string, unknown>,
  secrets?: ProviderSecrets,
): {
  provider: string;
  credentialsConfigured: boolean;
  canSend: boolean;
  detail: string;
};

export function deliverEmail(options: {
  settings: Record<string, unknown>;
  sender: { name: string; email: string };
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  secrets?: ProviderSecrets;
}): Promise<{ provider: string; messageId: string }>;
