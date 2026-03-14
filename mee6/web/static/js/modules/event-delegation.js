/**
 * Event Delegation - Routes events from DOM to handler functions
 */

let isSetup = false;
let boundHandlers = {};

function getStepIndex(el) {
  const card = el.closest('[data-idx]');
  return card ? parseInt(card.dataset.idx, 10) : null;
}

function getFieldValue(el) {
  return el.type === 'checkbox' ? (el.checked ? 'on' : '') : el.value;
}

async function handleFieldOrAgentChange(state, target, index, apiClient) {
  const { handleAgentTypeChange, handleFieldChange } = await import('./event-handlers.js');
  if (target.classList.contains('agent-select')) handleAgentTypeChange(state, apiClient, index, target.value);
  else if (target.hasAttribute('name')) handleFieldChange(state, index, target.name, getFieldValue(target));
}

export function setupEventDelegation(container, pipelineNameEl, addStepBtn, saveBtn, state, apiClient, callbacks) {
  if (isSetup) return;
  isSetup = true;

  const { onSaveSuccess, onSaveError, onValidationError } = callbacks;

  boundHandlers.changeOrInput = async (e) => {
    const idx = getStepIndex(e.target);
    if (idx !== null) handleFieldOrAgentChange(state, e.target, idx, apiClient);
  };

  boundHandlers.click = async (e) => {
    const idx = getStepIndex(e.target);
    if (idx === null) return;

    const { handleRemoveStep, handleMoveUp, handleMoveDown } = await import('./event-handlers.js');
    if (e.target.classList.contains('remove-step')) handleRemoveStep(state, idx);
    else if (e.target.title === 'Move up') handleMoveUp(state, idx);
    else if (e.target.title === 'Move down') handleMoveDown(state, idx);
  };

  boundHandlers.blur = (e) => {
    const idx = getStepIndex(e.target);
    if (idx === null || !e.target.hasAttribute('name') || e.target.classList.contains('agent-select')) return;

    const card = e.target.closest('[data-idx]');
    const agentType = card.querySelector('.agent-select')?.value || '';
    const schema = state.getSchema(agentType);
    const fieldDef = schema.find(f => f.name === e.target.name);

    if (fieldDef) {
      import('./event-handlers.js').then(({ handleFieldBlur }) => {
        handleFieldBlur(state, idx, e.target.name, getFieldValue(e.target), fieldDef);
      });
    }
  };

  boundHandlers.nameInput = (e) => {
    import('./event-handlers.js').then(({ handlePipelineNameChange }) => {
      handlePipelineNameChange(state, e.target.value);
    });
  };
  boundHandlers.addStep = () => {
    import('./event-handlers.js').then(({ handleAddStep }) => {
      handleAddStep(state);
    });
  };
  boundHandlers.save = async () => {
    const result = await (await import('./event-handlers.js')).handleSave(state, apiClient);
    if (result.success) {
      onSaveSuccess();
    } else if (result.errors && result.errors.length > 0) {
      onValidationError(result.errors);
    } else {
      onSaveError(new Error(result.error));
    }
  };

  container.addEventListener('change', boundHandlers.changeOrInput);
  container.addEventListener('input', boundHandlers.changeOrInput);
  container.addEventListener('click', boundHandlers.click);
  container.addEventListener('blur', boundHandlers.blur, true);
  if (pipelineNameEl) pipelineNameEl.addEventListener('input', boundHandlers.nameInput);
  if (addStepBtn) addStepBtn.addEventListener('click', boundHandlers.addStep);
  if (saveBtn) saveBtn.addEventListener('click', boundHandlers.save);
}

export function teardown() {
  if (!isSetup) return;

  const container = document.getElementById('steps-container');
  if (container) {
    container.removeEventListener('change', boundHandlers.changeOrInput);
    container.removeEventListener('input', boundHandlers.changeOrInput);
    container.removeEventListener('click', boundHandlers.click);
    container.removeEventListener('blur', boundHandlers.blur, true);
  }

  const pipelineNameEl = document.getElementById('pipeline-name');
  const addStepBtn = document.getElementById('add-step-btn');
  const saveBtn = document.getElementById('save-btn');

  if (pipelineNameEl) pipelineNameEl.removeEventListener('input', boundHandlers.nameInput);
  if (addStepBtn) addStepBtn.removeEventListener('click', boundHandlers.addStep);
  if (saveBtn) saveBtn.removeEventListener('click', boundHandlers.save);

  boundHandlers = {};
  isSetup = false;
}
