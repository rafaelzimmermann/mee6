import { describe, it, expect } from 'vitest';
import { render, getValue, validate } from '../../../../mee6/web/static/js/modules/field-components/select-field.js';

describe('SelectField Component', () => {
  describe('render()', () => {
    it('renders select with correct attributes', () => {
      const field = {
        name: 'model',
        label: 'Model',
        field_type: 'select',
        options: ['gpt-4', 'gpt-3.5-turbo'],
        required: true
      };
      const html = render(field, 'gpt-4', 0);

      expect(html).toContain('<select');
      expect(html).toContain('name="model"');
      expect(html).toContain('id="field-0-model"');
      expect(html).toContain('required');
      expect(html).toContain('</select>');
      expect(html).toContain('<label class="field-label">');
    });

    it('renders all options', () => {
      const field = {
        name: 'language',
        label: 'Language',
        field_type: 'select',
        options: ['en', 'es', 'fr', 'de']
      };
      const html = render(field, '', 0);

      expect(html).toContain('value="en"');
      expect(html).toContain('>en</option>');
      expect(html).toContain('value="es"');
      expect(html).toContain('>es</option>');
      expect(html).toContain('value="fr"');
      expect(html).toContain('>fr</option>');
      expect(html).toContain('value="de"');
      expect(html).toContain('>de</option>');
    });

    it('pre-selects the correct option', () => {
      const field = {
        name: 'model',
        label: 'Model',
        field_type: 'select',
        options: ['gpt-4', 'gpt-3.5-turbo', 'gpt-3']
      };
      const html = render(field, 'gpt-3.5-turbo', 0);

      expect(html).toContain('<option value="gpt-3.5-turbo" selected>gpt-3.5-turbo</option>');
      expect(html).toContain('<option value="gpt-4">gpt-4</option>');
      expect(html).not.toContain('<option value="gpt-3.5-turbo">gpt-3.5-turbo</option>');
    });

    it('defaults to first option when no value set', () => {
      const field = {
        name: 'model',
        label: 'Model',
        field_type: 'select',
        options: ['gpt-4', 'gpt-3.5-turbo']
      };
      const html = render(field, undefined, 0);

      expect(html).toContain('<option value="gpt-4" selected>gpt-4</option>');
      expect(html).toContain('<option value="gpt-3.5-turbo">gpt-3.5-turbo</option>');
    });

    it('defaults to first option when value is empty string', () => {
      const field = {
        name: 'model',
        label: 'Model',
        field_type: 'select',
        options: ['gpt-4', 'gpt-3.5-turbo']
      };
      const html = render(field, '', 0);

      expect(html).toContain('<option value="gpt-4" selected>gpt-4</option>');
    });

    it('escapes XSS in option values', () => {
      const field = {
        name: 'content',
        label: 'Content',
        field_type: 'select',
        options: ['<script>alert(1)</script>', 'safe']
      };
      const html = render(field, '', 0);

      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(html).not.toContain('<script>');
      expect(html).toContain('value="&lt;script&gt;alert(1)&lt;/script&gt;"');
    });

    it('escapes XSS in option labels', () => {
      const field = {
        name: 'content',
        label: 'Content',
        field_type: 'select',
        options: ['<img src=x onerror=alert(1)>', 'safe']
      };
      const html = render(field, '', 0);

      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(html).not.toContain('<img>');
    });

    it('escapes XSS in label', () => {
      const field = {
        name: 'model',
        label: '<script>alert(1)</script>',
        field_type: 'select',
        options: ['gpt-4']
      };
      const html = render(field, '', 0);

      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('escapes XSS in field name', () => {
      const field = {
        name: '"><script>alert(1)</script>',
        label: 'Model',
        field_type: 'select',
        options: ['gpt-4']
      };
      const html = render(field, '', 0);

      expect(html).toContain('&quot;');
      expect(html).toContain('&gt;');
      expect(html).toContain('&lt;');
      expect(html).not.toContain('"><script>');
    });

    it('includes required attribute when required is true', () => {
      const field = {
        name: 'model',
        label: 'Model',
        field_type: 'select',
        required: true,
        options: ['gpt-4']
      };
      const html = render(field, '', 0);

      expect(html).toContain('required');
    });

    it('omits required attribute when required is false', () => {
      const field = {
        name: 'model',
        label: 'Model',
        field_type: 'select',
        required: false,
        options: ['gpt-4']
      };
      const html = render(field, '', 0);

      expect(html).not.toContain('required');
    });

    it('handles null value', () => {
      const field = {
        name: 'model',
        label: 'Model',
        field_type: 'select',
        options: ['gpt-4', 'gpt-3.5']
      };
      const html = render(field, null, 0);

      expect(html).toContain('<option value="gpt-4" selected>gpt-4</option>');
    });
  });

  describe('getValue()', () => {
    it('returns element value', () => {
      const element = { value: 'gpt-4' };
      expect(getValue(element)).toBe('gpt-4');
    });

    it('returns empty string for empty value', () => {
      const element = { value: '' };
      expect(getValue(element)).toBe('');
    });
  });

  describe('validate()', () => {
    it('returns null (stub for Phase 6)', () => {
      const field = { name: 'test', field_type: 'select' };
      expect(validate(field, 'value')).toBeNull();
    });
  });
});
