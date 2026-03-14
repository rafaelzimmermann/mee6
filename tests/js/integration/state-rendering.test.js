import { describe, it, expect } from 'vitest';
import { PipelineEditorState } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/state-manager.js';
import { renderPipeline } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/pipeline-renderer.js';

describe('State + Rendering Integration', () => {
  const mockAgentList = [
    { name: 'llm_agent', label: 'LLM Agent' },
    { name: 'memory_agent', label: 'Memory Agent' },
  ];

  const mockSchemas = {
    llm_agent: [
      { name: 'prompt', label: 'Prompt', field_type: 'textarea', required: true, placeholder: 'Enter prompt' },
      { name: 'model', label: 'Model', field_type: 'select', required: true, options: ['gpt-4', 'gpt-3.5'] },
    ],
    memory_agent: [
      { name: 'read_memory', label: 'Read Memory', field_type: 'checkbox', required: false },
      { name: 'write_memory', label: 'Write Memory', field_type: 'checkbox', required: false },
    ],
  };

  const mockPlaceholderHints = ['{previous_output}', '{pipeline_name}'];

  // Helper: render current state
  function renderCurrentState(state) {
    return renderPipeline(
      state.getSteps(),
      state.agentList,
      state.schemas,
      state.placeholderHints
    );
  }

  describe('initial state', () => {
    it('renders empty when no steps', () => {
      const state = new PipelineEditorState();
      state.initialize({
        id: null,
        name: '',
        steps: [],
        agentList: mockAgentList,
        schemas: mockSchemas,
        placeholderHints: mockPlaceholderHints,
      });

      const html = renderCurrentState(state);

      expect(html).toBe('');
    });
  });

  describe('addStep()', () => {
    it('after addStep(), rendered output contains one card', () => {
      const state = new PipelineEditorState();
      state.initialize({
        id: null,
        name: 'Test',
        steps: [],
        agentList: mockAgentList,
        schemas: mockSchemas,
        placeholderHints: mockPlaceholderHints,
      });

      state.addStep();
      const html = renderCurrentState(state);

      expect(html).toContain('Step 1</strong>');
      expect(html).toContain('LLM Agent</option>');
    });

    it('after addStep() twice, rendered output contains two cards', () => {
      const state = new PipelineEditorState();
      state.initialize({
        id: null,
        name: 'Test',
        steps: [],
        agentList: mockAgentList,
        schemas: mockSchemas,
        placeholderHints: mockPlaceholderHints,
      });

      state.addStep();
      state.addStep();
      const html = renderCurrentState(state);

      expect(html).toContain('Step 1</strong>');
      expect(html).toContain('Step 2</strong>');
    });
  });

  describe('setStepAgentType()', () => {
    it('after setStepAgentType(0, llm_agent), rendered output contains agent fields', () => {
      const state = new PipelineEditorState();
      state.initialize({
        id: null,
        name: 'Test',
        steps: [{ agent_type: '', config: {} }],
        agentList: mockAgentList,
        schemas: mockSchemas,
        placeholderHints: mockPlaceholderHints,
      });

      state.setStepAgentType(0, 'llm_agent');
      const html = renderCurrentState(state);

      expect(html).toContain('name="prompt"');
      expect(html).toContain('name="model"');
    });

    it('after setStepAgentType then setStepAgentType to different type, fields change correctly', () => {
      const state = new PipelineEditorState();
      state.initialize({
        id: null,
        name: 'Test',
        steps: [{ agent_type: '', config: {} }],
        agentList: mockAgentList,
        schemas: mockSchemas,
        placeholderHints: mockPlaceholderHints,
      });

      state.setStepAgentType(0, 'llm_agent');
      state.setStepAgentType(0, 'memory_agent');
      const html = renderCurrentState(state);

      expect(html).toContain('name="read_memory"');
      expect(html).toContain('name="write_memory"');
      expect(html).not.toContain('name="prompt"');
    });

    it('Config reset: after setStepAgentType(0, llm_agent) then setStepAgentType(0, memory_agent), llm_agent field values do NOT appear in re-rendered output', () => {
      const state = new PipelineEditorState();
      state.initialize({
        id: null,
        name: 'Test',
        steps: [{ agent_type: '', config: { prompt: 'old value' } }],
        agentList: mockAgentList,
        schemas: mockSchemas,
        placeholderHints: mockPlaceholderHints,
      });

      state.setStepAgentType(0, 'llm_agent');
      state.updateStepField(0, 'prompt', 'new value');
      state.setStepAgentType(0, 'memory_agent');
      const html = renderCurrentState(state);

      expect(html).not.toContain('new value');
      expect(html).not.toContain('>new value</textarea>');
    });
  });

  describe('updateStepField()', () => {
    it('after updateStepField(0, prompt, Hello), rendered textarea contains Hello', () => {
      const state = new PipelineEditorState();
      state.initialize({
        id: null,
        name: 'Test',
        steps: [{ agent_type: 'llm_agent', config: {} }],
        agentList: mockAgentList,
        schemas: mockSchemas,
        placeholderHints: mockPlaceholderHints,
      });

      state.setStepAgentType(0, 'llm_agent');
      state.updateStepField(0, 'prompt', 'Hello');
      const html = renderCurrentState(state);

      expect(html).toContain('>Hello</textarea>');
    });
  });

  describe('removeStep()', () => {
    it('after removeStep(0) on two steps, only one card remains', () => {
      const state = new PipelineEditorState();
      state.initialize({
        id: null,
        name: 'Test',
        steps: [
          { agent_type: 'llm_agent', config: {} },
          { agent_type: 'memory_agent', config: {} },
        ],
        agentList: mockAgentList,
        schemas: mockSchemas,
        placeholderHints: mockPlaceholderHints,
      });

      state.removeStep(0);
      const html = renderCurrentState(state);

      expect(html).toContain('Step 1</strong>');
      expect(html).not.toContain('Step 2</strong>');
    });
  });

  describe('moveStepUp()', () => {
    it('after moveStepUp(1), cards appear in swapped order', () => {
      const state = new PipelineEditorState();
      state.initialize({
        id: null,
        name: 'Test',
        steps: [
          { agent_type: 'llm_agent', config: {} },
          { agent_type: 'memory_agent', config: {} },
        ],
        agentList: mockAgentList,
        schemas: mockSchemas,
        placeholderHints: mockPlaceholderHints,
      });

      state.moveStepUp(1);
      const html = renderCurrentState(state);

      const firstIdx = html.indexOf('data-idx="0"');
      const memoryAgentIdx = html.indexOf('Memory Agent</option>');
      expect(firstIdx).toBeLessThan(memoryAgentIdx);
    });
  });
});
