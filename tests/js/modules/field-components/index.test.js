import { describe, it, expect } from 'vitest';
import { getComponent, registerComponent } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/field-components/index.js';
import { TextComponent } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/field-components/text-field.js';
import { TextareaComponent } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/field-components/textarea-field.js';
import { SelectComponent } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/field-components/select-field.js';
import { CheckboxComponent } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/field-components/checkbox-field.js';
import { ComboboxComponent } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/field-components/combobox-field.js';
import { GroupSelectComponent } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/field-components/group-select-field.js';
import { CalendarSelectComponent } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/field-components/calendar-select-field.js';

describe('Component Registry', () => {
  it('returns correct component for known types', () => {
    expect(getComponent('text')).toBe(TextComponent);
    expect(getComponent('textarea')).toBe(TextareaComponent);
    expect(getComponent('select')).toBe(SelectComponent);
    expect(getComponent('checkbox')).toBe(CheckboxComponent);
    expect(getComponent('combobox')).toBe(ComboboxComponent);
    expect(getComponent('group_select')).toBe(GroupSelectComponent);
    expect(getComponent('calendar_select')).toBe(CalendarSelectComponent);
  });

  it('returns TextComponent for unknown type', () => {
    const unknownType = 'unknown_type_xyz';
    const component = getComponent(unknownType);
    expect(component).toBe(TextComponent);
  });

  it('returns TextComponent for null/undefined type', () => {
    expect(getComponent(null)).toBe(TextComponent);
    expect(getComponent(undefined)).toBe(TextComponent);
  });

  it('allows registering custom component', () => {
    const customComponent = {
      render: () => 'custom',
      getValue: () => 'value',
      validate: () => null
    };

    registerComponent('custom_type', customComponent);

    const retrieved = getComponent('custom_type');
    expect(retrieved).toBe(customComponent);
  });

  it('allows overwriting existing component', () => {
    const customComponent = {
      render: () => 'new',
      getValue: () => 'value',
      validate: () => null
    };

    // Register custom component for an existing type
    registerComponent('text', customComponent);

    const retrieved = getComponent('text');
    expect(retrieved).toBe(customComponent);
    expect(retrieved).not.toBe(TextComponent);
  });
});
