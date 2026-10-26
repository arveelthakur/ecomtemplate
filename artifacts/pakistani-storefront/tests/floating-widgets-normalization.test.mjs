import assert from 'node:assert/strict';
import test from 'node:test';
import {
  floatingWidgetPresets,
  floatingWidgetShapes,
  normalizeFloatingWidgets,
} from '../src/utils/floatingWidgets.ts';
import {
  floatingWidgetIconOptions,
  floatingWidgetIcons,
} from '../src/utils/floatingWidgetIcons.ts';

test('all admin widget presets, icon choices, shapes, labels, and targets survive Supabase normalization', () => {
  const widgets = floatingWidgetPresets.flatMap((preset, presetIndex) =>
    floatingWidgetShapes.map((shape, shapeIndex) => {
      const icon = floatingWidgetIconOptions[(presetIndex * floatingWidgetShapes.length + shapeIndex) % floatingWidgetIconOptions.length];
      return {
        id: `saved-${preset.kind}-${shape}`,
        kind: preset.kind,
        label: `Saved ${preset.label} ${shape}`,
        target: `/saved/${preset.kind}/${shape}`,
        icon,
        color: '#5a2842',
        visible: true,
        position: 'bottom-center',
        animation: 'static',
        shape,
        desktopOffsetX: 19,
        desktopOffsetY: 23,
        mobileOffsetX: 11,
        mobileOffsetY: 7,
        visibleOnRoutes: ['/shop'],
      };
    }),
  );
  const storeDocument = {
    positionVersion: 2,
    offerBadge: {},
    contactWidget: {},
    widgets,
  };

  const normalized = normalizeFloatingWidgets(storeDocument);
  const reloaded = normalizeFloatingWidgets(JSON.parse(JSON.stringify(normalized)));

  assert.deepEqual(
    reloaded.widgets.map(({ kind, icon, shape, label, target }) => ({ kind, icon, shape, label, target })),
    widgets.map(({ kind, icon, shape, label, target }) => ({ kind, icon, shape, label, target })),
  );
  for (const widget of reloaded.widgets) {
    assert.ok(floatingWidgetIcons[widget.icon], `missing rendered icon for ${widget.icon}`);
  }
});

test('legacy icon aliases normalize to selectable icons and unsupported icons use a visible fallback', () => {
  const aliases = [
    ['message', 'message-circle'],
    ['share', 'share-2'],
    ['x', 'twitter'],
    ['help', 'help-circle'],
    ['circle-help', 'help-circle'],
  ];
  for (const [legacyIcon, canonicalIcon] of aliases) {
    const [widget] = normalizeFloatingWidgets({
      positionVersion: 2,
      widgets: [{ id: `legacy-${legacyIcon}`, kind: 'custom', icon: legacyIcon }],
    }).widgets;
    assert.equal(widget.icon, canonicalIcon);
    assert.ok(floatingWidgetIconOptions.includes(widget.icon));
    assert.ok(floatingWidgetIcons[widget.icon]);
  }

  const [unsupported] = normalizeFloatingWidgets({
    positionVersion: 2,
    widgets: [{ id: 'unsupported', kind: 'custom', icon: 'not-a-real-icon', shape: 'circle' }],
  }).widgets;
  assert.equal(unsupported.icon, 'tag');
  assert.equal(unsupported.shape, 'circle');
});

test('custom widget image URLs survive normalization and unsafe schemes are discarded', () => {
  const [animated] = normalizeFloatingWidgets({
    positionVersion: 2,
    widgets: [{ id: 'animated', kind: 'custom', icon: 'tag', customImageUrl: 'https://cdn.example.test/widget.gif' }],
  }).widgets;
  const [unsafe] = normalizeFloatingWidgets({
    positionVersion: 2,
    widgets: [{ id: 'unsafe', kind: 'custom', icon: 'tag', customImageUrl: 'javascript:alert(1)' }],
  }).widgets;
  assert.equal(animated.customImageUrl, 'https://cdn.example.test/widget.gif');
  assert.equal(unsafe.customImageUrl, undefined);
});
