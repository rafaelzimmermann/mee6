import { describe, it, expect, vi } from 'vitest';
import { PipelineEditorState } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/state-manager.js';

describe('PipelineEditorState', () => {
  const mockConfig = {
    id: 'test-id',
    name: 'Test Pipeline',
    steps: [
      { agent_type: 'llm_agent', config: { prompt: 'hello', model: 'gpt-4' } },
      { agent_type: 'memory_agent', config: { read_memory: 'on' } },
    ],
    agentList: [
      { name: 'llm_agent', label: 'LLM Agent' },
      { name: 'memory_agent', label: 'Memory Agent' },
    ],
    schemas: {
      llm_agent: [
        { name: 'prompt', label: 'Prompt', field_type: 'textarea', required: true },
      ],
      memory_agent: [
        { name: 'read_memory', label: 'Read Memory', field_type: 'checkbox' },
      ],
    },
    placeholderHints: ['{previous_output}', '{pipeline_name}'],
  };

  describe('Initialization', () => {
    it('initializes with empty pipeline and empty steps', () => {
      const state = new PipelineEditorState();
      expect(state.getPipeline()).toEqual({ id: null, name: '', steps: [] });
      expect(state.getSteps()).toEqual([]);
    });

    it('initialize() sets all fields from config correctly', () => {
      const state = new PipelineEditorState();
      state.initialize(mockConfig);

      expect(state.getPipeline().id).toBe('test-id');
      expect(state.getPipeline().name).toBe('Test Pipeline');
      expect(state.getSteps().length).toBe(2);
      expect(state.getSteps()[0].agent_type).toBe('llm_agent');
      expect(state.getSteps()[0].config).toEqual({ prompt: 'hello', model: 'gpt-4' });
      expect(state.agentList).toEqual(mockConfig.agentList);
      expect(state.placeholderHints).toEqual(mockConfig.placeholderHints);
      expect(state.getSchema('llm_agent')).toEqual(mockConfig.schemas.llm_agent);
    });

    it('initialize() called twice replaces state (idempotent)', () => {
      const state = new PipelineEditorState();
      state.initialize(mockConfig);

      state.initialize({
        id: 'new-id',
        name: 'New Pipeline',
        steps: [],
        agentList: [],
        schemas: {},
        placeholderHints: [],
      });

      expect(state.getPipeline()).toEqual({ id: 'new-id', name: 'New Pipeline', steps: [] });
      expect(state.getSteps()).toEqual([]);
    });

    it('initialized event is emitted after initialize()', () => {
      const state = new PipelineEditorState();
      const callback = vi.fn();
      state.subscribe('initialized', callback);

      state.initialize(mockConfig);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(state.getPipeline());
    });
  });

  describe('Pipeline mutations', () => {
    it('setPipelineName() updates name and emits pipeline-updated', () => {
      const state = new PipelineEditorState();
      state.initialize(mockConfig);
      const callback = vi.fn();
      state.subscribe('pipeline-updated', callback);

      state.setPipelineName('New Name');

      expect(state.getPipeline().name).toBe('New Name');
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(state.getPipeline());
    });

    it('setPipeline() replaces pipeline object and emits pipeline-updated', () => {
      const state = new PipelineEditorState();
      state.initialize(mockConfig);
      const callback = vi.fn();
      state.subscribe('pipeline-updated', callback);

      const newPipeline = { id: 'new-id', name: 'New', steps: [] };
      state.setPipeline(newPipeline);

      expect(state.getPipeline()).toEqual(newPipeline);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Step mutations', () => {
    let state;
    beforeEach(() => {
      state = new PipelineEditorState();
      state.initialize({
        ...mockConfig,
      });
    });

    it('addStep() appends step with empty agent_type and config', () => {
      state.initialize({ ...mockConfig, steps: [] });
      const callback = vi.fn();
      state.subscribe('steps-updated', callback);

      state.addStep();

      const steps = state.getSteps();
      expect(steps.length).toBe(1);
      expect(steps[0]).toEqual({ agent_type: '', config: {} });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('addStep() emits steps-updated', () => {
      const callback = vi.fn();
      state.subscribe('steps-updated', callback);

      state.addStep();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('addStep() multiple times results in correct count', () => {
      state.initialize({ ...mockConfig, steps: [] });
      state.addStep();
      state.addStep();
      state.addStep();

      expect(state.getSteps().length).toBe(3);
    });

    it('removeStep(0) removes first step', () => {
      state.initialize({ ...mockConfig });
      const callback = vi.fn();
      state.subscribe('steps-updated', callback);

      state.removeStep(0);

      const steps = state.getSteps();
      expect(steps.length).toBe(1);
      expect(steps[0].agent_type).toBe('memory_agent');
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('removeStep(last) removes last step', () => {
      state.initialize({ ...mockConfig });
      const callback = vi.fn();
      state.subscribe('steps-updated', callback);

      state.removeStep(1);

      const steps = state.getSteps();
      expect(steps.length).toBe(1);
      expect(steps[0].agent_type).toBe('llm_agent');
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('removeStep() out of bounds throws', () => {
      state.initialize({ ...mockConfig });

      expect(() => state.removeStep(5)).toThrow();
      expect(() => state.removeStep(-1)).toThrow();
    });

    it('removeStep() emits steps-updated', () => {
      state.initialize({ ...mockConfig });
      const callback = vi.fn();
      state.subscribe('steps-updated', callback);

      state.removeStep(0);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('moveStepUp(1) swaps steps correctly', () => {
      state.initialize({ ...mockConfig });
      const callback = vi.fn();
      state.subscribe('steps-updated', callback);

      state.moveStepUp(1);

      const steps = state.getSteps();
      expect(steps[0].agent_type).toBe('memory_agent');
      expect(steps[1].agent_type).toBe('llm_agent');
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('moveStepUp(0) is a no-op (no error, no state change)', () => {
      state.initialize({ ...mockConfig });
      const originalSteps = state.getSteps();

      state.moveStepUp(0);

      expect(state.getSteps()).toEqual(originalSteps);
    });

    it('moveStepDown(0) swaps steps correctly', () => {
      state.initialize({ ...mockConfig });
      const callback = vi.fn();
      state.subscribe('steps-updated', callback);

      state.moveStepDown(0);

      const steps = state.getSteps();
      expect(steps[0].agent_type).toBe('memory_agent');
      expect(steps[1].agent_type).toBe('llm_agent');
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('moveStepDown(last) is a no-op', () => {
      state.initialize({ ...mockConfig });
      const originalSteps = state.getSteps();

      state.moveStepDown(1);

      expect(state.getSteps()).toEqual(originalSteps);
    });

    it('moveStepUp and moveStepDown both emit steps-updated', () => {
      const callback = vi.fn();
      state.subscribe('steps-updated', callback);

      state.moveStepUp(1);
      state.moveStepDown(0);

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('setStepAgentType() updates agent_type', () => {
      state.initialize({ ...mockConfig });

      state.setStepAgentType(0, 'memory_agent');

      expect(state.getSteps()[0].agent_type).toBe('memory_agent');
    });

    it('setStepAgentType() RESETS config to {} (critical)', () => {
      state.initialize({ ...mockConfig });

      state.setStepAgentType(0, 'memory_agent');

      expect(state.getSteps()[0].config).toEqual({});
    });

    it('setStepAgentType() emits step-updated with correct payload', () => {
      const callback = vi.fn();
      state.subscribe('step-updated', callback);

      state.setStepAgentType(0, 'memory_agent');

      expect(callback).toHaveBeenCalledTimes(1);
      const payload = callback.mock.calls[0][0];
      expect(payload.index).toBe(0);
      expect(payload.step.agent_type).toBe('memory_agent');
      expect(payload.step.config).toEqual({});
    });

    it('updateStepField() updates correct field in correct step', () => {
      state.initialize({ ...mockConfig });

      state.updateStepField(0, 'prompt', 'new value');

      expect(state.getSteps()[0].config.prompt).toBe('new value');
    });

    it('updateStepField() does not affect other steps', () => {
      state.initialize({ ...mockConfig });

      state.updateStepField(0, 'prompt', 'changed');

      expect(state.getSteps()[1].config).toEqual({ read_memory: 'on' });
    });

    it('updateStepField() emits step-updated with correct payload', () => {
      state.initialize(mockConfig);
      const callback = vi.fn();
      state.subscribe('step-updated', callback);

      state.updateStepField(0, 'prompt', 'test');

      expect(callback).toHaveBeenCalledTimes(1);
      const payload = callback.mock.calls[0][0];
      expect(payload.index).toBe(0);
      expect(payload.step.config.prompt).toBe('test');
    });
  });

  describe('Defensive copies', () => {
    it('getStep() returns a copy - mutating returned object does not affect internal state', () => {
      const state = new PipelineEditorState();
      state.initialize(mockConfig);

      const stepCopy = state.getStep(0);
      stepCopy.config.prompt = 'modified';

      expect(state.getSteps()[0].config.prompt).toBe('hello');
    });

    it('getSteps() returns a copy - mutating array does not affect internal state', () => {
      const state = new PipelineEditorState();
      state.initialize(mockConfig);

      const stepsCopy = state.getSteps();
      stepsCopy.push({ agent_type: 'new', config: {} });

      expect(state.getSteps().length).toBe(2);
    });

    it('getPipeline() returns a plain serializable object', () => {
      const state = new PipelineEditorState();
      state.initialize(mockConfig);

      const pipeline = state.getPipeline();

      expect(JSON.stringify(pipeline)).toBeDefined();
      expect(pipeline.id).toBe('test-id');
      expect(pipeline.name).toBe('Test Pipeline');
      expect(pipeline.steps).toBeInstanceOf(Array);
    });
  });

  describe('Subscription system', () => {
    it('subscribe and notify - callback is called when event fires', () => {
      const state = new PipelineEditorState();
      const callback = vi.fn();
      state.subscribe('steps-updated', callback);

      state.addStep();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('subscribe - callback is NOT called for different events', () => {
      const state = new PipelineEditorState();
      const callback = vi.fn();
      state.subscribe('pipeline-updated', callback);

      state.addStep();

      expect(callback).not.toHaveBeenCalled();
    });

    it('unsubscribe - callback is no longer called after unsubscribing', () => {
      const state = new PipelineEditorState();
      const callback = vi.fn();
      state.subscribe('steps-updated', callback);

      state.addStep();
      state.unsubscribe('steps-updated', callback);
      state.addStep();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('Multiple callbacks for same event - all are called', () => {
      const state = new PipelineEditorState();
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const cb3 = vi.fn();
      state.subscribe('steps-updated', cb1);
      state.subscribe('steps-updated', cb2);
      state.subscribe('steps-updated', cb3);

      state.addStep();

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
      expect(cb3).toHaveBeenCalledTimes(1);
    });

    it('Callback receives correct data payload', () => {
      const state = new PipelineEditorState();
      state.initialize({
        ...mockConfig,
        steps: [{ agent_type: 'old_agent', config: {} }],
      });
      const callback = vi.fn();
      state.subscribe('step-updated', callback);

      state.setStepAgentType(0, 'test_agent');

      const payload = callback.mock.calls[0][0];
      expect(payload.index).toBe(0);
      expect(payload.step).toBeDefined();
    });
  });

  describe('Schema', () => {
    it('setSchemas() stores schemas and emits schemas-loaded', () => {
      const state = new PipelineEditorState();
      const callback = vi.fn();
      state.subscribe('schemas-loaded', callback);

      state.setSchemas({ test_agent: [{ name: 'field1' }] });

      expect(state.getSchema('test_agent')).toEqual([{ name: 'field1' }]);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ test_agent: [{ name: 'field1' }] });
    });

    it('getSchema() returns correct field array for known agent type', () => {
      const state = new PipelineEditorState();
      state.initialize(mockConfig);

      const schema = state.getSchema('llm_agent');

      expect(schema).toEqual(mockConfig.schemas.llm_agent);
    });

    it('getSchema() returns [] for unknown agent type', () => {
      const state = new PipelineEditorState();
      state.initialize(mockConfig);

      const schema = state.getSchema('unknown_agent');

      expect(schema).toEqual([]);
    });
  });
});
