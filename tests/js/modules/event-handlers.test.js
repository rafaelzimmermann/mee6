import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipelineEditorState } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/state-manager.js';
import * as handlers from '/home/spike/workspace/mee6/mee6/web/static/js/modules/event-handlers.js';

function makeState(overrides = {}) {
  const state = new PipelineEditorState();
  state.initialize({
    id: overrides.id ?? null,
    name: overrides.name ?? 'Test',
    steps: overrides.steps ?? [],
    agentList: overrides.agentList ?? [
      { name: 'llm_agent', label: 'LLM Agent' },
      { name: 'memory_agent', label: 'Memory Agent' }
    ],
    schemas: overrides.schemas ?? {
      llm_agent: [
        { name: 'prompt', label: 'Prompt', field_type: 'textarea', required: true }
      ],
      memory_agent: [
        { name: 'read_memory', label: 'Read Memory', field_type: 'checkbox' },
        { name: 'write_memory', label: 'Write Memory', field_type: 'checkbox' }
      ]
    },
    placeholderHints: overrides.placeholderHints ?? ['{previous_output}', '{pipeline_name}']
  });
  return state;
}

const mockApiClient = {
  createPipeline: vi.fn().mockResolvedValue({ id: 'new-id', name: 'Test', steps: [] }),
  updatePipeline: vi.fn().mockResolvedValue({ id: 'existing-id', name: 'Test', steps: [] }),
  fetchSchemas: vi.fn().mockResolvedValue({})
};

describe('event-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleAddStep', () => {
    it('adds one step to state', () => {
      const state = makeState();
      handlers.handleAddStep(state);
      expect(state.getSteps().length).toBe(1);
    });

    it('the added step has empty agent_type and config', () => {
      const state = makeState();
      handlers.handleAddStep(state);
      const step = state.getStep(0);
      expect(step.agent_type).toBe('');
      expect(step.config).toEqual({});
    });

    it('calling it three times results in three steps', () => {
      const state = makeState();
      handlers.handleAddStep(state);
      handlers.handleAddStep(state);
      handlers.handleAddStep(state);
      expect(state.getSteps().length).toBe(3);
    });
  });

  describe('handleRemoveStep', () => {
    it('removes the correct step by index', () => {
      const state = makeState();
      state.addStep();
      state.addStep();
      state.addStep();
      handlers.handleRemoveStep(state, 1);
      expect(state.getSteps().length).toBe(2);
      expect(state.getStep(0).agent_type).toBe('');
      expect(state.getStep(1).agent_type).toBe('');
    });

    it('state has one fewer step after call', () => {
      const state = makeState();
      state.addStep();
      state.addStep();
      const initialCount = state.getSteps().length;
      handlers.handleRemoveStep(state, 0);
      expect(state.getSteps().length).toBe(initialCount - 1);
    });

    it('removing index 0 from two steps leaves the correct remaining step', () => {
      const state = makeState();
      state.addStep();
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.updateStepField(0, 'prompt', 'first');
      state.setStepAgentType(1, 'memory_agent');
      state.updateStepField(1, 'read_memory', 'on');

      handlers.handleRemoveStep(state, 0);

      expect(state.getSteps().length).toBe(1);
      expect(state.getStep(0).agent_type).toBe('memory_agent');
      expect(state.getStep(0).config.read_memory).toBe('on');
    });
  });

  describe('handleMoveUp', () => {
    it('swaps step at index with step at index-1', () => {
      const state = makeState();
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.addStep();
      state.setStepAgentType(1, 'memory_agent');

      handlers.handleMoveUp(state, 1);

      expect(state.getStep(0).agent_type).toBe('memory_agent');
      expect(state.getStep(1).agent_type).toBe('llm_agent');
    });

    it('calling on index 0 is a no-op (no error)', () => {
      const state = makeState();
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.addStep();
      state.setStepAgentType(1, 'memory_agent');

      handlers.handleMoveUp(state, 0);

      expect(state.getStep(0).agent_type).toBe('llm_agent');
      expect(state.getStep(1).agent_type).toBe('memory_agent');
    });
  });

  describe('handleMoveDown', () => {
    it('swaps step at index with step at index+1', () => {
      const state = makeState();
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.addStep();
      state.setStepAgentType(1, 'memory_agent');

      handlers.handleMoveDown(state, 0);

      expect(state.getStep(0).agent_type).toBe('memory_agent');
      expect(state.getStep(1).agent_type).toBe('llm_agent');
    });

    it('calling on last index is a no-op (no error)', () => {
      const state = makeState();
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.addStep();
      state.setStepAgentType(1, 'memory_agent');

      handlers.handleMoveDown(state, 1);

      expect(state.getStep(0).agent_type).toBe('llm_agent');
      expect(state.getStep(1).agent_type).toBe('memory_agent');
    });
  });

  describe('handleAgentTypeChange', () => {
    it('updates the agent_type in state', async () => {
      const state = makeState();
      state.addStep();
      await handlers.handleAgentTypeChange(state, mockApiClient, 0, 'llm_agent');
      expect(state.getStep(0).agent_type).toBe('llm_agent');
    });

    it('resets config to {} (verify via state.getStep)', async () => {
      const state = makeState();
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.updateStepField(0, 'prompt', 'old value');
      expect(state.getStep(0).config.prompt).toBe('old value');

      await handlers.handleAgentTypeChange(state, mockApiClient, 0, 'memory_agent');
      expect(state.getStep(0).config.prompt).toBeUndefined();
      expect(state.getStep(0).config).toEqual({});
    });

    it('fetches schema when not cached', async () => {
      const state = makeState({ schemas: {} });
      state.addStep();
      await handlers.handleAgentTypeChange(state, mockApiClient, 0, 'llm_agent');
      expect(mockApiClient.fetchSchemas).toHaveBeenCalledOnce();
    });

    it('does NOT fetch schema when already cached', async () => {
      const state = makeState();
      state.addStep();
      await handlers.handleAgentTypeChange(state, mockApiClient, 0, 'llm_agent');
      expect(mockApiClient.fetchSchemas).not.toHaveBeenCalled();
    });

    it('is async — returns a Promise', () => {
      const state = makeState();
      state.addStep();
      const result = handlers.handleAgentTypeChange(state, mockApiClient, 0, 'llm_agent');
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('handleAgentTypeChange — schema caching', () => {
    it('does NOT fetch when schema already fetched with empty array', async () => {
      const state = makeState({ schemas: { llm_agent: [] } });
      state.addStep();
      await handlers.handleAgentTypeChange(state, mockApiClient, 0, 'llm_agent');
      expect(mockApiClient.fetchSchemas).not.toHaveBeenCalled();
    });

    it('fetches once and caches for subsequent calls with same agent type', async () => {
      const apiWithResult = {
        fetchSchemas: vi.fn().mockResolvedValue({ llm_agent: [] })
      };
      const state = makeState({ schemas: {} });
      state.addStep();
      state.addStep();
      await handlers.handleAgentTypeChange(state, apiWithResult, 0, 'llm_agent');
      await handlers.handleAgentTypeChange(state, apiWithResult, 1, 'llm_agent');
      expect(apiWithResult.fetchSchemas).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleFieldChange', () => {
    it('updates the correct field in the correct step\'s config', () => {
      const state = makeState();
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');

      handlers.handleFieldChange(state, 0, 'prompt', 'Hello world');

      expect(state.getStep(0).config.prompt).toBe('Hello world');
    });

    it('does not affect other steps', () => {
      const state = makeState();
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.updateStepField(0, 'prompt', 'first');
      state.addStep();
      state.setStepAgentType(1, 'llm_agent');
      state.updateStepField(1, 'prompt', 'second');

      handlers.handleFieldChange(state, 0, 'prompt', 'modified');

      expect(state.getStep(0).config.prompt).toBe('modified');
      expect(state.getStep(1).config.prompt).toBe('second');
    });
  });

  describe('handlePipelineNameChange', () => {
    it('updates pipeline name in state', () => {
      const state = makeState();
      handlers.handlePipelineNameChange(state, 'New Pipeline Name');
      expect(state.getPipeline().name).toBe('New Pipeline Name');
    });
  });

  describe('handleSave with validation', () => {
      it('returns validation errors without calling API when pipeline is invalid', async () => {
        const state = makeState();
        const result = await handlers.handleSave(state, mockApiClient);
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(mockApiClient.createPipeline).not.toHaveBeenCalled();
      });

      it('calls API when pipeline is valid', async () => {
        const state = makeState();
        state.addStep();
        state.setStepAgentType(0, 'memory_agent');
        state.updateStepField(0, 'read_memory', 'on');
        const result = await handlers.handleSave(state, mockApiClient);
        expect(mockApiClient.createPipeline).toHaveBeenCalled();
        expect(result.success).toBe(true);
      });

      it('returns error without crashing when API fails', async () => {
        const state = makeState();
        state.addStep();
        state.setStepAgentType(0, 'memory_agent');
        state.updateStepField(0, 'read_memory', 'on');
        mockApiClient.createPipeline.mockRejectedValueOnce(new Error('Network error'));
        const result = await handlers.handleSave(state, mockApiClient);
        expect(result.success).toBe(false);
        expect(result.error).toBe('Network error');
        expect(result.errors).toHaveLength(0);
      });
    });

  describe('handleFieldBlur', () => {
    beforeEach(() => {
      const { JSDOM } = require('jsdom');
      const dom = new JSDOM(`<!DOCTYPE html><body>
        <textarea id="field-0-prompt" name="prompt"></textarea>
      </body>`);
      global.document = dom.window.document;
      global.HTMLElement = dom.window.HTMLElement;
    });

    afterEach(() => {
      delete global.document;
      delete global.HTMLElement;
    });

    it('calls displayFieldError when field is invalid', () => {
      const state = makeState();
      const fieldDef = { name: 'prompt', label: 'Prompt', field_type: 'text', required: true };
      handlers.handleFieldBlur(state, 0, 'prompt', '', fieldDef);
      const errorEl = global.document.getElementById('error-0-prompt');
      expect(errorEl?.classList.contains('visible')).toBe(true);
    });

    it('calls clearFieldError when field becomes valid', () => {
      const state = makeState();
      const fieldDef = { name: 'prompt', label: 'Prompt', field_type: 'text', required: true };
      handlers.handleFieldBlur(state, 0, 'prompt', '', fieldDef);
      const errorEl = global.document.getElementById('error-0-prompt');
      expect(errorEl?.classList.contains('visible')).toBe(true);

      handlers.handleFieldBlur(state, 0, 'prompt', 'Hello', fieldDef);
      expect(errorEl?.classList.contains('visible')).toBe(false);
    });

    it('does nothing when fieldDef is undefined', () => {
      const state = makeState();
      expect(() => {
        handlers.handleFieldBlur(state, 0, 'unknown', 'value', undefined);
      }).not.toThrow();
    });
  });
});
