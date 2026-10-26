import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Eye, Mail, Plus, RefreshCw, Save, Send, ShieldCheck, Trash2 } from 'lucide-react';
import ImageUpload from '../../components/ImageUpload';
import BroadcastManager from './BroadcastManager';
import {
  EMAIL_TEMPLATE_VARIABLES,
  EMAIL_TRIGGER_LABELS,
  type EmailProvider,
  type EmailProviderStatus,
  type EmailSettings,
  type EmailTemplateId,
  type EmailTriggerId,
} from './emailTypes';

type EmailEngineEditorProps = {
  settings: EmailSettings;
  providerStatus: EmailProviderStatus | null;
  statusLoading: boolean;
  saving: boolean;
  sendingTest: boolean;
  feedback: string;
  onSave(next: EmailSettings): Promise<void>;
  onRefreshStatus(): Promise<void>;
  onSendTestEmail(input: { recipient: string; senderProfileId: string }): Promise<void>;
};

const sectionTabs = [
  { id: 'delivery', label: 'Delivery', number: '01' },
  { id: 'automations', label: 'Automations', number: '02' },
  { id: 'templates', label: 'Templates', number: '03' },
  { id: 'branding', label: 'Branding', number: '04' },
  { id: 'broadcast', label: 'Broadcast / Marketing', number: '05' },
  { id: 'test', label: 'Test email', number: '06' },
] as const;

const providerNames: Record<EmailProvider, string> = {
  none: 'Choose a provider',
  resend: 'Resend',
  sendgrid: 'SendGrid',
  smtp: 'Custom SMTP',
};

const sampleValues: Record<string, string> = {
  customer_name: 'Ayesha Khan',
  order_id: 'NR-28419',
  order_total: 'Rs. 8,450',
  items_list: '2 × Noor Lawn Suit · 1 × Gul Candle',
  courier_name: 'TCS',
  tracking_number: 'TCS-72918402',
  tracking_url: 'https://tracking.example.pk/NR-28419',
};

const templateIds = Object.keys(EMAIL_TRIGGER_LABELS) as EmailTemplateId[];

function Toggle({ checked, onChange, label, testId }: { checked: boolean; onChange: () => void; label: string; testId: string }) {
  return (
    <button
      type="button"
      className={`ad-browse-switch ${checked ? 'on' : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      data-testid={testId}
    >
      <span />
    </button>
  );
}

export default function EmailEngineEditor({
  settings,
  providerStatus,
  statusLoading,
  saving,
  sendingTest,
  feedback,
  onSave,
  onRefreshStatus,
  onSendTestEmail,
}: EmailEngineEditorProps) {
  const [selectedSubtab, setSelectedSubtab] = useState<string>('delivery');
  const [draft, setDraft] = useState<EmailSettings>(() => structuredClone(settings));
  const [previewRecipient, setPreviewRecipient] = useState('ayesha@example.pk');
  const [testRecipient, setTestRecipient] = useState('');

  useEffect(() => {
    setDraft(structuredClone(settings));
  }, [settings]);

  const selectedTemplateId = (selectedSubtab.startsWith('template:')
    ? selectedSubtab.slice('template:'.length)
    : 'orderReceipt') as EmailTemplateId;
  const activeSection = selectedSubtab.startsWith('template:') ? 'templates' : selectedSubtab;
  const currentTemplate = draft.templates[selectedTemplateId];
  const selectedSender = draft.senderProfiles.find(profile => profile.id === draft.defaultSenderProfileId);
  const statusReady = providerStatus?.canSend === true;

  const updateDraft = (update: (current: EmailSettings) => EmailSettings) => {
    setDraft(current => update(current));
  };

  const setProvider = (provider: EmailProvider) => {
    updateDraft(current => ({ ...current, provider }));
  };

  const setTemplate = (id: EmailTemplateId, key: 'subject' | 'body', value: string) => {
    updateDraft(current => ({
      ...current,
      templates: { ...current.templates, [id]: { ...current.templates[id], [key]: value } },
    }));
  };

  const insertShortcode = (variable: string) => {
    setTemplate(selectedTemplateId, 'body', `${currentTemplate.body}{${variable}}`);
  };

  const makePreview = (text: string) =>
    text.replace(/\{([a-z_]+)\}/g, (match, variable: string) => sampleValues[variable] ?? match);

  const addProfile = () => {
    if (draft.senderProfiles.length >= 20) return;
    const id = `sender-${Date.now().toString(36)}`;
    const nextProfile = { id, name: '', email: '' };
    updateDraft(current => ({
      ...current,
      senderProfiles: [...current.senderProfiles, nextProfile],
      defaultSenderProfileId: current.defaultSenderProfileId || id,
    }));
  };

  const updateProfile = (id: string, key: 'name' | 'email', value: string) => {
    updateDraft(current => ({
      ...current,
      senderProfiles: current.senderProfiles.map(profile => profile.id === id ? { ...profile, [key]: value } : profile),
    }));
  };

  const removeProfile = (id: string) => {
    updateDraft(current => {
      const senderProfiles = current.senderProfiles.filter(profile => profile.id !== id);
      const defaultSenderProfileId = current.defaultSenderProfileId === id ? (senderProfiles[0]?.id || '') : current.defaultSenderProfileId;
      const triggers = { ...current.triggers };
      (Object.keys(triggers) as EmailTriggerId[]).forEach(triggerId => {
        if (triggers[triggerId].senderProfileId === id) {
          triggers[triggerId] = { ...triggers[triggerId], senderProfileId: '' };
        }
      });
      return { ...current, senderProfiles, defaultSenderProfileId, triggers };
    });
  };

  const updateTrigger = (id: EmailTriggerId, key: 'enabled' | 'senderProfileId', value: boolean | string) => {
    updateDraft(current => ({
      ...current,
      triggers: { ...current.triggers, [id]: { ...current.triggers[id], [key]: value } },
    }));
  };

  const save = () => onSave(structuredClone(draft));
  const sendTest = (event: { preventDefault(): void }) => {
    event.preventDefault();
    if (!statusReady || !testRecipient.trim() || !draft.defaultSenderProfileId) return;
    void onSendTestEmail({ recipient: testRecipient.trim(), senderProfileId: draft.defaultSenderProfileId });
  };

  return (
    <div className="nura-admin email-engine">
      <style>{`
        .email-engine { --email-rosewash: color-mix(in srgb,var(--ad-burgundy) 8%,var(--ad-paper)); --email-plum: var(--ad-burgundy); --email-leaf: #71816b; }
        .email-engine .email-head { align-items: center; }
        .email-engine .email-head-copy { display: flex; align-items: center; gap: 14px; }
        .email-engine .email-mark { width: 44px; height: 44px; display: grid; place-items: center; color: var(--ad-burgundy); background: #eadde2; border-radius: 12px; }
        .email-engine .email-mark svg { width: 20px; }
        .email-engine .email-head-meta { margin-top: 9px; display: flex; gap: 8px; align-items: center; color: var(--ad-muted); font-size: 10px; }
        .email-engine .email-layout { display: grid; grid-template-columns: minmax(0,1fr) 256px; gap: 18px; align-items: start; }
        .email-engine .email-main-column { min-width: 0; }
        .email-engine .email-tabs { margin-bottom: 15px; gap: 3px; }
        .email-engine .email-tab { padding: 11px 13px; display: inline-flex; align-items: center; gap: 8px; }
        .email-engine .email-tab-num { color: #b1a49a; font-size: 8px; letter-spacing: .08em; }
        .email-engine .email-pane { min-height: 310px; }
        .email-engine .email-intro { display: flex; align-items: flex-start; gap: 12px; padding: 14px 15px; background: #f6f2eb; border: 1px solid #eee7df; border-radius: 7px; margin-bottom: 17px; }
        .email-engine .email-intro svg { flex: 0 0 auto; color: var(--ad-burgundy); width: 17px; margin-top: 1px; }
        .email-engine .email-intro strong { display: block; font-size: 10px; margin-bottom: 3px; }
        .email-engine .email-intro p { margin: 0; color: var(--ad-muted); font-size: 9px; line-height: 1.6; }
        .email-engine .email-status { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 13px 15px; margin-bottom: 17px; border: 1px solid var(--ad-border); border-radius: 7px; background: #fffdf9; }
        .email-engine .email-status-main { display: flex; gap: 10px; min-width: 0; }
        .email-engine .email-status-symbol { width: 27px; height: 27px; border-radius: 50%; display: grid; place-items: center; color: #657a60; background: #e8ede3; flex: 0 0 auto; }
        .email-engine .email-status-symbol.off { color: #8b6245; background: #f2e9dc; }
        .email-engine .email-status-symbol svg { width: 14px; }
        .email-engine .email-status-title { font-size: 10px; font-weight: 700; }
        .email-engine .email-status-detail { color: var(--ad-muted); font-size: 9px; line-height: 1.55; margin-top: 3px; }
        .email-engine .email-profiles { display: grid; gap: 9px; }
        .email-engine .email-profile { display: grid; grid-template-columns: minmax(120px, .8fr) minmax(180px, 1.2fr) auto auto; gap: 9px; align-items: end; padding: 12px; background: #fcfaf6; border: 1px solid #eee7df; border-radius: 7px; }
        .email-engine .email-profile-default { color: var(--ad-burgundy); background: #f4ecee; }
        .email-engine .email-side { display: grid; gap: 13px; }
        .email-engine .email-side-card { padding: 16px; background: #f3eee5; border: 1px solid var(--ad-border); border-radius: 8px; }
        .email-engine .email-side-label { color: #918579; text-transform: uppercase; font-size: 8px; letter-spacing: .14em; font-weight: 700; }
        .email-engine .email-side-value { margin-top: 7px; font-family: 'Manrope', sans-serif; font-size: 15px; font-weight: 750; }
        .email-engine .email-side-copy { color: #7f756b; font-size: 9px; line-height: 1.6; margin-top: 5px; }
        .email-engine .email-step-list { display: grid; gap: 10px; margin-top: 14px; }
        .email-engine .email-step { display: flex; align-items: flex-start; gap: 9px; color: #6f665e; font-size: 9px; line-height: 1.45; }
        .email-engine .email-step b { color: #a3988c; font-size: 8px; }
        .email-engine .email-banner { display: flex; gap: 9px; padding: 11px 12px; border: 1px solid #eadfce; background: #f7f1e6; border-radius: 6px; color: #79694f; font-size: 9px; line-height: 1.55; margin-bottom: 15px; }
        .email-engine .email-banner svg { flex: 0 0 auto; width: 14px; height: 14px; }
        .email-engine .email-template-tabs { display: flex; gap: 6px; overflow-x: auto; margin: -2px 0 15px; padding-bottom: 3px; }
        .email-engine .email-template-tab { flex: 0 0 auto; display: flex; align-items: center; gap: 7px; border: 1px solid var(--ad-border); border-radius: 6px; background: #fffdf9; color: #756b62; padding: 8px 10px; font: inherit; font-size: 9px; font-weight: 650; cursor: pointer; }
        .email-engine .email-template-tab.active { color: var(--ad-burgundy); border-color: #cdb5bf; background: #f4ecee; }
        .email-engine .email-template-tab i { width: 6px; height: 6px; border-radius: 50%; background: #c9c0b7; }
        .email-engine .email-template-tab i.on { background: #788b70; }
        .email-engine .email-template-grid { display: grid; grid-template-columns: minmax(0,1fr) minmax(230px,.88fr); gap: 15px; }
        .email-engine .email-code { font-family: 'Spline Sans Mono', ui-monospace, monospace; min-height: 180px; font-size: 10px; }
        .email-engine .email-shortcodes { display: flex; flex-wrap: wrap; gap: 6px; margin: 9px 0 0; }
        .email-engine .email-shortcode { border: 1px solid #e3d8cd; border-radius: 4px; padding: 5px 7px; color: #745363; background: #f7f1f2; font-family: 'Spline Sans Mono', ui-monospace, monospace; font-size: 8px; cursor: pointer; }
        .email-engine .email-preview { overflow: hidden; border: 1px solid #e8dfd4; border-radius: 7px; background: #f6f2eb; }
        .email-engine .email-preview-bar { display: flex; justify-content: space-between; gap: 8px; padding: 10px 12px; color: #8e8378; border-bottom: 1px solid #e8dfd4; font-size: 8px; text-transform: uppercase; letter-spacing: .1em; }
        .email-engine .email-preview-sheet { min-height: 230px; margin: 12px; padding: 18px 16px; background: #fffdf9; border: 1px solid #ebe5dd; }
        .email-engine .email-preview-brand { color: var(--ad-burgundy); font-family: 'Manrope', sans-serif; font-size: 16px; font-weight: 800; letter-spacing: -.06em; }
        .email-engine .email-preview-subject { padding-bottom: 12px; border-bottom: 1px solid #eee7df; margin: 11px 0; font-weight: 700; font-size: 10px; }
        .email-engine .email-preview-body { color: #655b52; font-size: 9px; line-height: 1.8; white-space: pre-wrap; }
        .email-engine .email-bottom-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 18px; padding-top: 15px; border-top: 1px solid #eee7df; }
        .email-engine .email-save-hint { display: flex; gap: 6px; align-items: center; color: #978c81; font-size: 9px; }
        .email-engine .email-save-hint svg { width: 13px; }
        .email-engine .email-color-row { display: flex; align-items: center; gap: 11px; }
        .email-engine .email-color-input { width: 40px; height: 36px; padding: 3px; border: 1px solid #e4dbd0; border-radius: 5px; background: #fffdfa; }
        .email-engine .email-logo-preview { min-height: 74px; display: flex; align-items: center; justify-content: center; border: 1px dashed #d8cec3; background: #fcfaf6; border-radius: 6px; padding: 10px; }
        .email-engine .email-logo-preview img { display: block; max-width: 180px; max-height: 55px; object-fit: contain; }
        .email-engine .email-logo-placeholder { color: #9a8f84; font-size: 9px; }
        .email-engine .email-test-form { max-width: 590px; }
        .email-engine .email-test-hero { display: flex; gap: 13px; align-items: center; padding: 15px; border-radius: 7px; background: #f6f2eb; margin-bottom: 17px; }
        .email-engine .email-test-hero-mark { display: grid; place-items: center; width: 37px; height: 37px; border-radius: 10px; color: var(--ad-burgundy); background: #eadde2; }
        .email-engine .email-test-hero-mark svg { width: 17px; }
        .email-engine .email-test-hero strong { font-size: 11px; }
        .email-engine .email-test-hero p { margin: 4px 0 0; color: var(--ad-muted); font-size: 9px; }
        .email-engine .email-feedback { margin-top: 12px; color: #5f755a; font-size: 10px; }
        .email-engine .email-disabled-note { color: #92733f; font-size: 9px; margin-top: 8px; line-height: 1.5; }
        @media (max-width: 920px) {
          .email-engine .email-layout { grid-template-columns: 1fr; }
          .email-engine .email-side { grid-template-columns: repeat(2,minmax(0,1fr)); }
        }
        @media (max-width: 650px) {
          .email-engine .email-template-grid { grid-template-columns: 1fr; }
          .email-engine .email-profile { grid-template-columns: 1fr 1fr auto; }
          .email-engine .email-profile .email-profile-default-action { grid-column: 1 / 3; grid-row: 2; justify-self: start; }
          .email-engine .email-profile .email-profile-remove { grid-column: 3; grid-row: 1; }
          .email-engine .email-side { grid-template-columns: 1fr; }
          .email-engine .email-head-copy { align-items: flex-start; }
          .email-engine .email-head .ad-btn { align-self: stretch; }
        }
        @media (max-width: 420px) {
          .email-engine .email-profile { grid-template-columns: 1fr auto; }
          .email-engine .email-profile .email-profile-email { grid-column: 1 / -1; }
          .email-engine .email-profile .email-profile-default-action { grid-column: 1; grid-row: 3; }
          .email-engine .email-profile .email-profile-remove { grid-column: 2; grid-row: 3; }
        }
      `}</style>

      <div className="ad-page-head email-head">
        <div className="email-head-copy">
          <div className="email-mark" aria-hidden="true"><Mail /></div>
          <div>
            <div className="ad-kicker">Store communications</div>
            <h1 className="ad-page-title">Email engine</h1>
            <p className="ad-page-subtitle">Manage the emails your store sends from order to doorstep.</p>
            <div className="email-head-meta"><span>{providerNames[draft.provider]}</span><span aria-hidden="true">·</span><span>{draft.senderProfiles.length} sender {draft.senderProfiles.length === 1 ? 'profile' : 'profiles'}</span></div>
          </div>
        </div>
        <button className="ad-btn primary" type="button" onClick={save} disabled={saving} data-testid="button-save-email-settings">
          {saving ? <RefreshCw className="email-spin" /> : <Save />} {saving ? 'Saving changes' : 'Save changes'}
        </button>
      </div>

      <div className="email-layout">
        <div className="email-main-column">
          <nav className="ad-tabs email-tabs" aria-label="Email settings sections" role="tablist">
            {sectionTabs.map(tab => (
              <button
                type="button"
                role="tab"
                aria-selected={activeSection === tab.id}
                className={`ad-tab email-tab ${activeSection === tab.id ? 'active' : ''}`}
                key={tab.id}
                onClick={() => setSelectedSubtab(tab.id)}
                data-testid={`tab-email-${tab.id}`}
              >
                <span className="email-tab-num">{tab.number}</span>{tab.label}
              </button>
            ))}
          </nav>

          <section className="ad-card email-pane" role="tabpanel">
            {activeSection === 'delivery' && (
              <>
                <header className="ad-card-head">
                  <div><h2 className="ad-card-title">Sending setup</h2><div className="ad-card-note">Choose how email leaves your store.</div></div>
                  <Toggle
                    checked={draft.masterEnabled}
                    label="Enable all transactional email"
                    onChange={() => updateDraft(current => ({ ...current, masterEnabled: !current.masterEnabled }))}
                    testId="switch-master-email"
                  />
                </header>
                <div className="ad-card-body">
                  <div className="email-status" data-testid="note-provider-status">
                    <div className="email-status-main">
                      <div className={`email-status-symbol ${statusReady ? '' : 'off'}`}>{statusReady ? <Check /> : <AlertTriangle />}</div>
                      <div>
                        <div className="email-status-title">{statusLoading ? 'Checking provider connection…' : providerStatus?.canSend ? 'Provider ready to send' : 'Provider needs attention'}</div>
                        <div className="email-status-detail">{statusLoading ? 'Checking the server-side configuration.' : providerStatus?.detail || 'Select and configure a provider to check its sending status.'}</div>
                      </div>
                    </div>
                    <button type="button" className="ad-btn small" onClick={() => void onRefreshStatus()} disabled={statusLoading} data-testid="button-refresh-provider-status">
                      <RefreshCw /> Refresh
                    </button>
                  </div>
                  <div className="email-banner">
                    <ShieldCheck />
                    <div><strong>Credentials stay server-side.</strong> API keys and SMTP passwords must be configured on the server. This editor never collects or stores them.</div>
                  </div>
                  <div className="ad-form-stack">
                    <div className="ad-form-row">
                      <div className="ad-field">
                        <label className="ad-label" htmlFor="email-provider">Email provider</label>
                        <select id="email-provider" className="ad-select" value={draft.provider} onChange={event => setProvider(event.target.value as EmailProvider)} data-testid="select-email-provider">
                          <option value="none">Choose a provider</option>
                          <option value="resend">Resend</option>
                          <option value="sendgrid">SendGrid</option>
                          <option value="smtp">Custom SMTP</option>
                        </select>
                        <div className="ad-help">Provider secrets are maintained by your server administrator.</div>
                      </div>
                      {draft.provider !== 'smtp' && (
                        <div className="email-intro" style={{ marginBottom: 0 }}>
                          <Mail />
                          <div><strong>{draft.provider === 'none' ? 'Select a delivery provider' : `${providerNames[draft.provider]} selected`}</strong><p>Sending availability is confirmed from the server status above.</p></div>
                        </div>
                      )}
                    </div>
                    {draft.provider === 'smtp' && (
                      <>
                        <div className="ad-form-row">
                          <div className="ad-field">
                            <label className="ad-label" htmlFor="smtp-host">SMTP host</label>
                            <input id="smtp-host" className="ad-input" value={draft.smtp.host} onChange={event => updateDraft(current => ({ ...current, smtp: { ...current.smtp, host: event.target.value } }))} placeholder="smtp.example.com" data-testid="input-smtp-host" />
                          </div>
                          <div className="ad-form-row">
                            <div className="ad-field">
                              <label className="ad-label" htmlFor="smtp-port">Port</label>
                              <input id="smtp-port" className="ad-input" type="number" min="1" max="65535" value={draft.smtp.port} onChange={event => updateDraft(current => ({ ...current, smtp: { ...current.smtp, port: Number(event.target.value) || 587 } }))} data-testid="input-smtp-port" />
                            </div>
                            <label className="ad-checkline" style={{ alignSelf: 'end', minHeight: 37 }}>
                              <input type="checkbox" checked={draft.smtp.secure} onChange={event => updateDraft(current => ({ ...current, smtp: { ...current.smtp, secure: event.target.checked } }))} data-testid="input-smtp-secure" />
                              Use secure connection
                            </label>
                          </div>
                        </div>
                        <div className="ad-field">
                          <label className="ad-label" htmlFor="smtp-username">SMTP username</label>
                          <input id="smtp-username" className="ad-input" autoComplete="off" value={draft.smtp.username} onChange={event => updateDraft(current => ({ ...current, smtp: { ...current.smtp, username: event.target.value } }))} placeholder="mailbox username" data-testid="input-smtp-username" />
                          <div className="ad-help">Non-secret connection detail only. Do not enter a password here.</div>
                        </div>
                      </>
                    )}
                    <div>
                      <div className="ad-card-head" style={{ padding: '14px 0 11px', borderTop: '1px solid #eee7df', borderBottom: 0 }}>
                        <div><h3 className="ad-card-title">Sender profiles</h3><div className="ad-card-note">Addresses your customers will see.</div></div>
                        <button type="button" className="ad-btn small" onClick={addProfile} disabled={draft.senderProfiles.length >= 20} data-testid="button-add-sender-profile"><Plus /> Add sender</button>
                      </div>
                      {draft.senderProfiles.length === 0 ? (
                        <div className="ad-notice">Add a sender profile before setting up customer-facing messages.</div>
                      ) : (
                        <div className="email-profiles">
                          {draft.senderProfiles.map(profile => (
                            <div className={`email-profile ${draft.defaultSenderProfileId === profile.id ? 'email-profile-default' : ''}`} key={profile.id}>
                              <div className="ad-field">
                                <label className="ad-label" htmlFor={`profile-name-${profile.id}`}>Display name</label>
                                <input id={`profile-name-${profile.id}`} className="ad-input" value={profile.name} onChange={event => updateProfile(profile.id, 'name', event.target.value)} placeholder="Your store name" data-testid={`input-sender-name-${profile.id}`} />
                              </div>
                              <div className="ad-field email-profile-email">
                                <label className="ad-label" htmlFor={`profile-email-${profile.id}`}>From email</label>
                                <input id={`profile-email-${profile.id}`} className="ad-input" type="email" value={profile.email} onChange={event => updateProfile(profile.id, 'email', event.target.value)} placeholder="hello@your-domain.com" data-testid={`input-sender-email-${profile.id}`} />
                              </div>
                              <button type="button" className={`ad-btn small email-profile-default-action ${draft.defaultSenderProfileId === profile.id ? 'primary' : ''}`} onClick={() => updateDraft(current => ({ ...current, defaultSenderProfileId: profile.id }))} aria-pressed={draft.defaultSenderProfileId === profile.id} data-testid={`button-default-sender-${profile.id}`}>
                                {draft.defaultSenderProfileId === profile.id ? <><Check /> Default</> : 'Make default'}
                              </button>
                              <button type="button" className="ad-icon-btn email-profile-remove" onClick={() => removeProfile(profile.id)} aria-label={`Remove ${profile.name || 'sender profile'}`} data-testid={`button-remove-sender-${profile.id}`}><Trash2 /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeSection === 'automations' && (
              <>
                <header className="ad-card-head"><div><h2 className="ad-card-title">Customer moments</h2><div className="ad-card-note">Choose which moments deserve a note from your store.</div></div><span className={`ad-status ${draft.masterEnabled ? 'green' : 'amber'}`}>{draft.masterEnabled ? 'Email enabled' : 'Email paused'}</span></header>
                <div className="ad-card-body">
                  <div className="email-banner"><Mail /><div>Individual automations can be prepared while email is paused. Nothing sends until the main switch is on and the provider is ready.</div></div>
                  <div className="ad-form-stack">
                    {(Object.keys(EMAIL_TRIGGER_LABELS) as EmailTriggerId[]).map(id => (
                      <div className="ad-browse-setting" key={id}>
                        <div className="ad-browse-setting-copy">
                          <div className="ad-item-name">{EMAIL_TRIGGER_LABELS[id]}</div>
                          <div className="ad-item-sub">{id === 'orderReceipt' ? 'A confirmation after a successful order.' : id === 'shippingUpdate' ? 'A dispatch note with courier details.' : id === 'cancellation' ? 'A clear update when an order is cancelled.' : 'A gentle reminder for an unfinished checkout.'}</div>
                          <div className="ad-form-row" style={{ marginTop: 9, maxWidth: 440 }}>
                            <div className="ad-field">
                              <label className="ad-label" htmlFor={`trigger-sender-${id}`}>Send from profile</label>
                              <select id={`trigger-sender-${id}`} className="ad-select" value={draft.triggers[id].senderProfileId} onChange={event => updateTrigger(id, 'senderProfileId', event.target.value)} disabled={!draft.senderProfiles.length} data-testid={`select-trigger-sender-${id}`}>
                                <option value="">Use default sender</option>
                                {draft.senderProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name || profile.email || 'Unnamed sender'}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>
                        <Toggle checked={draft.triggers[id].enabled} label={`Enable ${EMAIL_TRIGGER_LABELS[id]}`} onChange={() => updateTrigger(id, 'enabled', !draft.triggers[id].enabled)} testId={`switch-trigger-${id}`} />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeSection === 'templates' && (
              <>
                <header className="ad-card-head"><div><h2 className="ad-card-title">Message templates</h2><div className="ad-card-note">Write in your store’s voice. Use a shortcode to include order details.</div></div><Eye size={16} color="#8b7e72" /></header>
                <div className="ad-card-body">
                  <div className="email-template-tabs" role="tablist" aria-label="Choose email template">
                    {templateIds.map(id => (
                      <button type="button" role="tab" aria-selected={selectedTemplateId === id} className={`email-template-tab ${selectedTemplateId === id ? 'active' : ''}`} key={id} onClick={() => setSelectedSubtab(`template:${id}`)} data-testid={`tab-template-${id}`}>
                        <i className={draft.triggers[id].enabled ? 'on' : ''} />{EMAIL_TRIGGER_LABELS[id]}
                      </button>
                    ))}
                  </div>
                  <div className="email-template-grid">
                    <div className="ad-form-stack">
                      <div className="ad-field">
                        <label className="ad-label" htmlFor="email-template-subject">Subject line</label>
                        <input id="email-template-subject" className="ad-input" maxLength={180} value={currentTemplate.subject} onChange={event => setTemplate(selectedTemplateId, 'subject', event.target.value)} data-testid="input-template-subject" />
                      </div>
                      <div className="ad-field">
                        <label className="ad-label" htmlFor="email-template-body">Email message</label>
                        <textarea id="email-template-body" className="ad-textarea email-code" maxLength={12000} value={currentTemplate.body} onChange={event => setTemplate(selectedTemplateId, 'body', event.target.value)} data-testid="textarea-template-body" />
                        <div className="ad-help">{currentTemplate.body.length.toLocaleString()} / 12,000 characters</div>
                      </div>
                      <div>
                        <div className="ad-label">Insert shortcode into message</div>
                        <div className="email-shortcodes">
                          {EMAIL_TEMPLATE_VARIABLES.map(variable => (
                            <button type="button" className="email-shortcode" key={variable} onClick={() => insertShortcode(variable)} aria-label={`Insert ${variable} shortcode`} data-testid={`button-shortcode-${variable}`}>{`{${variable}}`}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="email-preview">
                      <div className="email-preview-bar"><span>Live preview</span><span>Sample order</span></div>
                      <div style={{ padding: '10px 12px 0' }}>
                        <label className="ad-label" htmlFor="email-preview-recipient">Preview as</label>
                        <input id="email-preview-recipient" className="ad-input" type="email" value={previewRecipient} onChange={event => setPreviewRecipient(event.target.value)} data-testid="input-preview-recipient" />
                      </div>
                      <div className="email-preview-sheet">
                        {draft.branding.logoUrl ? <img src={draft.branding.logoUrl} alt="Store email logo" loading="lazy" decoding="async" style={{ maxWidth: 130, maxHeight: 36, objectFit: 'contain' }} /> : <div className="email-preview-brand">Online shop</div>}
                        <div className="email-preview-subject">{makePreview(currentTemplate.subject)}</div>
                        <div className="email-preview-body">{makePreview(currentTemplate.body).replaceAll('Ayesha Khan', previewRecipient.split('@')[0] || 'Ayesha')}</div>
                        <div style={{ borderTop: '1px solid #eee7df', marginTop: 14, paddingTop: 9, color: '#93877b', fontSize: 8 }}>{draft.branding.footerCopyright}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeSection === 'branding' && (
              <>
                <header className="ad-card-head"><div><h2 className="ad-card-title">Email identity</h2><div className="ad-card-note">Carry the storefront’s look into every inbox.</div></div></header>
                <div className="ad-card-body ad-form-stack">
                  <div className="ad-form-row">
                    <div className="ad-form-stack">
                      <div className="ad-field">
                        <label className="ad-label" htmlFor="email-logo-url">Logo image URL</label>
                        <input id="email-logo-url" className="ad-input" value={draft.branding.logoUrl} onChange={event => updateDraft(current => ({ ...current, branding: { ...current.branding, logoUrl: event.target.value } }))} placeholder="https://… or /image.png" data-testid="input-email-logo-url" />
                        <div className="ad-help">A horizontal transparent logo works best in email headers.</div>
                      </div>
                       <ImageUpload folder="banners" recommendation="Email logo: 1200 × 400 px · transparent wide wordmark" onUploaded={url => updateDraft(current => ({ ...current, branding: { ...current.branding, logoUrl: url } }))} />
                    </div>
                    <div className="ad-form-stack">
                      <div className="ad-field">
                        <label className="ad-label" htmlFor="email-accent-color">Accent color</label>
                        <div className="email-color-row"><input id="email-accent-color" type="color" className="email-color-input" value={draft.branding.accentColor} onChange={event => updateDraft(current => ({ ...current, branding: { ...current.branding, accentColor: event.target.value } }))} data-testid="input-email-accent-color" /><input aria-label="Accent color hex value" className="ad-input" value={draft.branding.accentColor} onChange={event => updateDraft(current => ({ ...current, branding: { ...current.branding, accentColor: event.target.value } }))} data-testid="input-email-accent-hex" /></div>
                      </div>
                      <div className="email-logo-preview" style={{ borderColor: draft.branding.accentColor }}>
                        {draft.branding.logoUrl ? <img src={draft.branding.logoUrl} alt="Email logo preview" loading="lazy" decoding="async" /> : <span className="email-logo-placeholder">Your logo preview</span>}
                      </div>
                    </div>
                  </div>
                  <div className="ad-field">
                    <label className="ad-label" htmlFor="email-footer">Footer line</label>
                    <input id="email-footer" className="ad-input" maxLength={300} value={draft.branding.footerCopyright} onChange={event => updateDraft(current => ({ ...current, branding: { ...current.branding, footerCopyright: event.target.value } }))} data-testid="input-email-footer" />
                  </div>
                  <div>
                    <div className="ad-card-title" style={{ marginBottom: 10 }}>Social details</div>
                    <div className="ad-form-row">
                      <div className="ad-field"><label className="ad-label" htmlFor="email-instagram">Instagram URL</label><input id="email-instagram" className="ad-input" value={draft.branding.socialLinks.instagram} onChange={event => updateDraft(current => ({ ...current, branding: { ...current.branding, socialLinks: { ...current.branding.socialLinks, instagram: event.target.value } } }))} placeholder="https://instagram.com/…" data-testid="input-email-instagram" /></div>
                      <div className="ad-field"><label className="ad-label" htmlFor="email-facebook">Facebook URL</label><input id="email-facebook" className="ad-input" value={draft.branding.socialLinks.facebook} onChange={event => updateDraft(current => ({ ...current, branding: { ...current.branding, socialLinks: { ...current.branding.socialLinks, facebook: event.target.value } } }))} placeholder="https://facebook.com/…" data-testid="input-email-facebook" /></div>
                    </div>
                    <div className="ad-field" style={{ marginTop: 12 }}><label className="ad-label" htmlFor="email-whatsapp">WhatsApp number</label><input id="email-whatsapp" className="ad-input" value={draft.branding.socialLinks.whatsapp} onChange={event => updateDraft(current => ({ ...current, branding: { ...current.branding, socialLinks: { ...current.branding.socialLinks, whatsapp: event.target.value } } }))} placeholder="+92 300 1234567" data-testid="input-email-whatsapp" /></div>
                  </div>
                </div>
              </>
            )}

            {activeSection === 'broadcast' && <><header className="ad-card-head"><div><h2 className="ad-card-title">Broadcast and marketing</h2><div className="ad-card-note">Compose campaigns for opted-in audiences, save drafts, test delivery, and review send history.</div></div></header><BroadcastManager settings={draft} providerStatus={providerStatus} onSendTestEmail={onSendTestEmail}/></>}

            {activeSection === 'test' && (
              <>
                <header className="ad-card-head"><div><h2 className="ad-card-title">Send a test email</h2><div className="ad-card-note">Check your sender and provider before enabling a customer flow.</div></div></header>
                <div className="ad-card-body">
                  <div className="email-test-form">
                    <div className="email-test-hero"><div className="email-test-hero-mark"><Send /></div><div><strong>One careful check before launch</strong><p>This sends a test message through the configured provider.</p></div></div>
                    <form className="ad-form-stack" onSubmit={sendTest}>
                      <div className="ad-field">
                        <label className="ad-label" htmlFor="test-email-recipient">Recipient email address</label>
                        <input id="test-email-recipient" className="ad-input" type="email" required value={testRecipient} onChange={event => setTestRecipient(event.target.value)} placeholder="you@example.com" data-testid="input-test-email-recipient" />
                      </div>
                      <div className="ad-field">
                        <label className="ad-label" htmlFor="test-email-sender">Sender profile</label>
                        <select id="test-email-sender" className="ad-select" value={draft.defaultSenderProfileId} onChange={event => updateDraft(current => ({ ...current, defaultSenderProfileId: event.target.value }))} disabled={!draft.senderProfiles.length} data-testid="select-test-email-sender">
                          {draft.senderProfiles.length ? draft.senderProfiles.map(profile => <option value={profile.id} key={profile.id}>{profile.name || profile.email || 'Unnamed sender'}{profile.id === draft.defaultSenderProfileId ? ' · default' : ''}</option>) : <option value="">Add a sender profile first</option>}
                        </select>
                      </div>
                      <div>
                        <button type="submit" className="ad-btn primary" disabled={!statusReady || sendingTest || !testRecipient.trim() || !draft.defaultSenderProfileId} data-testid="button-send-test-email">
                          {sendingTest ? <RefreshCw /> : <Send />} {sendingTest ? 'Sending test' : 'Send test email'}
                        </button>
                        {!statusReady && <div className="email-disabled-note" data-testid="text-test-email-disabled">{providerStatus?.detail || (statusLoading ? 'Waiting for provider status.' : 'Test sending is unavailable until the provider is ready.')}</div>}
                        {feedback && <div className="email-feedback" role="status" data-testid="status-test-email-feedback">{feedback}</div>}
                      </div>
                    </form>
                  </div>
                </div>
              </>
            )}
          </section>
          <div className="email-bottom-actions">
            <div className="email-save-hint"><ShieldCheck /> Settings are saved to the store configuration.</div>
          </div>
        </div>

        <aside className="email-side" aria-label="Email setup guidance">
          <section className="email-side-card">
            <div className="email-side-label">Delivery overview</div>
            <div className="email-side-value">{draft.masterEnabled ? 'Ready to configure' : 'Paused for now'}</div>
            <div className="email-side-copy">{draft.masterEnabled ? 'The main switch is on. Provider readiness still controls delivery.' : 'Turn on email when your sender and provider are ready.'}</div>
            <div className="email-step-list">
              <div className="email-step"><b>01</b><span>Choose a provider and confirm server status.</span></div>
              <div className="email-step"><b>02</b><span>Set a sender profile your customers recognize.</span></div>
              <div className="email-step"><b>03</b><span>Review each message, then send yourself a test.</span></div>
            </div>
          </section>
          <section className="email-side-card">
            <div className="email-side-label">Default sender</div>
            <div className="email-side-value">{selectedSender?.name || 'Not set'}</div>
            <div className="email-side-copy">{selectedSender?.email || 'Add a verified sender address in Delivery.'}</div>
            {selectedSender && <div style={{ marginTop: 10 }}><span className="ad-status green"><Check size={11} style={{ marginRight: 4 }} />Default profile</span></div>}
          </section>
          <section className="email-side-card">
            <div className="email-side-label">Account security</div>
            <div className="email-side-copy" style={{ marginTop: 8 }}>API keys and SMTP passwords belong in server-side configuration only. Never paste credentials into the storefront admin.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, color: '#63765d', fontSize: 9, fontWeight: 700 }}><ShieldCheck size={14} /> No secret fields in this editor</div>
          </section>
        </aside>
      </div>
    </div>
  );
}
