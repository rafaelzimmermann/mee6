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
      await handlers.handleAgentTypeChange(state, 0, 'llm_agent');
      expect(state.getStep(0).agent_type).toBe('llm_agent');
    });

    it('resets config to {} (verify via state.getStep)', async () => {
      const state = makeState();
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.updateStepField(0, 'prompt', 'old value');
      expect(state.getStep(0).config.prompt).toBe('old value');

      await handlers.handleAgentTypeChange(state, 0, 'memory_agent');
      expect(state.getStep(0).config.prompt).toBeUndefined();
      expect(state.getStep(0).config).toEqual({});
    });

    it('if schema already cached, does NOT call fetchSchemas', async () => {
      const state = makeState();
      state.addStep();
      await handlers.handleAgentTypeChange(state, 0, 'llm_agent');
      expect(mockApiClient.fetchSchemas).not.toHaveBeenCalled();
    });

    it('is async — returns a Promise', () => {
      const state = makeState();
      state.addStep();
      const result = handlers.handleAgentTypeChange(state, 0, 'llm_agent');
      expect(result).toBeInstanceOf(Promise);
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

  describe('handleSave', () => {
    describe('new pipeline (no id)', () => {
      it('calls apiClient.createPipeline with pipeline data from state.getPipeline()', async () => {
        const state = makeState();
        state.setPipelineName('Test Pipeline');
        state.addStep();
        state.setStepAgentType(0, 'llm_agent');
        state.updateStepField(0, 'prompt', 'test prompt');

        const result = await handlers.handleSave(state, mockApiClient);

        expect(mockApiClient.createPipeline).toHaveBeenCalledWith({
          id: null,
          name: 'Test Pipeline',
          steps: [{ agent_type: 'llm_agent', config: { prompt: 'test prompt' } }]
        });
      });

      it('returns { success: true, error: null } on success', async () => {
        const state = makeState();
        const result = await handlers.handleSave(state, mockApiClient);
        expect(result).toEqual({ success: true, error: null });
      });

      it('returns { success: false, error: \'...\' } when apiClient throws', async () => {
        const state = makeState();
        const errorClient = {
          createPipeline: vi.fn().mockRejectedValue(new Error('Network error')),
          updatePipeline: vi.fn()
        };

        const result = await handlers.handleSave(state, errorClient);

        expect(result).toEqual({ success: false, error: 'Network error' });
      });
    });

    describe('existing pipeline (has id)', () => {
      it('calls apiClient.updatePipeline (not createPipeline)', async () => {
        const state = makeState({
          id: 'existing-id',
          name: 'Test',
          steps: []
        });
        state.addStep();
        state.setStepAgentType(0, 'llm_agent');

        const pipeline = state.getPipeline();
        expect(pipeline.id).toBe('existing-id');

        await handlers.handleSave(state, mockApiClient);

        expect(mockApiClient.updatePipeline).toHaveBeenCalled();
        expect(mockApiClient.createPipeline).not.toHaveBeenCalled();
      });

      it('returns { success: true, error: null } on success', async () => {
        const state = makeState({ id: 'existing-id', name: 'Test', steps: [] });
        const result = await handlers.handleSave(state, mockApiClient);
        expect(result).toEqual({ success: true, error: null });
      });

      it('returns { success: false, error: \'...\' } when apiClient throws', async () => {
        const state = makeState({ id: 'existing-id', name: 'Test', steps: [] });
        const errorClient = {
          createPipeline: vi.fn(),
          updatePipeline: vi.fn().mockRejectedValue(new Error('Update failed'))
        };

        const result = await handlers.handleSave(state, errorClient);

        expect(result).toEqual({ success: false, error: 'Update failed' });
      });
    });
  });

  describe('handleFieldBlur', () => {
    it('does not throw', () => {
      const state = makeState();
      const fieldDef = { name: 'prompt', label: 'Prompt', field_type: 'textarea', required: true };
      expect(() => {
        handlers.handleFieldBlur(state, 0, 'prompt', 'value', fieldDef);
      }).not.toThrow();
    });

    it('returns undefined (no-op in Phase 5)', () => {
      const state = makeState();
      const fieldDef = { name: 'prompt', label: 'Prompt', field_type: 'textarea', required: true };
      const result = handlers.handleFieldBlur(state, 0, 'prompt', 'value', fieldDef);
      expect(result).toBeUndefined();
    });
  });
});
