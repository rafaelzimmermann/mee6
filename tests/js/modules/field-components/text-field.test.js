import { describe, it, expect } from 'vitest';
import { render, getValue, validate } from '../../../../mee6/web/static/js/modules/field-components/text-field.js';

describe('TextField Component', () => {
  describe('render()', () => {
    it('renders text input with correct attributes', () => {
      const field = {
        name: 'prompt',
        label: 'Prompt',
        field_type: 'text',
        placeholder: 'Enter prompt',
        required: true
      };
      const html = render(field, 'hello', 0);

      expect(html).toContain('<input type="text"');
      expect(html).toContain('name="prompt"');
      expect(html).toContain('id="field-0-prompt"');
      expect(html).toContain('placeholder="Enter prompt"');
      expect(html).toContain('value="hello"');
      expect(html).toContain('required');
      expect(html).toContain('<label class="field-label">');
      expect(html).toContain('</label>');
    });

    it('renders without placeholder when not provided', () => {
      const field = {
        name: 'task',
        label: 'Task',
        field_type: 'text',
        required: false
      };
      const html = render(field, '', 0);

      expect(html).toContain('<input type="text"');
      expect(html).toContain('name="task"');
      expect(html).toContain('id="field-0-task"');
      expect(html).not.toContain('placeholder=');
    });

    it('escapes XSS in value', () => {
      const field = {
        name: 'prompt',
        label: 'Prompt',
        field_type: 'text'
      };
      const html = render(field, '<script>alert("xss")</script>', 0);

      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('escapes XSS in placeholder', () => {
      const field = {
        name: 'prompt',
        label: 'Prompt',
        field_type: 'text',
        placeholder: '<script>alert(1)</script>'
      };
      const html = render(field, '', 0);

      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('escapes XSS in label', () => {
      const field = {
        name: 'prompt',
        label: '<img src=x onerror=alert(1)>',
        field_type: 'text'
      };
      const html = render(field, '', 0);

      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(html).not.toContain('<img');
    });

    it('escapes XSS in field name', () => {
      const field = {
        name: '"><script>alert(1)</script>',
        label: 'Prompt',
        field_type: 'text'
      };
      const html = render(field, '', 0);

      // Check that each special character is escaped
      expect(html).toContain('&quot;');
      expect(html).toContain('&gt;');
      expect(html).toContain('&lt;');
      // Check that the raw dangerous string is not present
      expect(html).not.toContain('"><script>');
    });

    it('includes required attribute when field.required is true', () => {
      const field = {
        name: 'prompt',
        label: 'Prompt',
        field_type: 'text',
        required: true
      };
      const html = render(field, '', 0);

      expect(html).toContain('required');
    });

    it('omits required attribute when field.required is false', () => {
      const field = {
        name: 'prompt',
        label: 'Prompt',
        field_type: 'text',
        required: false
      };
      const html = render(field, '', 0);

      expect(html).not.toContain('required');
    });

    it('handles undefined value', () => {
      const field = {
        name: 'prompt',
        label: 'Prompt',
        field_type: 'text'
      };
      const html = render(field, undefined, 0);

      expect(html).toContain('value=""');
    });

    it('handles null value', () => {
      const field = {
        name: 'prompt',
        label: 'Prompt',
        field_type: 'text'
      };
      const html = render(field, null, 0);

      expect(html).toContain('value=""');
    });

    it('generates correct id pattern with index', () => {
      const field = {
        name: 'task',
        label: 'Task',
        field_type: 'text'
      };
      const html0 = render(field, '', 0);
      const html1 = render(field, '', 1);
      const html5 = render(field, '', 5);

      expect(html0).toContain('id="field-0-task"');
      expect(html1).toContain('id="field-1-task"');
      expect(html5).toContain('id="field-5-task"');
    });

    it('renders error span with correct id', () => {
      const field = { name: 'prompt', label: 'Prompt', field_type: 'text', required: true };
      const html = render(field, 'value', 0);
      expect(html).toContain('id="error-0-prompt"');
      expect(html).toContain('class="field-error-message"');
    });
  });

  describe('getValue()', () => {
    it('returns element value', () => {
      const element = { value: 'hello world' };
      expect(getValue(element)).toBe('hello world');
    });

    it('returns empty string for empty value', () => {
      const element = { value: '' };
      expect(getValue(element)).toBe('');
    });
  });

  describe('validate()', () => {
    it('returns null (stub for Phase 6)', () => {
      const field = { name: 'test', field_type: 'text' };
      expect(validate(field, 'value')).toBeNull();
    });
  });
});
