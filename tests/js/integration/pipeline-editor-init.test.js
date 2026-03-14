import { describe, it, expect, vi, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { initializePipelineEditor, teardown } from '/home/spike/workspace/mee6/mee6/web/static/js/pipeline-editor.js';

const SCHEMAS = {
  llm_agent: [
    { name: 'prompt', label: 'Prompt', field_type: 'textarea', required: true, placeholder: '', options: [] },
  ],
};

const AGENT_LIST = [{ value: 'llm_agent', label: 'LLM Agent' }];

function setupDOM() {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>
    <input id="pipeline-name" value="">
    <div id="steps-container"></div>
    <button id="add-step-btn"></button>
    <button id="save-btn"></button>
    <div id="save-banner" style="display:none"></div>
    <div id="validation-banner" style="display:none"></div>
  </body></html>`);
  global.document = dom.window.document;
  global.window = dom.window;
}

afterEach(() => {
  teardown();
  vi.clearAllMocks();
});

describe('initializePipelineEditor — edit existing pipeline', () => {
  it('fetches schemas when existing pipeline has steps with agent types', async () => {
    setupDOM();
    const fetchSchemas = vi.fn().mockResolvedValue(SCHEMAS);

    initializePipelineEditor({
      pipeline: {
        id: 'pipeline-1',
        name: 'My Pipeline',
        steps: [{ agent_type: 'llm_agent', config: { prompt: 'hello' } }],
      },
      agentList: AGENT_LIST,
      schemas: {},
      placeholderHints: [],
      apiClient: { fetchSchemas },
    });

    await new Promise(r => setTimeout(r, 10));
    expect(fetchSchemas).toHaveBeenCalledOnce();
  });

  it('renders fields after schemas are fetched', async () => {
    setupDOM();
    const fetchSchemas = vi.fn().mockResolvedValue(SCHEMAS);

    initializePipelineEditor({
      pipeline: {
        id: 'pipeline-1',
        name: 'My Pipeline',
        steps: [{ agent_type: 'llm_agent', config: { prompt: 'hello' } }],
      },
      agentList: AGENT_LIST,
      schemas: {},
      placeholderHints: [],
      apiClient: { fetchSchemas },
    });

    // Before schemas arrive: no fields
    expect(document.querySelector('textarea[name="prompt"]')).toBeNull();

    await new Promise(r => setTimeout(r, 10));

    // After schemas arrive: field is rendered with saved config value
    const textarea = document.querySelector('textarea[name="prompt"]');
    expect(textarea).not.toBeNull();
    expect(textarea.textContent).toBe('hello');
  });

  it('does not fetch schemas on init for a new pipeline with no steps', async () => {
    setupDOM();
    const fetchSchemas = vi.fn().mockResolvedValue(SCHEMAS);

    initializePipelineEditor({
      pipeline: null,
      agentList: AGENT_LIST,
      schemas: {},
      placeholderHints: [],
      apiClient: { fetchSchemas },
    });

    await new Promise(r => setTimeout(r, 10));
    expect(fetchSchemas).not.toHaveBeenCalled();
  });
});
