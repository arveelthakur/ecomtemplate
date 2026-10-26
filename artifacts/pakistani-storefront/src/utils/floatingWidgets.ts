import { floatingWidgetIconOptions, floatingWidgetIcons, legacyFloatingWidgetIconAliases } from './floatingWidgetIcons.ts';

export type FloatingWidgetPosition = 'left' | 'right';
export type FloatingContactChannel = 'whatsapp' | 'instagram' | 'facebook' | 'x' | 'phone' | 'messenger';
export type FloatingOfferAction = 'popup' | 'category' | 'sale-page';
export type FloatingOfferBadgeSettings = {
  visible: boolean; label: string; color: string; pulse: boolean; countdownEnabled: boolean; expiresAt: string;
  action: FloatingOfferAction; categoryId: string; saleUrl: string; position: FloatingWidgetPosition;
};
export type FloatingContactWidgetSettings = {
  visible: boolean; channel: FloatingContactChannel; target: string; position: FloatingWidgetPosition;
};
export type FloatingActionKind = 'contact' | 'offer' | 'track-order' | 'custom' | 'faq' | 'coupon' | 'flash-sale' | 'review';
export type FloatingActionPosition = 'bottom-right' | 'bottom-left' | 'bottom-center' | 'middle-right' | 'middle-left';
export type FloatingActionAnimation = 'pulse' | 'bounce' | 'glow' | 'static';
export type FloatingWidgetShape = 'pill' | 'rounded-rectangle' | 'circle' | 'rounded-square';
export type FloatingActionWidget = {
  id: string; kind: FloatingActionKind; label: string; target: string; icon: string; color: string; visible: boolean;
  customImageUrl?: string;
  position: FloatingActionPosition; animation: FloatingActionAnimation; shape: FloatingWidgetShape; channel?: FloatingContactChannel;
  desktopOffsetX: number; desktopOffsetY: number; mobileOffsetX: number; mobileOffsetY: number;
  visibleOnRoutes: string[]; offerAction?: FloatingOfferAction; categoryId?: string; countdownEnabled?: boolean; expiresAt?: string;
};
export type FloatingWidgetsSettings = {
  positionVersion: 2;
  offerBadge: FloatingOfferBadgeSettings;
  contactWidget: FloatingContactWidgetSettings;
  widgets: FloatingActionWidget[];
};

export const floatingWidgetShapes: FloatingWidgetShape[] = ['pill', 'rounded-rectangle', 'circle', 'rounded-square'];

export const floatingWidgetPresets: {
  kind: FloatingActionKind; label: string; icon: string; target: string; color: string;
}[] = [
  { kind: 'contact', label: 'Contact us', icon: 'message-circle', target: '', color: '#25d366' },
  { kind: 'offer', label: 'Special offer', icon: 'tag', target: '/shop', color: '#4A2837' },
  { kind: 'track-order', label: 'Track order', icon: 'package', target: '/track-order', color: '#4A2837' },
  { kind: 'custom', label: 'Visit us', icon: 'external-link', target: '/shop', color: '#4A2837' },
  { kind: 'faq', label: 'Quick FAQ', icon: 'help-circle', target: '/policies/faq', color: '#4A2837' },
  { kind: 'coupon', label: 'Get a discount', icon: 'badge-percent', target: '/shop', color: '#4A2837' },
  { kind: 'flash-sale', label: 'Flash sale', icon: 'zap', target: '/shop', color: '#4A2837' },
  { kind: 'review', label: 'Share feedback', icon: 'star', target: '/reviews', color: '#4A2837' },
];

export const defaultFloatingWidgets: FloatingWidgetsSettings = {
  positionVersion: 2,
  offerBadge: { visible: true, label: 'A little offer', color: '#4A2837', pulse: false, countdownEnabled: false, expiresAt: '', action: 'popup', categoryId: 'skin-body', saleUrl: '', position: 'right' },
  contactWidget: { visible: true, channel: 'whatsapp', target: '', position: 'right' },
  widgets: [
    { id: 'offer-badge', kind: 'offer', label: 'A little offer', target: '/shop', icon: 'tag', color: '#4A2837', visible: true, position: 'bottom-right', animation: 'static', shape: 'pill', desktopOffsetX: 16, desktopOffsetY: 16, mobileOffsetX: 16, mobileOffsetY: 0, visibleOnRoutes: [], offerAction: 'popup', categoryId: 'skin-body', countdownEnabled: false, expiresAt: '' },
    { id: 'contact-whatsapp', kind: 'contact', label: 'WhatsApp', target: '', icon: 'message-circle', color: '#25d366', visible: true, position: 'bottom-right', animation: 'static', shape: 'pill', channel: 'whatsapp', desktopOffsetX: 16, desktopOffsetY: 16, mobileOffsetX: 16, mobileOffsetY: 0, visibleOnRoutes: [] },
  ],
};

export function normalizeFloatingWidgets(value: unknown): FloatingWidgetsSettings {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const offer = source.offerBadge && typeof source.offerBadge === 'object' ? source.offerBadge as Record<string, unknown> : {};
  const contact = source.contactWidget && typeof source.contactWidget === 'object' ? source.contactWidget as Record<string, unknown> : {};
  const migrateLegacyStack = source.positionVersion !== 2 && offer.position === 'left' && (contact.position === 'right' || contact.position === undefined);
  const offerAction = offer.action;
  const channel = contact.channel;
  const normalizedOffer: FloatingOfferBadgeSettings = {
    ...defaultFloatingWidgets.offerBadge,
    visible: typeof offer.visible === 'boolean' ? offer.visible : defaultFloatingWidgets.offerBadge.visible,
    label: typeof offer.label === 'string' ? offer.label.slice(0, 64) : defaultFloatingWidgets.offerBadge.label,
    color: typeof offer.color === 'string' && /^#[0-9a-f]{6}$/i.test(offer.color) ? offer.color : defaultFloatingWidgets.offerBadge.color,
    pulse: typeof offer.pulse === 'boolean' ? offer.pulse : defaultFloatingWidgets.offerBadge.pulse,
    countdownEnabled: typeof offer.countdownEnabled === 'boolean' ? offer.countdownEnabled : defaultFloatingWidgets.offerBadge.countdownEnabled,
    expiresAt: typeof offer.expiresAt === 'string' ? offer.expiresAt.slice(0, 40) : defaultFloatingWidgets.offerBadge.expiresAt,
    action: offerAction === 'category' || offerAction === 'sale-page' || offerAction === 'popup' ? offerAction : defaultFloatingWidgets.offerBadge.action,
    categoryId: typeof offer.categoryId === 'string' ? offer.categoryId.slice(0, 120) : defaultFloatingWidgets.offerBadge.categoryId,
    saleUrl: typeof offer.saleUrl === 'string' ? offer.saleUrl.slice(0, 1000) : defaultFloatingWidgets.offerBadge.saleUrl,
    position: migrateLegacyStack ? 'right' : offer.position === 'right' || offer.position === 'left' ? offer.position : defaultFloatingWidgets.offerBadge.position,
  };
  const normalizedContact: FloatingContactWidgetSettings = {
    ...defaultFloatingWidgets.contactWidget,
    visible: typeof contact.visible === 'boolean' ? contact.visible : defaultFloatingWidgets.contactWidget.visible,
    channel: channel === 'instagram' || channel === 'facebook' || channel === 'x' || channel === 'phone' || channel === 'messenger' || channel === 'whatsapp' ? channel : defaultFloatingWidgets.contactWidget.channel,
    target: typeof contact.target === 'string' ? contact.target.slice(0, 500) : defaultFloatingWidgets.contactWidget.target,
    position: migrateLegacyStack ? 'right' : contact.position === 'right' || contact.position === 'left' ? contact.position : defaultFloatingWidgets.contactWidget.position,
  };
  const rawWidgets = Array.isArray(source.widgets) ? source.widgets : null;
  const legacyPosition = (position: FloatingWidgetPosition): FloatingActionPosition => position === 'left' ? 'bottom-left' : 'bottom-right';
  const widgetDefaults: FloatingActionWidget[] = [
    { ...defaultFloatingWidgets.widgets[0], label: normalizedOffer.label, target: normalizedOffer.saleUrl || '/shop', color: normalizedOffer.color, visible: normalizedOffer.visible, position: legacyPosition(normalizedOffer.position), animation: normalizedOffer.pulse ? 'pulse' : 'static', offerAction: normalizedOffer.action, categoryId: normalizedOffer.categoryId, countdownEnabled: normalizedOffer.countdownEnabled, expiresAt: normalizedOffer.expiresAt },
    { ...defaultFloatingWidgets.widgets[1], label: normalizedContact.channel === 'phone' ? 'Call us' : 'Contact us', target: normalizedContact.target, color: normalizedContact.channel === 'whatsapp' ? '#25d366' : '#4A2837', visible: normalizedContact.visible, position: legacyPosition(normalizedContact.position), channel: normalizedContact.channel },
  ];
  const widgets: FloatingActionWidget[] = rawWidgets === null ? widgetDefaults : rawWidgets.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return [];
    const saved = raw as Record<string, unknown>;
    if (!['contact', 'offer', 'track-order', 'custom', 'faq', 'coupon', 'flash-sale', 'review'].includes(String(saved.kind))) return [];
    const fallback = defaultFloatingWidgets.widgets.find(item => item.id === saved.id) || widgetDefaults[index] || defaultFloatingWidgets.widgets[0];
    const position: FloatingActionPosition = ['bottom-right', 'bottom-left', 'bottom-center', 'middle-right', 'middle-left'].includes(String(saved.position)) ? saved.position as FloatingActionPosition : fallback.position;
    const animation: FloatingActionAnimation = ['pulse', 'bounce', 'glow', 'static'].includes(String(saved.animation)) ? saved.animation as FloatingActionAnimation : fallback.animation;
    const channelValue = saved.channel;
    const safeChannel: FloatingContactChannel = channelValue === 'instagram' || channelValue === 'facebook' || channelValue === 'x' || channelValue === 'phone' || channelValue === 'messenger' || channelValue === 'whatsapp' ? channelValue : fallback.channel || 'whatsapp';
    const offset = (value: unknown, fallbackValue: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(240, Math.round(value))) : fallbackValue;
    const routes = Array.isArray(saved.visibleOnRoutes) ? saved.visibleOnRoutes.filter((route): route is string => typeof route === 'string').slice(0, 30).map(route => route.slice(0, 160)) : [];
    const savedIcon = typeof saved.icon === 'string'
      ? legacyFloatingWidgetIconAliases[saved.icon] || (floatingWidgetIconOptions.includes(saved.icon as (typeof floatingWidgetIconOptions)[number]) && Object.hasOwn(floatingWidgetIcons, saved.icon) ? saved.icon : fallback.icon)
      : fallback.icon;
    return [{
      id: typeof saved.id === 'string' && saved.id.trim() ? saved.id.slice(0, 80) : `floating-${index + 1}`,
      kind: saved.kind as FloatingActionKind,
      label: typeof saved.label === 'string' ? saved.label.slice(0, 64) : fallback.label,
      target: typeof saved.target === 'string' ? saved.target.slice(0, 1000) : fallback.target,
      icon: savedIcon,
      ...(typeof saved.customImageUrl==='string'&&/^https?:\/\//i.test(saved.customImageUrl)?{customImageUrl:saved.customImageUrl.slice(0,2048)}:{}),
      color: typeof saved.color === 'string' && /^#[0-9a-f]{6}$/i.test(saved.color) ? saved.color : fallback.color,
      visible: saved.visible !== false,
      position,
      animation,
      shape: floatingWidgetShapes.includes(saved.shape as FloatingWidgetShape) ? saved.shape as FloatingWidgetShape : fallback.shape || 'pill',
      channel: safeChannel,
      desktopOffsetX: offset(saved.desktopOffsetX, fallback.desktopOffsetX),
      desktopOffsetY: offset(saved.desktopOffsetY, fallback.desktopOffsetY),
      mobileOffsetX: offset(saved.mobileOffsetX, fallback.mobileOffsetX),
      mobileOffsetY: offset(saved.mobileOffsetY, fallback.mobileOffsetY),
      visibleOnRoutes: routes,
      offerAction: saved.offerAction === 'category' || saved.offerAction === 'sale-page' || saved.offerAction === 'popup' ? saved.offerAction : fallback.offerAction,
      categoryId: typeof saved.categoryId === 'string' ? saved.categoryId.slice(0, 120) : fallback.categoryId,
      countdownEnabled: saved.countdownEnabled === true,
      expiresAt: typeof saved.expiresAt === 'string' ? saved.expiresAt.slice(0, 40) : '',
    }];
  });
  return { positionVersion: 2, offerBadge: normalizedOffer, contactWidget: normalizedContact, widgets };
}
