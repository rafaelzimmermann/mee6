/**
 * Event Handlers - Individual handler functions for user interactions
 *
 * INTERACTION AUDIT - Current template (pipeline_editor.html)
 * ===========================================================
 *
 * Add step [click]: addStep() → addStep() → no render
 * Remove step [click]: removeStep() → removeStep(index) → full render, closest('.step-card')
 * Move up [click]: moveStepUp(idx) → moveStepUp(index) → full render
 * Move down [click]: moveStepDown(idx) → moveStepDown(index) → full render
 * Agent select [change]: delegation → setStepAgentType() → targeted render, closest('.step-card')
 * Field change [change]: none → updateStepField() → no render (TO BE ADDED)
 * Pipeline name [input]: none → setPipelineName() → no render (TO BE ADDED)
 * Save [click]: savePipeline() → read-only → no render, validateMemorySteps()
 *
 * CRITICAL: Field/name changes don't update state, full re-render on all step ops
 */

import { copyStep } from '../utils/state-helpers.js';
import { validateSingleField, displayFieldError, clearFieldError, highlightInvalidFields, validatePipeline, clearAllValidationUI } from './validator.js';

export async function handleAgentTypeChange(state, apiClient, index, agentType) {
  state.setStepAgentType(index, agentType);

  if (!agentType) return;

  if (!state.isSchemaFetched(agentType)) {
    const schemas = await apiClient.fetchSchemas();
    state.setSchemas(schemas);
  }
}

export function handleFieldChange(state, index, fieldName, value) {
  state.updateStepField(index, fieldName, value);
}

export function handleAddStep(state) {
  state.addStep();
}

export function handleRemoveStep(state, index) {
  state.removeStep(index);
}

export function handleMoveUp(state, index) {
  state.moveStepUp(index);
}

export function handleMoveDown(state, index) {
  state.moveStepDown(index);
}

export function handlePipelineNameChange(state, name) {
  state.setPipelineName(name);
}

export async function handleSave(state, apiClient) {
  clearAllValidationUI();

  const pipeline = state.getPipeline();
  const errors = validatePipeline(pipeline, state.schemas);

  if (errors.length > 0) {
    return { success: false, errors, error: null };
  }

  try {
    if (pipeline.id) {
      await apiClient.updatePipeline(pipeline);
    } else {
      await apiClient.createPipeline(pipeline);
    }
    return { success: true, errors: [], error: null };
  } catch (err) {
    return { success: false, errors: [], error: err.message || 'Save failed' };
  }
}

export function handleFieldBlur(state, index, fieldName, value, fieldDef) {
  if (!fieldDef) return;

  const errors = validateSingleField(fieldName, value, fieldDef, index);

  if (errors.length > 0) {
    displayFieldError(fieldName, index, errors[0].message);
    highlightInvalidFields(errors);
  } else {
    clearFieldError(fieldName, index);
    const fieldEl = document.getElementById(`field-${index}-${fieldName}`);
    if (fieldEl) fieldEl.classList.remove('has-error');
  }
}
