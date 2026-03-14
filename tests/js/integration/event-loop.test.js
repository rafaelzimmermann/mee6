import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { PipelineEditorState } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/state-manager.js';
import { setupEventDelegation, teardown } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/event-delegation.js';
import { handleAgentTypeChange, handleFieldChange, handleAddStep, handleRemoveStep, handleMoveUp, handleMoveDown, handlePipelineNameChange, handleSave } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/event-handlers.js';

function setupDOM(state) {
  const html = state.getSteps().map((step, index) => {
    const agentOptions = state.agentList.map(agent =>
      `<option value="${agent.name}" ${agent.name === step.agent_type ? 'selected' : ''}>${agent.label}</option>`
    ).join('');
    return `<div class="step-card" data-idx="${index}">
      <select class="agent-select">
        <option value="">— select agent —</option>
        ${agentOptions}
      </select>
      <input type="text" name="prompt" value="${step.config.prompt || ''}" />
      <button class="remove-step">Remove</button>
      <button title="Move up">↑</button>
      <button title="Move down">↓</button>
    </div>`;
  }).join('');

  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html><body>
      <input id="pipeline-name" value="">
      <div id="steps-container">${html}</div>
      <button id="add-step-btn"></button>
      <button id="save-btn"></button>
    </body></html>
  `);

  global.document = dom.window.document;
  global.window = dom.window;

  return dom;
}

function makeState(config = {}) {
  const state = new PipelineEditorState();
  state.initialize({
    id: config.id ?? null,
    name: config.name ?? 'Test',
    steps: config.steps ?? [],
    agentList: config.agentList ?? [
      { name: 'llm_agent', label: 'LLM Agent' },
      { name: 'memory_agent', label: 'Memory Agent' }
    ],
    schemas: config.schemas ?? {
      llm_agent: [
        { name: 'prompt', label: 'Prompt', field_type: 'textarea', required: true }
      ],
      memory_agent: [
        { name: 'read_memory', label: 'Read Memory', field_type: 'checkbox' },
        { name: 'write_memory', label: 'Write Memory', field_type: 'checkbox' }
      ]
    },
    placeholderHints: config.placeholderHints ?? ['{previous_output}', '{pipeline_name}']
  });
  return state;
}

describe('event-loop integration', () => {
  let state;
  let dom;
  let mockApiClient;
  let callbacks;

  beforeEach(() => {
    state = makeState();
    mockApiClient = {
      createPipeline: vi.fn().mockResolvedValue({ id: 'new-id', name: 'Test', steps: [] }),
      updatePipeline: vi.fn().mockResolvedValue({ id: 'existing-id', name: 'Test', steps: [] })
    };

    callbacks = {
      onSaveSuccess: vi.fn(),
      onSaveError: vi.fn()
    };
  });

  afterEach(() => {
    teardown();
    vi.clearAllMocks();
  });

  describe('Scenario 1: Add and configure a step', () => {
    it('full event loop: click add → state mutation → subscription', async () => {
      let stepUpdatedCount = 0;
      let stepsUpdatedCount = 0;
      let fieldUpdatedCount = 0;
      state.subscribe('step-updated', () => stepUpdatedCount++);
      state.subscribe('steps-updated', () => stepsUpdatedCount++);
      state.subscribe('field-updated', () => fieldUpdatedCount++);

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      const initialStepCount = state.getSteps().length;
      expect(initialStepCount).toBe(0);

      addStepBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(state.getSteps().length).toBe(1);
      expect(stepsUpdatedCount).toBe(1);
      const step = state.getStep(0);
      expect(step.agent_type).toBe('');
      expect(step.config).toEqual({});

      state.setStepAgentType(0, 'llm_agent');
      expect(state.getStep(0).agent_type).toBe('llm_agent');
      expect(stepUpdatedCount).toBe(1);

      state.updateStepField(0, 'prompt', 'Test prompt');
      expect(state.getSteps()[0].config.prompt).toBe('Test prompt');
      expect(stepUpdatedCount).toBe(1);   // only setStepAgentType emits step-updated
      expect(fieldUpdatedCount).toBe(1);  // updateStepField emits field-updated (no re-render)
    });
  });

  describe('Scenario 2: Reorder steps', () => {
    it('full event loop: click move → state mutation → subscription', async () => {
      let stepsUpdatedCount = 0;
      state.subscribe('steps-updated', () => stepsUpdatedCount++);

      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.updateStepField(0, 'prompt', 'first');
      state.addStep();
      state.setStepAgentType(1, 'memory_agent');

      stepsUpdatedCount = 0;

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      expect(state.getStep(0).agent_type).toBe('llm_agent');
      expect(state.getStep(1).agent_type).toBe('memory_agent');

      const moveDownButton = stepsContainer.querySelector('[data-idx="0"] [title="Move down"]');
      moveDownButton.click();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(state.getStep(0).agent_type).toBe('memory_agent');
      expect(state.getStep(1).agent_type).toBe('llm_agent');
      expect(stepsUpdatedCount).toBe(1);

      const moveUpButton = stepsContainer.querySelector('[data-idx="1"] [title="Move up"]');
      moveUpButton.click();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(state.getStep(0).agent_type).toBe('llm_agent');
      expect(state.getStep(1).agent_type).toBe('memory_agent');
      expect(stepsUpdatedCount).toBe(2);
    });
  });

  describe('Scenario 3: Remove a step', () => {
    it('full event loop: click remove → state mutation → subscription', async () => {
      let stepsUpdatedCount = 0;
      state.subscribe('steps-updated', () => stepsUpdatedCount++);

      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.updateStepField(0, 'prompt', 'keep me');
      state.addStep();
      state.setStepAgentType(1, 'memory_agent');
      state.updateStepField(1, 'read_memory', 'on');

      stepsUpdatedCount = 0;

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      expect(state.getSteps().length).toBe(2);

      const removeButton = stepsContainer.querySelector('[data-idx="0"] .remove-step');
      removeButton.click();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(state.getSteps().length).toBe(1);
      expect(state.getStep(0).agent_type).toBe('memory_agent');
      expect(state.getStep(0).config.read_memory).toBe('on');
      expect(stepsUpdatedCount).toBe(1);
    });
  });

  describe('Scenario 4: Agent type change clears fields', () => {
    it('full event loop: change agent → config reset → subscription', async () => {
      let stepUpdatedCount = 0;
      state.subscribe('step-updated', () => stepUpdatedCount++);

      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.updateStepField(0, 'prompt', 'old value');

      stepUpdatedCount = 0;

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      expect(state.getStep(0).agent_type).toBe('llm_agent');
      expect(state.getStep(0).config.prompt).toBe('old value');

      const agentSelect = stepsContainer.querySelector('[data-idx="0"] .agent-select');
      agentSelect.value = 'memory_agent';
      agentSelect.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(state.getStep(0).agent_type).toBe('memory_agent');
      expect(state.getStep(0).config.prompt).toBeUndefined();
      expect(state.getStep(0).config).toEqual({});
      expect(stepUpdatedCount).toBe(1);
    });
  });

  describe('Scenario 5: Save success', () => {
    it('full event loop: click save → API call → callback', async () => {
      state.setPipelineName('Test Pipeline');
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.updateStepField(0, 'prompt', 'test prompt');

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      expect(mockApiClient.createPipeline).not.toHaveBeenCalled();

      saveBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockApiClient.createPipeline).toHaveBeenCalledWith({
        id: null,
        name: 'Test Pipeline',
        steps: [{ agent_type: 'llm_agent', config: { prompt: 'test prompt' } }]
      });

      expect(callbacks.onSaveSuccess).toHaveBeenCalled();
      expect(callbacks.onSaveError).not.toHaveBeenCalled();
    });

    it('existing pipeline calls updatePipeline instead of createPipeline', async () => {
      state.initialize({
        id: 'existing-id',
        name: 'Test Pipeline',
        steps: []
      });
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.updateStepField(0, 'prompt', 'test prompt');

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      saveBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockApiClient.updatePipeline).toHaveBeenCalledWith({
        id: 'existing-id',
        name: 'Test Pipeline',
        steps: [{ agent_type: 'llm_agent', config: { prompt: 'test prompt' } }]
      });
      expect(mockApiClient.createPipeline).not.toHaveBeenCalled();
      expect(callbacks.onSaveSuccess).toHaveBeenCalled();
    });
  });
});
