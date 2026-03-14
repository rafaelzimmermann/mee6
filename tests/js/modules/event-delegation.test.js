import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { PipelineEditorState } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/state-manager.js';
import { renderPipeline } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/pipeline-renderer.js';
import { renderStepCard } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/step-renderer.js';
import { setupEventDelegation, teardown } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/event-delegation.js';

function setupDOM(state) {
  const html = state.getSteps().map((step, index) => {
    const fields = step.agent_type ? state.schemas[step.agent_type] || [] : [];
    const cardContent = renderStepCard(step, index, state.agentList, fields, state.placeholderHints, state.schemas);
    return `<div class="step-card" data-idx="${index}">${cardContent}</div>`;
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

describe('event-delegation', () => {
  let state;
  let dom;
  let mockApiClient;
  let callbacks;
  let renderSpy;

  beforeEach(() => {
    state = makeState();
    renderSpy = vi.fn();
    state.subscribe('steps-updated', renderSpy);
    state.subscribe('step-updated', renderSpy);

    mockApiClient = {
      createPipeline: vi.fn().mockResolvedValue({ id: 'new-id', name: 'Test', steps: [] }),
      updatePipeline: vi.fn().mockResolvedValue({ id: 'existing-id', name: 'Test', steps: [] })
    };

    callbacks = {
      onSaveSuccess: vi.fn(),
      onSaveError: vi.fn(),
      onValidationError: vi.fn()
    };
  });

  afterEach(() => {
    teardown();
    vi.clearAllMocks();
  });

  describe('Add step button click', () => {
    it('clicking add-step-btn results in state having one more step', () => {
      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      const initialCount = state.getSteps().length;
      addStepBtn.click();

      expect(state.getSteps().length).toBe(initialCount + 1);
    });

    it('re-renders after the state change (verify via subscription callback or spy)', () => {
      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      addStepBtn.click();

      expect(renderSpy).toHaveBeenCalled();
    });
  });

  describe('Remove step button click', () => {
    it('set up state with two steps, render, find remove button on step 0', () => {
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.addStep();
      state.setStepAgentType(1, 'memory_agent');

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      const removeButton = stepsContainer.querySelector('[data-idx="0"] .remove-step');
      expect(removeButton).toBeTruthy();
    });

    it('clicking remove button calls state.removeStep(0)', async () => {
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.addStep();
      state.setStepAgentType(1, 'memory_agent');

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      const removeButton = stepsContainer.querySelector('[data-idx="0"] .remove-step');
      removeButton.click();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(state.getSteps().length).toBe(1);
    });

    it('state has one step remaining', async () => {
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.addStep();
      state.setStepAgentType(1, 'memory_agent');

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      const removeButton = stepsContainer.querySelector('[data-idx="0"] .remove-step');
      removeButton.click();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(state.getSteps().length).toBe(1);
    });
  });

  describe('Move up button click', () => {
    it('set up state with two steps (llm_agent, memory_agent), render', () => {
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.addStep();
      state.setStepAgentType(1, 'memory_agent');

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      const moveUpButton = stepsContainer.querySelector('[data-idx="1"] [title="Move up"]');
      expect(moveUpButton).toBeTruthy();
    });

    it('click move-up on step 1', async () => {
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.addStep();
      state.setStepAgentType(1, 'memory_agent');

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      const moveUpButton = stepsContainer.querySelector('[data-idx="1"] [title="Move up"]');
      moveUpButton.click();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(state.getSteps()[0].agent_type).toBe('memory_agent');
      expect(state.getSteps()[1].agent_type).toBe('llm_agent');
    });

    it('state step order is now [memory_agent, llm_agent]', async () => {
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.addStep();
      state.setStepAgentType(1, 'memory_agent');

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      const moveUpButton = stepsContainer.querySelector('[data-idx="1"] [title="Move up"]');
      moveUpButton.click();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(state.getSteps()[0].agent_type).toBe('memory_agent');
      expect(state.getSteps()[1].agent_type).toBe('llm_agent');
    });

    it('click move-up on step 1', async () => {
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.addStep();
      state.setStepAgentType(1, 'memory_agent');

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      const moveUpButton = stepsContainer.querySelector('[data-idx="1"] [title="Move up"]');
      moveUpButton.click();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(state.getSteps()[0].agent_type).toBe('memory_agent');
      expect(state.getSteps()[1].agent_type).toBe('llm_agent');
    });

    it('state step order is now [memory_agent, llm_agent]', async () => {
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.addStep();
      state.setStepAgentType(1, 'memory_agent');

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      const moveUpButton = stepsContainer.querySelector('[data-idx="1"] [title="Move up"]');
      moveUpButton.click();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(state.getSteps()[0].agent_type).toBe('memory_agent');
      expect(state.getSteps()[1].agent_type).toBe('llm_agent');
    });
  });

  describe('Move down button click', () => {
    it('same setup, click move-down on step 0', async () => {
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.addStep();
      state.setStepAgentType(1, 'memory_agent');

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      const moveDownButton = stepsContainer.querySelector('[data-idx="0"] [title="Move down"]');
      moveDownButton.click();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(state.getSteps()[0].agent_type).toBe('memory_agent');
      expect(state.getSteps()[1].agent_type).toBe('llm_agent');
    });

    it('same result as above', async () => {
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.addStep();
      state.setStepAgentType(1, 'memory_agent');

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      const moveDownButton = stepsContainer.querySelector('[data-idx="0"] [title="Move down"]');
      moveDownButton.click();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(state.getSteps()[0].agent_type).toBe('memory_agent');
      expect(state.getSteps()[1].agent_type).toBe('llm_agent');
    });
  });

  describe('Agent select change', () => {
    it('find the agent-select in a rendered card', async () => {
      state.addStep();

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      const agentSelect = stepsContainer.querySelector('[data-idx="0"] .agent-select');
      expect(agentSelect).toBeTruthy();
    });

    it('dispatch a \'change\' event with value \'llm_agent\'', async () => {
      state.addStep();

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      const agentSelect = stepsContainer.querySelector('[data-idx="0"] .agent-select');
      agentSelect.value = 'llm_agent';
      agentSelect.dispatchEvent(new Event('change', { bubbles: true }));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(state.getStep(0).agent_type).toBe('llm_agent');
    });

    it('state step 0 agent_type is now \'llm_agent\'', async () => {
      state.addStep();

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      const agentSelect = stepsContainer.querySelector('[data-idx="0"] .agent-select');
      agentSelect.value = 'llm_agent';
      agentSelect.dispatchEvent(new Event('change', { bubbles: true }));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(state.getStep(0).agent_type).toBe('llm_agent');
    });

    it('state step 0 config was reset to {}', async () => {
      state.addStep();
      state.setStepAgentType(0, 'memory_agent');
      state.updateStepField(0, 'read_memory', 'on');

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      const agentSelect = stepsContainer.querySelector('[data-idx="0"] .agent-select');
      agentSelect.value = 'llm_agent';
      agentSelect.dispatchEvent(new Event('change', { bubbles: true }));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(state.getStep(0).config).toEqual({});
    });
  });

  describe('Field change (text input)', () => {
    it('set up a step with llm_agent and rendered fields', async () => {
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      const promptTextarea = stepsContainer.querySelector('[data-idx="0"] textarea[name="prompt"]');
      expect(promptTextarea).toBeTruthy();
    });

    it('find the prompt textarea, change its value, dispatch input event', async () => {
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      const promptTextarea = stepsContainer.querySelector('[data-idx="0"] textarea[name="prompt"]');
      promptTextarea.value = 'Hello world';
      promptTextarea.dispatchEvent(new Event('input', { bubbles: true }));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(state.getStep(0).config.prompt).toBe('Hello world');
    });

    it('state.getStep(0).config.prompt equals new value', async () => {
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      const promptTextarea = stepsContainer.querySelector('[data-idx="0"] textarea[name="prompt"]');
      promptTextarea.value = 'Hello world';
      promptTextarea.dispatchEvent(new Event('change', { bubbles: true }));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(state.getStep(0).config.prompt).toBe('Hello world');
    });
  });

  describe('Field change (checkbox)', () => {
    it('set up a step with memory_agent', async () => {
      state.addStep();
      state.setStepAgentType(0, 'memory_agent');

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      const readCheckbox = stepsContainer.querySelector('[data-idx="0"] input[name="read_memory"]');
      expect(readCheckbox).toBeTruthy();
    });

    it('find the read_memory checkbox, check it, dispatch change', async () => {
      state.addStep();
      state.setStepAgentType(0, 'memory_agent');

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      const readCheckbox = stepsContainer.querySelector('[data-idx="0"] input[name="read_memory"]');
      readCheckbox.checked = true;
      readCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(state.getStep(0).config.read_memory).toBe('on');
    });

    it('state.getStep(0).config.read_memory === \'on\'', async () => {
      state.addStep();
      state.setStepAgentType(0, 'memory_agent');

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      const readCheckbox = stepsContainer.querySelector('[data-idx="0"] input[name="read_memory"]');
      readCheckbox.checked = true;
      readCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(state.getStep(0).config.read_memory).toBe('on');
    });
  });

  describe('Pipeline name change', () => {
    it('type in the pipeline name input', () => {
      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      pipelineNameEl.value = 'New Pipeline Name';
      pipelineNameEl.dispatchEvent(new Event('input', { bubbles: true }));

      expect(state.getPipeline().name).toBe('New Pipeline Name');
    });

    it('state.pipeline.name reflects the new value', () => {
      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      pipelineNameEl.value = 'New Pipeline Name';
      pipelineNameEl.dispatchEvent(new Event('input', { bubbles: true }));

      expect(state.getPipeline().name).toBe('New Pipeline Name');
    });
  });

  describe('Save button — success', () => {
    it('click save button', async () => {
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.updateStepField(0, 'prompt', 'Hello world');

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      saveBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(callbacks.onSaveSuccess).toHaveBeenCalled();
    });

    it('onSaveSuccess callback is called', async () => {
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.updateStepField(0, 'prompt', 'Test prompt');

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      saveBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(callbacks.onSaveSuccess).toHaveBeenCalled();
    });
  });

  describe('Save button — error', () => {
    it('mock apiClient.createPipeline to reject', async () => {
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.updateStepField(0, 'prompt', 'Test');

      const errorClient = {
        createPipeline: vi.fn().mockRejectedValue(new Error('Save failed')),
        updatePipeline: vi.fn()
      };

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, errorClient, callbacks);

      saveBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(callbacks.onSaveError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('click save button', async () => {
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.updateStepField(0, 'prompt', 'Test');

      const errorClient = {
        createPipeline: vi.fn().mockRejectedValue(new Error('Save failed')),
        updatePipeline: vi.fn()
      };

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, errorClient, callbacks);

      saveBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(callbacks.onSaveError).toHaveBeenCalled();
    });

    it('onSaveError callback is called', async () => {
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.updateStepField(0, 'prompt', 'Test');

      const errorClient = {
        createPipeline: vi.fn().mockRejectedValue(new Error('Save failed')),
        updatePipeline: vi.fn()
      };

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, errorClient, callbacks);

      saveBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(callbacks.onSaveError).toHaveBeenCalled();
    });
  });

  describe('teardown', () => {
    it('after teardown(), clicking add-step-btn does not change state', () => {
      state.addStep();

      setupDOM(state);
      const stepsContainer = document.getElementById('steps-container');
      const addStepBtn = document.getElementById('add-step-btn');
      const pipelineNameEl = document.getElementById('pipeline-name');
      const saveBtn = document.getElementById('save-btn');

      setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, mockApiClient, callbacks);

      teardown();

      const initialCount = state.getSteps().length;
      addStepBtn.click();

      expect(state.getSteps().length).toBe(initialCount);
    });
  });
});
