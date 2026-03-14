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

export async function handleAgentTypeChange(state, index, agentType) {
  state.setStepAgentType(index, agentType);
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
  const pipeline = state.getPipeline();
  try {
    if (pipeline.id) {
      await apiClient.updatePipeline(pipeline);
    } else {
      await apiClient.createPipeline(pipeline);
    }
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function handleFieldBlur(state, index, fieldName, value, fieldDef) {
  // Phase 6: validation hook
}
