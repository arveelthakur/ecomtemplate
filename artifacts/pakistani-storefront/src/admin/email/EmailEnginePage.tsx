import { useCallback, useEffect, useState } from 'react';
import { httpsCallable, functions } from '../../lib/supabase/functions';
import { protectForm } from '../../hooks/use-recaptcha';
import EmailEngineEditor from './EmailEngineEditor';
import { useEmailSettings } from './useEmailSettings';
import type { EmailProviderStatus } from './emailTypes';

type TestEmailInput = { recipient: string; senderProfileId: string };

export default function EmailEnginePage() {
  const { settings, loading, error: loadError, save } = useEmailSettings();
  const [providerStatus, setProviderStatus] = useState<EmailProviderStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [feedback, setFeedback] = useState('');

  const refreshStatus = useCallback(async () => {
    if (!functions) {
      setProviderStatus({
        provider: settings.provider,
        credentialsConfigured: false,
        canSend: false,
        detail: 'The Vercel server API is not available. Email delivery remains disabled.',
      });
      setStatusLoading(false);
      return;
    }
    setStatusLoading(true);
    try {
      await protectForm();
      const result = await httpsCallable<void, EmailProviderStatus>(functions, 'getEmailProviderStatus')();
      setProviderStatus(result.data);
    } catch (failure) {
      setProviderStatus({
        provider: settings.provider,
        credentialsConfigured: false,
        canSend: false,
        detail: failure instanceof Error ? failure.message : 'Provider status could not be checked.',
      });
    } finally {
      setStatusLoading(false);
    }
  }, [settings.provider]);

  useEffect(() => {
    if (!loading) void refreshStatus();
  }, [loading, refreshStatus]);

  const saveSettings = async (next: Parameters<typeof save>[0]) => {
    setSaving(true);
    setFeedback('');
    try {
      await save(next);
      setFeedback('Email settings saved.');
      await refreshStatus();
    } catch (failure) {
      setFeedback(`Could not save email settings: ${failure instanceof Error ? failure.message : String(failure)}`);
    } finally {
      setSaving(false);
    }
  };

  const sendTestEmail = async (input: TestEmailInput) => {
    if (!functions) {
      setFeedback('Email test is unavailable because the Vercel server API is not configured.');
      return;
    }
    setSendingTest(true);
    setFeedback('');
    try {
      await protectForm();
      const send = httpsCallable<TestEmailInput, { sent: boolean; provider: string }>(functions, 'sendTestEmail');
      const result = await send(input);
      setFeedback(result.data.sent ? `Test email accepted by ${result.data.provider}.` : 'The provider did not accept the test email.');
      await refreshStatus();
    } catch (failure) {
      setFeedback(failure instanceof Error ? failure.message : 'The test email could not be sent.');
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) return <div className="ad-loading" role="status">Loading email settings…</div>;

  return (
    <>
      {loadError && <div className="ad-error" role="alert">{loadError}</div>}
      <EmailEngineEditor
        settings={settings}
        providerStatus={providerStatus}
        statusLoading={statusLoading}
        saving={saving}
        sendingTest={sendingTest}
        feedback={feedback}
        onSave={saveSettings}
        onRefreshStatus={refreshStatus}
        onSendTestEmail={sendTestEmail}
      />
    </>
  );
}
