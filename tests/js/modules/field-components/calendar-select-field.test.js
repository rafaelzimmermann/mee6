import { describe, it, expect } from 'vitest';
import { render, getValue, validate } from '../../../../mee6/web/static/js/modules/field-components/calendar-select-field.js';

describe('CalendarSelectField Component', () => {
  describe('render()', () => {
    it('renders select with correct attributes', () => {
      const field = {
        name: 'calendar_id',
        label: 'Calendar',
        field_type: 'calendar_select',
        options: ['Calendar A', 'Calendar B||ID-2', 'Calendar C||ID-3']
      };
      const html = render(field, 'ID-2', 0);

      expect(html).toContain('<select');
      expect(html).toContain('name="calendar_id"');
      expect(html).toContain('id="field-0-calendar_id"');
      expect(html).toContain('</select>');
      expect(html).toContain('<label class="field-label">');
    });

    it('renders error span with correct id', () => {
      const field = { name: 'calendar_id', label: 'Calendar', field_type: 'calendar_select', required: true, options: ['Calendar A'] };
      const html = render(field, 'Calendar A', 0);
      expect(html).toContain('id="error-0-calendar_id"');
      expect(html).toContain('class="field-error-message"');
    });

    it('renders empty option first', () => {
      const field = {
        name: 'calendar_id',
        label: 'Calendar',
        field_type: 'calendar_select',
        options: ['Calendar A||ID-1']
      };
      const html = render(field, '', 0);

      expect(html).toContain('<option value="">— select calendar —</option>');
    });

    it('correctly parses "||" format', () => {
      const field = {
        name: 'calendar_id',
        label: 'Calendar',
        field_type: 'calendar_select',
        options: ['Calendar A||ID-1', 'Calendar B||ID-2', 'Calendar C']
      };
      const html = render(field, 'ID-2', 0);

      // Calendar A||ID-1 -> display "Calendar A", value "Calendar A"
      expect(html).toContain('value="Calendar A"');
      expect(html).toContain('>Calendar A</option>');
      // Calendar B||ID-2 -> display "Calendar B", value "Calendar A", hint "ID-2"
      expect(html).toContain('value="Calendar B"');
      expect(html).toContain('>Calendar B</option>');
      expect(html).toContain('data-calid="ID-2"');
      // Calendar C (no ||) -> display "Calendar C", value "Calendar C", hint ""
      expect(html).toContain('value="Calendar C"');
      expect(html).toContain('>Calendar C</option>');
    });

    it('correctly pre-selects option by value', () => {
      const field = {
        name: 'calendar_id',
        label: 'Calendar',
        field_type: 'calendar_select',
        options: ['Calendar A||ID-1', 'Calendar B||ID-2', 'Calendar C||ID-3']
      };
      const html = render(field, 'ID-2', 0);

      expect(html).toContain('value="Calendar B"');
      expect(html).toContain('>Calendar B</option>');
    });

    it('populates hint span with initial value', () => {
      const field = {
        name: 'calendar_id',
        label: 'Calendar',
        field_type: 'calendar_select',
        options: ['Calendar A||ID-1', 'Calendar B||ID-2']
      };
      const html = render(field, 'Calendar A', 0);

      expect(html).toContain('id="calid-hint-0-calendar_id"');
      expect(html).toContain('>');
    });

    it('generates correct hint span id', () => {
      const field = {
        name: 'calendar_id',
        label: 'Calendar',
        field_type: 'calendar_select',
        options: ['Calendar A||ID-1']
      };
      const html0 = render(field, '', 0);
      const html1 = render(field, '', 1);
      const html5 = render(field, '', 5);

      expect(html0).toContain('id="calid-hint-0-calendar_id"');
      expect(html1).toContain('id="calid-hint-1-calendar_id"');
      expect(html5).toContain('id="calid-hint-5-calendar_id"');
    });

    it('includes onchange handler', () => {
      const field = {
        name: 'calendar_id',
        label: 'Calendar',
        field_type: 'calendar_select',
        options: ['Calendar A||ID-1']
      };
      const html = render(field, '', 0);

      expect(html).toContain('onchange=');
      expect(html).toContain('calid-hint-0-calendar_id');
    });

    it('includes data-calid attribute on options', () => {
      const field = {
        name: 'calendar_id',
        label: 'Calendar',
        field_type: 'calendar_select',
        options: ['Calendar A||ID-1', 'Calendar B||ID-2']
      };
      const html = render(field, '', 0);

      expect(html).toContain('data-calid="ID-1"');
      expect(html).toContain('data-calid="ID-2"');
    });

    it('escapes XSS in option values', () => {
      const field = {
        name: 'calendar_id',
        label: 'Calendar',
        field_type: 'calendar_select',
        options: ['<script>alert(1)</script>||ID-1', 'Calendar B||ID-2']
      };
      const html = render(field, '', 0);

      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('escapes XSS in option labels', () => {
      const field = {
        name: 'calendar_id',
        label: 'Calendar',
        field_type: 'calendar_select',
        options: ['Calendar A||<img src=x onerror=alert(1)>']
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
        field_type: 'calendar_select',
        options: ['Calendar A||ID-1']
      };
      const html = render(field, '', 0);

      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('escapes XSS in field name', () => {
      const field = {
        name: '"><script>alert(1)</script>',
        label: 'Calendar',
        field_type: 'calendar_select',
        options: ['Calendar A||ID-1']
      };
      const html = render(field, '', 0);

      expect(html).toContain('&quot;');
      expect(html).toContain('&gt;');
      expect(html).toContain('&lt;');
      expect(html).not.toContain('"><script>');
    });

    it('escapes XSS in hint values', () => {
      const field = {
        name: 'calendar_id',
        label: 'Calendar',
        field_type: 'calendar_select',
        options: ['<script>alert(1)</script>||ID-1']
      };
      const html = render(field, 'ID-1', 0);

      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('escapes XSS in hint span content', () => {
      const field = {
        name: 'calendar_id',
        label: 'Calendar',
        field_type: 'calendar_select',
        options: ['<img src=x onerror=alert(1)>||ID-1']
      };
      const html = render(field, 'ID-1', 0);

      expect(html).toContain('&lt;img');
      expect(html).toContain('&gt;');
      expect(html).not.toContain('<img>');
    });

    it('includes required attribute when required is true', () => {
      const field = {
        name: 'calendar_id',
        label: 'Calendar',
        field_type: 'calendar_select',
        required: true,
        options: ['Calendar A||ID-1']
      };
      const html = render(field, '', 0);

      expect(html).toContain(' required');
    });

    it('omits required attribute when required is false', () => {
      const field = {
        name: 'calendar_id',
        label: 'Calendar',
        field_type: 'calendar_select',
        required: false,
        options: ['Calendar A||ID-1']
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
      const field = { name: 'test', field_type: 'calendar_select' };
      expect(validate(field, 'value')).toBeNull();
    });
  });
});
