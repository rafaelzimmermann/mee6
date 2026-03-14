import { describe, it, expect } from 'vitest';
import { render, getValue, validate } from '../../../../mee6/web/static/js/modules/field-components/combobox-field.js';

describe('ComboboxField Component', () => {
  describe('render()', () => {
    it('renders combobox with text input and datalist', () => {
      const field = {
        name: 'language',
        label: 'Language',
        field_type: 'combobox',
        placeholder: 'Select or type language',
        options: ['en', 'es', 'fr', 'de']
      };
      const html = render(field, 'en', 0);

      expect(html).toContain('<input type="text"');
      expect(html).toContain('list="dl-0-language"');
      expect(html).toContain('name="language"');
      expect(html).toContain('id="field-0-language"');
      expect(html).toContain('placeholder="Select or type language"');
      expect(html).toContain('value="en"');
      expect(html).toContain('<datalist id="dl-0-language">');
      expect(html).toContain('</datalist>');
      expect(html).toContain('<label class="field-label">');
    });

    it('renders error span with correct id', () => {
      const field = { name: 'language', label: 'Language', field_type: 'combobox', required: true, options: ['en'] };
      const html = render(field, 'en', 0);
      expect(html).toContain('id="error-0-language"');
      expect(html).toContain('class="field-error-message"');
    });

    it('renders all options in datalist', () => {
      const field = {
        name: 'language',
        label: 'Language',
        field_type: 'combobox',
        options: ['en', 'es', 'fr', 'de']
      };
      const html = render(field, '', 0);

      expect(html).toContain('<option value="en">');
      expect(html).toContain('<option value="es">');
      expect(html).toContain('<option value="fr">');
      expect(html).toContain('<option value="de">');
    });

    it('escapes XSS in option values', () => {
      const field = {
        name: 'content',
        label: 'Content',
        field_type: 'combobox',
        options: ['<script>alert(1)</script>', 'safe']
      };
      const html = render(field, '', 0);

      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('escapes XSS in value', () => {
      const field = {
        name: 'content',
        label: 'Content',
        field_type: 'combobox',
        options: ['en']
      };
      const html = render(field, '<script>alert("xss")</script>', 0);

      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&quot;');
      expect(html).not.toContain('<script>');
    });

    it('escapes XSS in placeholder', () => {
      const field = {
        name: 'content',
        label: 'Content',
        field_type: 'combobox',
        placeholder: '<img src=x onerror=alert(1)>',
        options: ['en']
      };
      const html = render(field, '', 0);

      expect(html).toContain('&lt;img');
      expect(html).toContain('&gt;');
      expect(html).not.toContain('<img>');
    });

    it('escapes XSS in placeholder', () => {
      const field = {
        name: 'content',
        label: 'Content',
        field_type: 'combobox',
        placeholder: '<img src=x onerror=alert(1)>',
        options: ['en']
      };
      const html = render(field, '', 0);

      // Check that HTML entities are present
      expect(html).toContain('&lt;');
      expect(html).toContain('&gt;');
      // Check that raw HTML tags are not present
      expect(html).not.toContain('<img>');
    });

    it('escapes XSS in label', () => {
      const field = {
        name: 'content',
        label: '<script>alert(1)</script>',
        field_type: 'combobox',
        options: ['en']
      };
      const html = render(field, '', 0);

      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('escapes XSS in field name', () => {
      const field = {
        name: '"><script>alert(1)</script>',
        label: 'Language',
        field_type: 'combobox',
        options: ['en']
      };
      const html = render(field, '', 0);

      expect(html).toContain('&quot;');
      expect(html).toContain('&gt;');
      expect(html).toContain('&lt;');
      expect(html).not.toContain('"><script>');
    });

    it('includes required attribute when required is true', () => {
      const field = {
        name: 'language',
        label: 'Language',
        field_type: 'combobox',
        required: true,
        options: ['en']
      };
      const html = render(field, '', 0);

      expect(html).toContain('required');
    });

    it('omits required attribute when required is false', () => {
      const field = {
        name: 'language',
        label: 'Language',
        field_type: 'combobox',
        required: false,
        options: ['en']
      };
      const html = render(field, '', 0);

      expect(html).not.toContain('required');
    });

    it('handles no placeholder', () => {
      const field = {
        name: 'language',
        label: 'Language',
        field_type: 'combobox',
        options: ['en']
      };
      const html = render(field, '', 0);

      // Placeholder attribute should not be present when field.placeholder is undefined/null
      expect(html).toContain('type="text"');
      expect(html).toContain('list=');
      // Check that placeholder attribute is not present (either not in HTML or is empty)
      const placeholderMatch = html.match(/placeholder="([^"]*)"/);
      expect(placeholderMatch).toBeNull();
    });

    it('handles undefined value', () => {
      const field = {
        name: 'language',
        label: 'Language',
        field_type: 'combobox',
        options: ['en']
      };
      const html = render(field, undefined, 0);

      expect(html).toContain('value=""');
    });

    it('handles null value', () => {
      const field = {
        name: 'language',
        label: 'Language',
        field_type: 'combobox',
        options: ['en']
      };
      const html = render(field, null, 0);

      expect(html).toContain('value=""');
    });

    it('correctly links datalist id to input list attribute', () => {
      const field = {
        name: 'language',
        label: 'Language',
        field_type: 'combobox',
        options: ['en', 'es']
      };
      const html = render(field, '', 1);

      expect(html).toContain('list="dl-1-language"');
      expect(html).toContain('<datalist id="dl-1-language">');
    });
  });

  describe('getValue()', () => {
    it('returns element value', () => {
      const element = { value: 'en' };
      expect(getValue(element)).toBe('en');
    });

    it('returns empty string for empty value', () => {
      const element = { value: '' };
      expect(getValue(element)).toBe('');
    });
  });

  describe('validate()', () => {
    it('returns null (stub for Phase 6)', () => {
      const field = { name: 'test', field_type: 'combobox' };
      expect(validate(field, 'value')).toBeNull();
    });
  });
});
