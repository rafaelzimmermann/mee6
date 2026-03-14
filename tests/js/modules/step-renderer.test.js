import { describe, it, expect } from 'vitest';
import { renderStepCard, renderStepFields, renderAgentSelector } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/step-renderer.js';

describe('Step Renderer', () => {
  const mockAgentList = [
    { name: 'llm_agent', label: 'LLM Agent' },
    { name: 'memory_agent', label: 'Memory Agent' },
    { name: 'browser_agent', label: 'Browser Agent' },
  ];

  const mockFields = [
    { name: 'prompt', label: 'Prompt', field_type: 'textarea', required: true, placeholder: 'Enter prompt' },
    { name: 'model', label: 'Model', field_type: 'select', required: true, options: ['gpt-4', 'gpt-3.5'] },
  ];

  const mockSchema = {
    llm_agent: mockFields,
    memory_agent: [],
  };

  describe('renderStepCard()', () => {
    it('renders step with correct data-idx value', () => {
      const html = renderStepCard(
        { agent_type: 'llm_agent', config: {} },
        0,
        mockAgentList,
        mockFields,
        [],
        mockSchema
      );

      // Note: data-idx is on wrapper div, which is set by caller, not rendered here
      // But we verify the fields container has correct index
      expect(html).toContain('id="step-fields-0"');
    });

    it('renders agent selector with correct pre-selection', () => {
      const html = renderStepCard(
        { agent_type: 'llm_agent', config: {} },
        0,
        mockAgentList,
        mockFields,
        [],
        mockSchema
      );

      expect(html).toContain('<select class="agent-select">');
      expect(html).toContain('value="llm_agent"');
      expect(html).toContain('selected');
      expect(html).toContain('>LLM Agent</option>');
    });

    it('renders step with empty agent type (no fields)', () => {
      const html = renderStepCard(
        { agent_type: '', config: {} },
        0,
        mockAgentList,
        [],
        [],
        mockSchema
      );

      expect(html).toContain('<select class="agent-select">');
      expect(html).toContain('id="step-fields-0"');
      // Fields container should be empty
      expect(html).toContain('step-fields-0"></div>');
    });

    it('renders step with fields when agent type is selected', () => {
      const html = renderStepCard(
        { agent_type: 'llm_agent', config: { prompt: 'Hello', model: 'gpt-4' } },
        0,
        mockAgentList,
        mockFields,
        [],
        mockSchema
      );

      expect(html).toContain('id="step-fields-0"');
      expect(html).toContain('name="prompt"');
      expect(html).toContain('name="model"');
      expect(html).toContain('>Hello</textarea>');
      expect(html).toContain('>gpt-4</option>');
    });

    it('contains move-up and move-down buttons with correct classes', () => {
      const html = renderStepCard(
        { agent_type: 'llm_agent', config: {} },
        5,
        mockAgentList,
        mockFields,
        [],
        mockSchema
      );

      expect(html).toContain('class="step-move-buttons"');
      expect(html).toContain('onclick="moveStepUp(5)"');
      expect(html).toContain('onclick="moveStepDown(5)"');
      expect(html).toContain('class="sm"');
      expect(html).toContain('title="Move up"');
      expect(html).toContain('title="Move down"');
    });

    it('contains remove button with correct classes', () => {
      const html = renderStepCard(
        { agent_type: 'llm_agent', config: {} },
        0,
        mockAgentList,
        mockFields,
        [],
        mockSchema
      );

      expect(html).toContain('class="sm danger remove-step"');
      expect(html).toContain('Remove</button>');
    });

    it('displays correct step number', () => {
      const html0 = renderStepCard({ agent_type: '', config: {} }, 0, mockAgentList, [], [], {});
      const html1 = renderStepCard({ agent_type: '', config: {} }, 1, mockAgentList, [], [], {});
      const html5 = renderStepCard({ agent_type: '', config: {} }, 5, mockAgentList, [], [], {});

      expect(html0).toContain('>Step 1</strong>');
      expect(html1).toContain('>Step 2</strong>');
      expect(html5).toContain('>Step 6</strong>');
    });

    it('has correct step-header class', () => {
      const html = renderStepCard(
        { agent_type: '', config: {} },
        0,
        mockAgentList,
        [],
        [],
        {}
      );

      expect(html).toContain('<div class="step-header">');
    });

    it('escapes XSS in agent labels', () => {
      const xssAgentList = [
        { name: 'test', label: '<script>alert(1)</script>' },
      ];
      const html = renderStepCard(
        { agent_type: 'test', config: {} },
        0,
        xssAgentList,
        [],
        [],
        {}
      );

      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('escapes XSS in config values', () => {
      const html = renderStepCard(
        { agent_type: 'llm_agent', config: { prompt: '"><script>alert(1)</script>' } },
        0,
        mockAgentList,
        mockFields,
        [],
        mockSchema
      );

      expect(html).not.toContain('"><script>');
      expect(html).toContain('&quot;&gt;&lt;script&gt;');
    });
  });

  describe('renderStepFields()', () => {
    it('renders fields via field-renderer', () => {
      const html = renderStepFields(
        mockFields,
        { prompt: 'test', model: 'gpt-4' },
        0,
        [],
        mockSchema
      );

      expect(html).toContain('name="prompt"');
      expect(html).toContain('name="model"');
      expect(html).toContain('>test</textarea>');
      expect(html).toContain('>gpt-4</option>');
    });

    it('returns empty string when no fields provided', () => {
      const html = renderStepFields([], {}, 0, [], {});
      expect(html).toBe('');
    });
  });

  describe('renderAgentSelector()', () => {
    it('renders all agents from agentList', () => {
      const html = renderAgentSelector({ agent_type: 'llm_agent' }, 0, mockAgentList);

      expect(html).toContain('>LLM Agent</option>');
      expect(html).toContain('>Memory Agent</option>');
      expect(html).toContain('>Browser Agent</option>');
    });

    it('pre-selects correct option', () => {
      const html = renderAgentSelector({ agent_type: 'memory_agent' }, 0, mockAgentList);

      expect(html).toContain('value="memory_agent" selected');
      expect(html).toContain('>Memory Agent</option>');
    });

    it('shows placeholder when no agent type selected', () => {
      const html = renderAgentSelector({ agent_type: '' }, 0, mockAgentList);

      expect(html).toContain('value="">— select agent —</option>');
    });

    it('has correct agent-select class', () => {
      const html = renderAgentSelector({ agent_type: '' }, 0, mockAgentList);

      expect(html).toContain('<select class="agent-select">');
    });
  });
});
