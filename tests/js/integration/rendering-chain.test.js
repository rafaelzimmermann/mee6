import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderPipeline } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/pipeline-renderer.js';

describe('Rendering Chain Integration', () => {
  const schema = {
    llm_agent: [
      { name: 'prompt', label: 'Prompt', field_type: 'textarea', required: true, placeholder: 'Enter prompt' },
      { name: 'model', label: 'Model', field_type: 'select', required: true, options: ['gpt-4', 'gpt-3.5'] },
    ],
    memory_agent: [
      { name: 'read_memory', label: 'Read Memory', field_type: 'checkbox', required: false },
      { name: 'write_memory', label: 'Write Memory', field_type: 'checkbox', required: false },
    ],
  };

  const agentList = [
    { value: 'llm_agent', label: 'LLM Agent' },
    { value: 'memory_agent', label: 'Memory Agent' },
  ];

  describe('full rendering chain', () => {
    it('pipeline with one llm_agent step renders a card containing a textarea and a select', () => {
      const steps = [
        { agent_type: 'llm_agent', config: { prompt: 'Hello world', model: 'gpt-4' } },
      ];

      const html = renderPipeline(steps, agentList, schema, []);

      expect(html).toContain('<textarea');
      expect(html).toContain('name="prompt"');
      expect(html).toContain('<select');
      expect(html).toContain('name="model"');
      expect(html).toContain('>Hello world</textarea>');
    });

    it('pipeline with one memory_agent step renders a card containing two checkboxes', () => {
      const steps = [
        { agent_type: 'memory_agent', config: { read_memory: 'on', write_memory: '' } },
      ];

      const html = renderPipeline(steps, agentList, schema, []);

      expect(html).toContain('type="checkbox"');
      expect(html).toContain('name="read_memory"');
      expect(html).toContain('name="write_memory"');
      expect(html).toContain('checked');
    });

    it('pipeline with two steps renders two cards with data-idx 0 and 1', () => {
      const steps = [
        { agent_type: 'llm_agent', config: {} },
        { agent_type: 'memory_agent', config: {} },
      ];

      const html = renderPipeline(steps, agentList, schema, []);

      expect(html).toContain('id="step-fields-0"');
      expect(html).toContain('id="step-fields-1"');
    });

    it('textarea in step 0 has id field-0-prompt', () => {
      const steps = [
        { agent_type: 'llm_agent', config: { prompt: 'test' } },
      ];

      const html = renderPipeline(steps, agentList, schema, []);

      expect(html).toContain('id="field-0-prompt"');
    });

    it('select in step 0 has correct pre-selected option from config', () => {
      const steps = [
        { agent_type: 'llm_agent', config: { model: 'gpt-4' } },
      ];

      const html = renderPipeline(steps, agentList, schema, []);

      expect(html).toContain('value="gpt-4"');
      expect(html).toContain('selected');
    });

    it('step with no agent_type renders agent selector with no pre-selection', () => {
      const steps = [
        { agent_type: '', config: {} },
      ];

      const html = renderPipeline(steps, agentList, schema, []);

      expect(html).toContain('<select class="agent-select">');
      expect(html).toContain('value="">— select agent —</option>');
    });

    it('full HTML is parseable - no unclosed tags', () => {
      const steps = [
        { agent_type: 'llm_agent', config: { prompt: 'test', model: 'gpt-4' } },
        { agent_type: 'memory_agent', config: { read_memory: 'on', write_memory: 'on' } },
      ];

      const html = renderPipeline(steps, agentList, schema, []);

      // Should not throw - valid HTML structure
      const dom = new JSDOM(html);
      expect(dom.window.document.querySelectorAll('[data-idx]').length).toBe(2);
      // Check that we can find step-fields elements
      const stepFields = dom.window.document.querySelectorAll('[id^="step-fields-"]');
      expect(stepFields.length).toBe(2);
    });

    it('XSS: config value with script tags does not appear unescaped', () => {
      const steps = [
        { agent_type: 'llm_agent', config: { prompt: '"><script>alert(1)</script>' } },
      ];

      const html = renderPipeline(steps, agentList, schema, []);

      expect(html).not.toContain('"><script>');
      expect(html).toContain('&quot;&gt;&lt;script&gt;');
    });

    it('XSS: agent label with script tags is escaped', () => {
      const xssAgentList = [
        { value: 'test', label: '<script>alert(1)</script>' },
      ];

      const steps = [
        { agent_type: 'test', config: {} },
      ];

      const html = renderPipeline(steps, xssAgentList, { test: [] }, []);

      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('XSS: field label is escaped', () => {
      const xssSchema = {
        test: [
          { name: 'xss', label: '<img src=x onerror=alert(1)>', field_type: 'text', required: true },
        ],
      };

      const steps = [
        { agent_type: 'test', config: { xss: 'value' } },
      ];

      const html = renderPipeline(steps, [{ value: 'test', label: 'Test' }], xssSchema, []);

      expect(html).not.toContain('<img src=x onerror=alert(1)>');
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });
  });
});
