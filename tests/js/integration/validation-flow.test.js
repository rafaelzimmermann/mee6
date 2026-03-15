import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { PipelineEditorState } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/state-manager.js';
import { renderPipeline } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/pipeline-renderer.js';
import * as handlers from '/home/spike/workspace/mee6/mee6/web/static/js/modules/event-handlers.js';
import { setupEventDelegation, teardown } from '/home/spike/workspace/mee6/mee6/web/static/js/modules/event-delegation.js';

function makeState() {
  const state = new PipelineEditorState();
  state.initialize({
    id: null,
    name: 'Test Pipeline',
    steps: [],
    agentList: [
      { name: 'llm_agent', label: 'LLM Agent' },
      { name: 'memory_agent', label: 'Memory Agent' }
    ],
    schemas: {
      llm_agent: [
        { name: 'prompt', label: 'Prompt', field_type: 'textarea', required: true }
      ],
      memory_agent: [
        { name: 'memory_label', label: 'Memory Label', field_type: 'select', required: true }
      ]
    },
    placeholderHints: ['{previous_output}', '{pipeline_name}']
  });
  return state;
}

const mockApiClient = {
  createPipeline: vi.fn().mockResolvedValue({ id: 'new-id', name: 'Test', steps: [] }),
  updatePipeline: vi.fn().mockResolvedValue({ id: 'existing-id', name: 'Test', steps: [] }),
  fetchSchemas: vi.fn().mockResolvedValue({})
};

let dom;
let state;

beforeEach(() => {
  vi.clearAllMocks();
  dom = new JSDOM(`
    <!DOCTYPE html>
    <body>
      <div id="validation-banner"></div>
    </body>
  `);
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
});

afterEach(() => {
  teardown();
  if (dom) dom.window.close();
  delete global.document;
  delete global.window;
  delete global.HTMLElement;
});

describe('validation-flow integration', () => {
  describe('Scenario 1 — Cannot save empty pipeline', () => {
    it('prevents save with validation error', async () => {
      state = makeState();
      const result = await handlers.handleSave(state, mockApiClient);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('at least one step');
      expect(mockApiClient.createPipeline).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 2 — Cannot save step without agent type', () => {
    it('prevents save with agent_type validation error', async () => {
      state = makeState();
      state.addStep();
      state.setStepAgentType(0, '');

      const result = await handlers.handleSave(state, mockApiClient);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.fieldName === 'agent_type')).toBe(true);
      expect(mockApiClient.createPipeline).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 3 — Cannot save required field empty', () => {
    it('prevents save with field validation error', async () => {
      state = makeState();
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.updateStepField(0, 'prompt', '');

      const result = await handlers.handleSave(state, mockApiClient);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.fieldName === 'prompt')).toBe(true);
      expect(mockApiClient.createPipeline).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 4 — Cannot save memory_agent with no label', () => {
    it('prevents save with memory_label validation error', async () => {
      state = makeState();
      state.addStep();
      state.setStepAgentType(0, 'memory_agent');
      state.updateStepField(0, 'memory_label', '');

      const result = await handlers.handleSave(state, mockApiClient);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.fieldName === 'memory_label')).toBe(true);
      expect(mockApiClient.createPipeline).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 5 — Real-time validation on blur shows inline error', () => {
    it('displays error span when field is invalid', () => {
      state = makeState();
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');

      dom = new JSDOM(`
        <!DOCTYPE html>
        <body>
          <textarea id="field-0-prompt" name="prompt"></textarea>
        </body>
      `);

      global.document = dom.window.document;
      global.HTMLElement = dom.window.HTMLElement;

      const fieldDef = state.schemas.llm_agent.find(f => f.name === 'prompt');
      handlers.handleFieldBlur(state, 0, 'prompt', '', fieldDef);

      const errorEl = global.document.getElementById('error-0-prompt');
      expect(errorEl).not.toBeNull();
      expect(errorEl.classList.contains('visible')).toBe(true);
      expect(errorEl.textContent).toContain('required');
    });
  });

  describe('Scenario 6 — Error clears when field is fixed', () => {
    it('hides error span when field becomes valid', () => {
      state = makeState();
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');

      dom = new JSDOM(`
        <!DOCTYPE html>
        <body>
          <textarea id="field-0-prompt" name="prompt"></textarea>
        </body>
      `);

      global.document = dom.window.document;
      global.HTMLElement = dom.window.HTMLElement;

      const fieldDef = state.schemas.llm_agent.find(f => f.name === 'prompt');
      handlers.handleFieldBlur(state, 0, 'prompt', '', fieldDef);

      const errorEl = global.document.getElementById('error-0-prompt');
      expect(errorEl.classList.contains('visible')).toBe(true);

      handlers.handleFieldBlur(state, 0, 'prompt', 'Hello world', fieldDef);

      expect(errorEl.classList.contains('visible')).toBe(false);
    });
  });

  describe('Scenario 7 — Valid pipeline saves successfully', () => {
    it('calls API when pipeline passes validation', async () => {
      state = makeState();
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.updateStepField(0, 'prompt', 'Hello world');

      const result = await handlers.handleSave(state, mockApiClient);

      expect(result.success).toBe(true);
      expect(mockApiClient.createPipeline).toHaveBeenCalled();
    });
  });

  describe('Scenario 8 — Multiple validation errors all reported', () => {
    it('returns all validation errors with correct step indices', async () => {
      state = makeState();
      state.addStep();
      state.setStepAgentType(0, '');
      state.addStep();
      state.setStepAgentType(1, 'llm_agent');
      state.updateStepField(1, 'prompt', '');
      state.addStep();
      state.setStepAgentType(2, 'memory_agent');
      state.updateStepField(2, 'memory_label', '');

      const result = await handlers.handleSave(state, mockApiClient);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBe(3);

      const stepIndices = result.errors.map(e => e.stepIndex);
      expect(stepIndices).toContain(0);
      expect(stepIndices).toContain(1);
      expect(stepIndices).toContain(2);

      expect(result.errors.some(e => e.fieldName === 'agent_type' && e.stepIndex === 0)).toBe(true);
      expect(result.errors.some(e => e.fieldName === 'prompt' && e.stepIndex === 1)).toBe(true);
      expect(result.errors.some(e => e.fieldName === 'memory_label' && e.stepIndex === 2)).toBe(true);
    });
  });

  describe('Scenario 9 — Validation summary shows step numbers', () => {
    it('displays summary with (Step N) labels for each error', async () => {
      state = makeState();
      state.addStep();
      state.setStepAgentType(0, 'llm_agent');
      state.updateStepField(0, 'prompt', '');
      state.addStep();
      state.setStepAgentType(1, 'llm_agent');
      state.updateStepField(1, 'prompt', '');

      dom = new JSDOM(`
        <!DOCTYPE html>
        <body>
          <div id="validation-banner"></div>
        </body>
      `);

      global.document = dom.window.document;
      global.HTMLElement = dom.window.HTMLElement;

      const result = await handlers.handleSave(state, mockApiClient);

      const { displayValidationSummary } = require('/home/spike/workspace/mee6/mee6/web/static/js/modules/validator.js');
      const banner = global.document.getElementById('validation-banner');

      displayValidationSummary(result.errors, banner);

      expect(banner.innerHTML).toContain('(Step 1)');
      expect(banner.innerHTML).toContain('(Step 2)');
      expect(banner.style.display).toBe('block');
    });

    it('shows (Pipeline) label for step-less pipeline', async () => {
      state = makeState();

      dom = new JSDOM(`
        <!DOCTYPE html>
        <body>
          <div id="validation-banner"></div>
        </body>
      `);

      global.document = dom.window.document;
      global.HTMLElement = dom.window.HTMLElement;

      const result = await handlers.handleSave(state, mockApiClient);

      const { displayValidationSummary } = require('/home/spike/workspace/mee6/mee6/web/static/js/modules/validator.js');
      const banner = global.document.getElementById('validation-banner');

      displayValidationSummary(result.errors, banner);

      expect(banner.innerHTML).toContain('(Pipeline)');
      expect(banner.innerHTML).not.toContain('(Step');
      expect(banner.style.display).toBe('block');
    });
  });
});
