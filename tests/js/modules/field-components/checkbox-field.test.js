import { describe, it, expect } from 'vitest';
import { render, getValue, validate } from '../../../../mee6/web/static/js/modules/field-components/checkbox-field.js';

describe('CheckboxField Component', () => {
  describe('render()', () => {
    it('renders unchecked by default', () => {
      const field = {
        name: 'read_memory',
        label: 'Read Memory',
        field_type: 'checkbox'
      };
      const html = render(field, '', 0);

      expect(html).toContain('<input type="checkbox"');
      expect(html).toContain('name="read_memory"');
      expect(html).toContain('id="field-0-read_memory"');
      expect(html).toContain('value="on"');
      expect(html).not.toContain('checked');
      expect(html).toContain('<label class="field-label">');
    });

    it('renders checked when value is "on"', () => {
      const field = {
        name: 'read_memory',
        label: 'Read Memory',
        field_type: 'checkbox'
      };
      const html = render(field, 'on', 0);

      expect(html).toContain('checked');
      expect(html).toContain('<label class="field-label">');
    });

    it('renders error span with correct id', () => {
      const field = { name: 'read_memory', label: 'Read Memory', field_type: 'checkbox', required: false };
      const html = render(field, '', 0);
      expect(html).toContain('id="error-0-read_memory"');
      expect(html).toContain('class="field-error-message"');
    });

    it('renders unchecked when value is undefined', () => {
      const field = {
        name: 'read_memory',
        label: 'Read Memory',
        field_type: 'checkbox'
      };
      const html = render(field, undefined, 0);

      expect(html).not.toContain('checked');
    });

    it('renders unchecked when value is null', () => {
      const field = {
        name: 'read_memory',
        label: 'Read Memory',
        field_type: 'checkbox'
      };
      const html = render(field, null, 0);

      expect(html).not.toContain('checked');
    });

    it('renders unchecked when value is empty string', () => {
      const field = {
        name: 'read_memory',
        label: 'Read Memory',
        field_type: 'checkbox'
      };
      const html = render(field, '', 0);

      expect(html).not.toContain('checked');
    });

    it('escapes XSS in label', () => {
      const field = {
        name: 'read_memory',
        label: '<script>alert(1)</script>',
        field_type: 'checkbox'
      };
      const html = render(field, '', 0);

      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('escapes XSS in field name', () => {
      const field = {
        name: '"><script>alert(1)</script>',
        label: 'Read Memory',
        field_type: 'checkbox'
      };
      const html = render(field, '', 0);

      expect(html).toContain('&quot;');
      expect(html).toContain('&gt;');
      expect(html).toContain('&lt;');
      expect(html).not.toContain('"><script>');
    });

    it('includes required attribute when required is true', () => {
      const field = {
        name: 'read_memory',
        label: 'Read Memory',
        field_type: 'checkbox',
        required: true
      };
      const html = render(field, '', 0);

      expect(html).toContain('required');
    });

    it('omits required attribute when required is false', () => {
      const field = {
        name: 'read_memory',
        label: 'Read Memory',
        field_type: 'checkbox',
        required: false
      };
      const html = render(field, '', 0);

      expect(html).not.toContain('required');
    });
  });

  describe('getValue()', () => {
    it('returns "on" when checkbox is checked', () => {
      const element = { checked: true };
      expect(getValue(element)).toBe('on');
    });

    it('returns empty string when checkbox is unchecked', () => {
      const element = { checked: false };
      expect(getValue(element)).toBe('');
    });
  });

  describe('validate()', () => {
    it('returns null (stub for Phase 6)', () => {
      const field = { name: 'test', field_type: 'checkbox' };
      expect(validate(field, 'value')).toBeNull();
    });
  });
});
