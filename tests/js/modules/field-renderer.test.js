import { describe, it, expect } from 'vitest';
import { renderFields } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/field-renderer.js';

describe('Field Renderer', () => {
  const mockSchemas = {
    test_agent: [
      {
        name: 'prompt',
        label: 'Prompt',
        field_type: 'text',
        placeholder: 'Enter prompt',
        required: true,
      },
      {
        name: 'description',
        label: 'Description',
        field_type: 'textarea',
        placeholder: 'Enter description',
        required: false,
      },
      {
        name: 'model',
        label: 'Model',
        field_type: 'select',
        options: ['gpt-4', 'gpt-3.5-turbo'],
        required: true,
      },
      {
        name: 'enabled',
        label: 'Enabled',
        field_type: 'checkbox',
        required: false,
      },
      {
        name: 'tags',
        label: 'Tags',
        field_type: 'combobox',
        options: ['work', 'personal', 'urgent'],
        required: false,
      },
    ],
    group_agent: [
      {
        name: 'group',
        label: 'Group',
        field_type: 'group_select',
        options: ['Engineering||eng-123', 'Sales||sales-456'],
        required: true,
      },
    ],
    calendar_agent: [
      {
        name: 'calendar',
        label: 'Calendar',
        field_type: 'calendar_select',
        options: ['Primary||cal-123', 'Secondary||cal-456'],
        required: true,
      },
    ],
  };

  describe('renderFields()', () => {
    it('returns empty string when agentType is missing', () => {
      const html = renderFields(0, '', {}, mockSchemas, []);
      expect(html).toBe('');
    });

    it('returns empty string when agentType is null', () => {
      const html = renderFields(0, null, {}, mockSchemas, []);
      expect(html).toBe('');
    });

    it('returns empty string when agentType is undefined', () => {
      const html = renderFields(0, undefined, {}, mockSchemas, []);
      expect(html).toBe('');
    });

    it('returns empty string when schema for agentType does not exist', () => {
      const html = renderFields(0, 'unknown_agent', {}, mockSchemas, []);
      expect(html).toBe('');
    });

    it('renders all fields for a known agent type', () => {
      const config = {
        prompt: 'Hello world',
        description: 'A test',
        model: 'gpt-4',
        enabled: 'on',
        tags: 'work',
      };
      const html = renderFields(0, 'test_agent', config, mockSchemas, []);

      expect(html).toContain('name="prompt"');
      expect(html).toContain('name="description"');
      expect(html).toContain('name="model"');
      expect(html).toContain('name="enabled"');
      expect(html).toContain('name="tags"');
      expect(html).toContain('value="Hello world"');
      // Textarea uses content between tags, not value attribute
      expect(html).toContain('>A test</textarea>');
    });

    it('uses correct step index in field IDs', () => {
      const html = renderFields(5, 'test_agent', { prompt: 'test' }, mockSchemas, []);

      expect(html).toContain('id="field-5-prompt"');
      expect(html).toContain('id="field-5-description"');
      expect(html).toContain('dl-5-tags');
    });

    it('passes placeholder hints to textarea fields', () => {
      const hints = ['{previous_output}', '{pipeline_name}'];
      const html = renderFields(0, 'test_agent', {}, mockSchemas, hints);

      expect(html).toContain('Placeholders:');
      expect(html).toContain('<code>{previous_output}</code>');
      expect(html).toContain('<code>{pipeline_name}</code>');
    });

    it('renders text field with correct attributes', () => {
      const html = renderFields(0, 'test_agent', { prompt: 'test' }, mockSchemas, []);

      expect(html).toContain('<input type="text"');
      expect(html).toContain('name="prompt"');
      expect(html).toContain('id="field-0-prompt"');
      expect(html).toContain('placeholder="Enter prompt"');
      expect(html).toContain('required');
      expect(html).toContain('value="test"');
    });

    it('renders textarea field', () => {
      const html = renderFields(0, 'test_agent', { description: 'test desc' }, mockSchemas, []);

      expect(html).toContain('<textarea');
      expect(html).toContain('name="description"');
      expect(html).toContain('id="field-0-description"');
      expect(html).toContain('placeholder="Enter description"');
      expect(html).toContain('>test desc</textarea>');
    });

    it('renders select field with options', () => {
      const html = renderFields(0, 'test_agent', { model: 'gpt-4' }, mockSchemas, []);

      expect(html).toContain('<select');
      expect(html).toContain('name="model"');
      expect(html).toContain('id="field-0-model"');
      expect(html).toContain('<option value="gpt-4"');
      expect(html).toContain('<option value="gpt-3.5-turbo"');
    });

    it('renders checkbox field', () => {
      const html = renderFields(0, 'test_agent', { enabled: 'on' }, mockSchemas, []);

      expect(html).toContain('<input type="checkbox"');
      expect(html).toContain('name="enabled"');
      expect(html).toContain('id="field-0-enabled"');
      expect(html).toContain('checked');
      expect(html).toContain('value="on"');
    });

    it('renders combobox field with datalist', () => {
      const html = renderFields(0, 'test_agent', { tags: 'work' }, mockSchemas, []);

      expect(html).toContain('<input type="text"');
      expect(html).toContain('name="tags"');
      expect(html).toContain('list="dl-0-tags"');
      expect(html).toContain('<datalist id="dl-0-tags">');
      expect(html).toContain('<option value="work">');
      expect(html).toContain('<option value="personal">');
      expect(html).toContain('<option value="urgent">');
    });

    it('renders group_select field with hint', () => {
      const html = renderFields(0, 'group_agent', { group: 'eng-123' }, mockSchemas, []);

      expect(html).toContain('<select');
      expect(html).toContain('name="group"');
      expect(html).toContain('id="field-0-group"');
      expect(html).toContain('data-hint="eng-123"');
      expect(html).toContain('id="hint-0-group"');
      expect(html).toContain('>eng-123</span>');
    });

    it('renders calendar_select field with hint', () => {
      const html = renderFields(0, 'calendar_agent', { calendar: 'Primary' }, mockSchemas, []);

      expect(html).toContain('<select');
      expect(html).toContain('name="calendar"');
      expect(html).toContain('id="field-0-calendar"');
      expect(html).toContain('data-calid="cal-123"');
      expect(html).toContain('id="hint-0-calendar"');
      expect(html).toContain('>cal-123</span>');
    });

    it('handles empty config object', () => {
      const html = renderFields(0, 'test_agent', {}, mockSchemas, []);

      expect(html).toContain('name="prompt"');
      expect(html).toContain('value=""');
    });

    it('handles config with missing field values', () => {
      const config = { prompt: 'only one value' };
      const html = renderFields(0, 'test_agent', config, mockSchemas, []);

      expect(html).toContain('value="only one value"');
      // Other fields should have empty values
      expect(html).toContain('value=""');
    });

    it('handles config with null values', () => {
      const config = { prompt: null, description: undefined, model: 'gpt-4' };
      const html = renderFields(0, 'test_agent', config, mockSchemas, []);

      expect(html).toContain('value=""');
      expect(html).toContain('gpt-4"');
    });

    it('includes required attribute for required fields', () => {
      const html = renderFields(0, 'test_agent', {}, mockSchemas, []);

      // prompt is required
      expect(html).toContain('name="prompt"');
      const promptSection = html.split('name="prompt"')[1].split('</label>')[0];
      expect(promptSection).toContain('required');

      // description is not required
      const descSection = html.split('name="description"')[1].split('</label>')[0];
      expect(descSection).not.toContain('required');
    });

    it('escapes XSS in config values', () => {
      const config = {
        prompt: '<script>alert("xss")</script>',
      };
      const html = renderFields(0, 'test_agent', config, mockSchemas, []);

      expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(html).not.toContain('<script>alert');
    });
  });
});
