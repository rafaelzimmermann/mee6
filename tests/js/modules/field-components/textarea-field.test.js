import { describe, it, expect } from 'vitest';
import { render, getValue, validate } from '../../../../mee6/web/static/js/modules/field-components/textarea-field.js';

describe('TextareaField Component', () => {
  describe('render()', () => {
    it('renders textarea with correct attributes', () => {
      const field = {
        name: 'prompt',
        label: 'Prompt',
        field_type: 'textarea',
        placeholder: 'Enter prompt',
        required: true
      };
      const html = render(field, 'hello', 0);

      expect(html).toContain('<textarea');
      expect(html).toContain('name="prompt"');
      expect(html).toContain('id="field-0-prompt"');
      expect(html).toContain('placeholder="Enter prompt"');
      expect(html).toContain('required');
      expect(html).toContain('>hello</textarea>');
      expect(html).toContain('<label class="field-label">');
      expect(html).toContain('</label>');
    });

    it('renders without hints when placeholderHints is empty', () => {
      const field = {
        name: 'content',
        label: 'Content',
        field_type: 'textarea'
      };
      const html = render(field, 'test', 0, { placeholderHints: [] });

      expect(html).not.toContain('field-hint');
      expect(html).not.toContain('Placeholders:');
    });

    it('renders without hints when placeholderHints not provided', () => {
      const field = {
        name: 'content',
        label: 'Content',
        field_type: 'textarea'
      };
      const html = render(field, 'test', 0);

      expect(html).not.toContain('field-hint');
    });

    it('includes single hint when provided', () => {
      const field = {
        name: 'message',
        label: 'Message',
        field_type: 'textarea'
      };
      const hints = ['{previous_output}'];
      const html = render(field, '', 0, { placeholderHints: hints });

      expect(html).toContain('<span class="field-hint">');
      expect(html).toContain('Placeholders:');
      expect(html).toContain('<code>{previous_output}</code>');
    });

    it('includes multiple hints when provided', () => {
      const field = {
        name: 'message',
        label: 'Message',
        field_type: 'textarea'
      };
      const hints = ['{previous_output}', '{pipeline_name}', '{step_output}'];
      const html = render(field, '', 0, { placeholderHints: hints });

      expect(html).toContain('<span class="field-hint">');
      expect(html).toContain('Placeholders:');
      expect(html).toContain('<code>{previous_output}</code>');
      expect(html).toContain('<code>{pipeline_name}</code>');
      expect(html).toContain('<code>{step_output}</code>');
    });

    it('escapes XSS in hint values', () => {
      const field = {
        name: 'message',
        label: 'Message',
        field_type: 'textarea'
      };
      const hints = ['<script>alert(1)</script>'];
      const html = render(field, '', 0, { placeholderHints: hints });

      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('escapes HTML in value (goes between textarea tags)', () => {
      const field = {
        name: 'content',
        label: 'Content',
        field_type: 'textarea'
      };
      const html = render(field, '<script>alert("xss")</script>', 0);

      // Value goes between opening and closing textarea tags
      expect(html).toContain('>');
      expect(html).toContain('<');
      expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('escapes HTML in placeholder', () => {
      const field = {
        name: 'content',
        label: 'Content',
        field_type: 'textarea',
        placeholder: '<img src=x onerror=alert(1)>'
      };
      const html = render(field, '', 0);

      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(html).not.toContain('<img>');
    });

    it('escapes HTML in label', () => {
      const field = {
        name: 'content',
        label: '<script>alert(1)</script>',
        field_type: 'textarea'
      };
      const html = render(field, '', 0);

      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('includes required attribute when required is true', () => {
      const field = {
        name: 'content',
        label: 'Content',
        field_type: 'textarea',
        required: true
      };
      const html = render(field, '', 0);

      expect(html).toContain('required');
    });

    it('omits required attribute when required is false', () => {
      const field = {
        name: 'content',
        label: 'Content',
        field_type: 'textarea',
        required: false
      };
      const html = render(field, '', 0);

      expect(html).not.toContain('required');
    });

    it('handles undefined value', () => {
      const field = {
        name: 'content',
        label: 'Content',
        field_type: 'textarea'
      };
      const html = render(field, undefined, 0);

      expect(html).toContain('><');
      expect(html).toContain('></textarea>');
    });

    it('handles null value', () => {
      const field = {
        name: 'content',
        label: 'Content',
        field_type: 'textarea'
      };
      const html = render(field, null, 0);

      expect(html).toContain('><');
      expect(html).toContain('></textarea>');
    });

    it('handles no placeholder', () => {
      const field = {
        name: 'content',
        label: 'Content',
        field_type: 'textarea'
      };
      const html = render(field, '', 0);

      expect(html).not.toContain('placeholder=');
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
      const field = { name: 'test', field_type: 'textarea' };
      expect(validate(field, 'value')).toBeNull();
    });
  });
});
