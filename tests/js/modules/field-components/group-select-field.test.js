import { describe, it, expect } from 'vitest';
import { render, getValue, validate } from '../../../../mee6/web/static/js/modules/field-components/group-select-field.js';

describe('GroupSelectField Component', () => {
  describe('render()', () => {
    it('renders select with correct attributes', () => {
      const field = {
        name: 'group_id',
        label: 'Group',
        field_type: 'group_select',
        options: ['Group A', 'Group B||ID-2', 'Group C||ID-3']
      };
      const html = render(field, 'ID-2', 0);

      expect(html).toContain('<select');
      expect(html).toContain('name="group_id"');
      expect(html).toContain('id="field-0-group_id"');
      expect(html).toContain('</select>');
      expect(html).toContain('<label class="field-label">');
    });

    it('renders error span with correct id', () => {
      const field = { name: 'group_id', label: 'Group', field_type: 'group_select', required: true, options: ['Group A'] };
      const html = render(field, 'Group A', 0);
      expect(html).toContain('id="error-0-group_id"');
      expect(html).toContain('class="field-error-message"');
    });

    it('renders empty option first', () => {
      const field = {
        name: 'group_id',
        label: 'Group',
        field_type: 'group_select',
        options: ['Group A||ID-1']
      };
      const html = render(field, '', 0);

      expect(html).toContain('<option value="">— select group —</option>');
    });

    it('correctly parses "||" format', () => {
      const field = {
        name: 'group_id',
        label: 'Group',
        field_type: 'group_select',
        options: ['Group A||ID-1', 'Group B||ID-2', 'Group C']
      };
      const html = render(field, 'ID-2', 0);

      // Group A||ID-1 -> display "Group A", value "ID-1"
      expect(html).toContain('value="ID-1"');
      expect(html).toContain('>Group A</option>');
      // Group B||ID-2 -> display "Group B", value "ID-2"
      expect(html).toContain('value="ID-2"');
      expect(html).toContain('>Group B</option>');
      // Group C (no ||) -> display "Group C", value "Group C"
      expect(html).toContain('value="Group C"');
      expect(html).toContain('>Group C</option>');
    });

    it('correctly pre-selects option by value', () => {
      const field = {
        name: 'group_id',
        label: 'Group',
        field_type: 'group_select',
        options: ['Group A||ID-1', 'Group B||ID-2', 'Group C||ID-3']
      };
      const html = render(field, 'ID-2', 0);

      expect(html).toContain('value="ID-2"');
      expect(html).toContain('>Group B</option>');
      expect(html).toContain('value="ID-1"');
      expect(html).toContain('>Group A</option>');
      expect(html).not.toContain('value="ID-2">');
    });

    it('populates hint span with initial value', () => {
      const field = {
        name: 'group_id',
        label: 'Group',
        field_type: 'group_select',
        options: ['Group A||ID-1', 'Group B||ID-2']
      };
      const html = render(field, 'ID-1', 0);

      expect(html).toContain('<span class="field-hint" id="hint-0-group_id">ID-1</span>');
    });

    it('generates correct hint span id', () => {
      const field = {
        name: 'group_id',
        label: 'Group',
        field_type: 'group_select',
        options: ['Group A||ID-1']
      };
      const html0 = render(field, '', 0);
      const html1 = render(field, '', 1);
      const html5 = render(field, '', 5);

      expect(html0).toContain('id="hint-0-group_id"');
      expect(html1).toContain('id="hint-1-group_id"');
      expect(html5).toContain('id="hint-5-group_id"');
    });

    it('uses data-hint-target instead of inline onchange handler', () => {
      const field = {
        name: 'group_id',
        label: 'Group',
        field_type: 'group_select',
        options: ['Group A||ID-1']
      };
      const html = render(field, '', 0);

      expect(html).toContain('data-hint-target=');
      expect(html).not.toContain('onchange=');
      expect(html).toContain('hint-0-group_id');
    });

    it('includes data-hint attribute on options', () => {
      const field = {
        name: 'group_id',
        label: 'Group',
        field_type: 'group_select',
        options: ['Group A||ID-1', 'Group B||ID-2']
      };
      const html = render(field, '', 0);

      expect(html).toContain('data-hint="ID-1"');
      expect(html).toContain('data-hint="ID-2"');
    });

    it('escapes XSS in option values', () => {
      const field = {
        name: 'group_id',
        label: 'Group',
        field_type: 'group_select',
        options: ['<script>alert(1)</script>||ID-1', 'Group B||ID-2']
      };
      const html = render(field, '', 0);

      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('escapes XSS in option labels', () => {
      const field = {
        name: 'group_id',
        label: 'Group',
        field_type: 'group_select',
        options: ['Group A||<img src=x onerror=alert(1)>']
      };
      const html = render(field, '', 0);

      expect(html).toContain('&lt;img');
      expect(html).toContain('&gt;');
      expect(html).not.toContain('<img>');
    });

    it('escapes XSS in label', () => {
      const field = {
        name: '"><script>alert(1)</script>',
        label: '<script>alert(1)</script>',
        field_type: 'group_select',
        options: ['Group A||ID-1']
      };
      const html = render(field, '', 0);

      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('escapes XSS in field name', () => {
      const field = {
        name: '"><script>alert(1)</script>',
        label: 'Group',
        field_type: 'group_select',
        options: ['Group A||ID-1']
      };
      const html = render(field, '', 0);

      expect(html).toContain('&quot;');
      expect(html).toContain('&gt;');
      expect(html).toContain('&lt;');
      expect(html).not.toContain('"><script>');
    });

    it('escapes XSS in hint values', () => {
      const field = {
        name: 'group_id',
        label: 'Group',
        field_type: 'group_select',
        options: ['<script>alert(1)</script>||ID-1']
      };
      const html = render(field, 'ID-1', 0);

      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('escapes XSS in hint span content', () => {
      const field = {
        name: 'group_id',
        label: 'Group',
        field_type: 'group_select',
        options: ['<img src=x onerror=alert(1)>||ID-1']
      };
      const html = render(field, 'ID-1', 0);

      expect(html).toContain('&lt;img');
      expect(html).toContain('&gt;');
      expect(html).not.toContain('<img>');
    });

    it('includes required attribute when required is true', () => {
      const field = {
        name: 'group_id',
        label: 'Group',
        field_type: 'group_select',
        required: true,
        options: ['Group A||ID-1']
      };
      const html = render(field, '', 0);

      expect(html).toContain(' required');
    });

    it('omits required attribute when required is false', () => {
      const field = {
        name: 'group_id',
        label: 'Group',
        field_type: 'group_select',
        required: false,
        options: ['Group A||ID-1']
      };
      const html = render(field, '', 0);

      expect(html).not.toContain(' required');
    });
  });

  describe('getValue()', () => {
    it('returns element value', () => {
      const element = { value: 'ID-1' };
      expect(getValue(element)).toBe('ID-1');
    });

    it('returns empty string for empty value', () => {
      const element = { value: '' };
      expect(getValue(element)).toBe('');
    });
  });

  describe('validate()', () => {
    it('returns null (stub for Phase 6)', () => {
      const field = { name: 'test', field_type: 'group_select' };
      expect(validate(field, 'value')).toBeNull();
    });
  });
});
