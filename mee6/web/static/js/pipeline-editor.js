import { renderPipeline, renderStep } from './modules/pipeline-renderer.js';
import { setupEventDelegation, teardown as teardownEventDelegation } from './modules/event-delegation.js';
import { PipelineEditorState } from './modules/state-manager.js';

export function initializePipelineEditor(config) {
  const {
    pipeline,
    agentList,
    schemas,
    placeholderHints,
    apiClient,
  } = config;

  const state = new PipelineEditorState();
  const stepsContainer = document.getElementById('steps-container');
  const pipelineNameEl = document.getElementById('pipeline-name');
  const addStepBtn = document.getElementById('add-step-btn');
  const saveBtn = document.getElementById('save-btn');
  const saveBanner = document.getElementById('save-banner');
  const validationBanner = document.getElementById('validation-banner');

  function rerenderAll() {
    stepsContainer.innerHTML = renderPipeline(
      state.getSteps(),
      state.agentList,
      state.schemas,
      state.placeholderHints
    );
  }

  async function rerenderStep(index) {
    const existing = stepsContainer.querySelector(`[data-idx="${index}"]`);
    if (!existing) return rerenderAll();

    const step = state.getStep(index);
    const fields = state.getSchema(step.agent_type);
    const html = renderStep(step, index, state.agentList, state.schemas, state.placeholderHints);

    const temp = document.createElement('div');
    temp.innerHTML = `<div class="step-card" data-idx="${index}">${html}</div>`;
    existing.replaceWith(temp.firstElementChild);
  }

  function showBanner(el, message) {
    el.textContent = message;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
  }

  state.subscribe('steps-updated', () => rerenderAll());
  state.subscribe('step-updated', ({ index }) => rerenderStep(index));
  state.subscribe('schemas-loaded', () => rerenderAll());
  state.subscribe('pipeline-updated', () => {});
  state.subscribe('initialized', () => rerenderAll());

  state.initialize({
    id: pipeline?.id,
    name: pipeline?.name,
    steps: pipeline?.steps,
    agentList,
    schemas,
    placeholderHints,
  });

  // When editing an existing pipeline the steps already have agent_type values,
  // so handleAgentTypeChange is never triggered and schemas are never fetched.
  // Fetch them now so the initial render can show fields.
  if (pipeline?.steps?.some(s => s.agent_type) && !Object.keys(schemas).length) {
    apiClient.fetchSchemas().then(s => state.setSchemas(s)).catch(() => {});
  }

  setupEventDelegation(stepsContainer, pipelineNameEl, addStepBtn, saveBtn, state, apiClient, {
    onSaveSuccess: () => showBanner(saveBanner, 'Pipeline saved successfully'),
    onSaveError: (err) => showBanner(saveBanner, err.message || 'Save failed'),
    onValidationError: (errors) => {
      const container = validationBanner;
      container.innerHTML = `<h3>Validation Errors (${errors.length})</h3><ul>${errors.map(e => {
        const stepLabel = e.stepIndex === -1 ? '(Pipeline)' : `(Step ${e.stepIndex + 1})`;
        return `<li>${stepLabel}: ${e.message}</li>`;
      }).join('')}</ul>`;
      container.style.display = 'block';
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  return { state, rerenderAll, rerenderStep };
}

export function teardown() {
  teardownEventDelegation();
}
