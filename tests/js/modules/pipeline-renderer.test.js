import { describe, it, expect } from 'vitest';
import { renderPipeline, renderStep } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/pipeline-renderer.js';

describe('Pipeline Renderer', () => {
  const mockAgentList = [
    { name: 'llm_agent', label: 'LLM Agent' },
    { name: 'memory_agent', label: 'Memory Agent' },
  ];

  const mockSchema = {
    llm_agent: [
      { name: 'prompt', label: 'Prompt', field_type: 'textarea', required: true },
      { name: 'model', label: 'Model', field_type: 'select', options: ['gpt-4', 'gpt-3.5'], required: true },
    ],
    memory_agent: [
      { name: 'read_memory', label: 'Read Memory', field_type: 'checkbox', required: false },
      { name: 'write_memory', label: 'Write Memory', field_type: 'checkbox', required: false },
    ],
  };

  describe('renderPipeline()', () => {
    it('returns empty string when steps array is empty', () => {
      const html = renderPipeline([], mockAgentList, mockSchema, []);
      expect(html).toBe('');
    });

    it('renders three steps with correct data-idx values', () => {
      const steps = [
        { agent_type: 'llm_agent', config: { prompt: 'test1', model: 'gpt-4' } },
        { agent_type: 'memory_agent', config: { read_memory: 'on' } },
        { agent_type: '', config: {} },
      ];

      const html = renderPipeline(steps, mockAgentList, mockSchema, []);

      expect(html).toContain('id="step-fields-0"');
      expect(html).toContain('id="step-fields-1"');
      expect(html).toContain('id="step-fields-2"');
    });

    it('passes correct index to each step', () => {
      const steps = [
        { agent_type: 'llm_agent', config: {} },
        { agent_type: 'memory_agent', config: {} },
        { agent_type: '', config: {} },
      ];

      const html = renderPipeline(steps, mockAgentList, mockSchema, []);

      expect(html).toContain('>Step 1</strong>');
      expect(html).toContain('>Step 2</strong>');
      expect(html).toContain('>Step 3</strong>');
    });

    it('renders fields for steps with agent_type', () => {
      const steps = [
        { agent_type: 'llm_agent', config: { prompt: 'hello' } },
      ];

      const html = renderPipeline(steps, mockAgentList, mockSchema, []);

      expect(html).toContain('name="prompt"');
      expect(html).toContain('>hello</textarea>');
    });

    it('does not render fields for steps without agent_type', () => {
      const steps = [
        { agent_type: '', config: {} },
      ];

      const html = renderPipeline(steps, mockAgentList, mockSchema, []);

      expect(html).toContain('id="step-fields-0"');
      expect(html).toContain('step-fields-0"></div>');
    });

    it('renders step with agent_type not in schema (uses fallback empty array)', () => {
      const steps = [
        { agent_type: 'unknown_agent', config: {} },
      ];

      const html = renderPipeline(steps, mockAgentList, mockSchema, []);

      expect(html).toContain('id="step-fields-0"');
      expect(html).toContain('step-fields-0"></div>');
    });
  });

  describe('renderStep()', () => {
    it('renders HTML for a single step at correct index', () => {
      const step = { agent_type: 'llm_agent', config: { prompt: 'test' } };
      const html = renderStep(step, 5, mockAgentList, mockSchema, []);

      expect(html).toContain('id="step-fields-5"');
      expect(html).toContain('>Step 6</strong>');
    });

    it('delegates to renderStepCard correctly', () => {
      const step = { agent_type: 'memory_agent', config: { read_memory: 'on' } };
      const html = renderStep(step, 0, mockAgentList, mockSchema, []);

      expect(html).toContain('<div class="step-header">');
      expect(html).toContain('<select class="agent-select">');
      expect(html).toContain('name="read_memory"');
    });
  });
});
