/**
 * VALIDATION ANSWERS TO CONTEXT QUESTIONS
 * ==========================================
 * 1. Current validateMemorySteps() only checks memory_agent steps for read/write checkboxes.
 *    It does NOT validate: empty pipelines, missing agent types, empty required fields.
 *    New validator FULLY REPLACES it - all validation logic moves to validator.js.
 *
 * 2. Current template uses NO CSS class for error states on fields.
 *    Old validation uses alert() for errors, not inline visual feedback.
 *    New validation adds 'has-error' class to fields (matching new CSS in style.css).
 *
 * 3. Current error display: alert() + saveBanner (success/error class).
 *    New validation: inline error spans below fields + validation summary banner.
 *    Template's saveBanner remains for save success/failure messages only.
 *
 * 4. Validation runs at:
 *    - On field blur (NEW): real-time, single field only (validateSingleField)
 *    - On save attempt (NEW): full pipeline (validatePipeline) before API call
 *    Neither existed before - only validateMemorySteps() ran on save, not full validation.
 */

export class ValidationError {
  constructor(fieldName, stepIndex, fieldType, message) {
    this.fieldName = fieldName;
    this.stepIndex = stepIndex;
    this.fieldType = fieldType;
    this.message = message;
  }
}

export function validateField(field, value) {
  if (!field.required) return null;
  const strVal = String(value ?? '');
  const { field_type } = field;
  if (field_type === 'text' || field_type === 'textarea' || field_type === 'combobox') {
    return !strVal || strVal.trim() === '' ? `${field.label} is required` : null;
  }
  if (field_type === 'select' || field_type === 'group_select' || field_type === 'calendar_select') {
    return !strVal || strVal === '' ? `${field.label} is required` : null;
  }
  if (field_type === 'checkbox') {
    return strVal !== 'on' ? `${field.label} is required` : null;
  }
  return null;
}

export function validateStep(step, stepIndex, schemas) {
  const errors = [];
  if (!step.agent_type) {
    errors.push(new ValidationError('agent_type', stepIndex, 'select', 'Agent type is required'));
    return errors;
  }
  if (step.agent_type === 'memory_agent') {
    const read = step.config?.read_memory;
    const write = step.config?.write_memory;
    if (read !== 'on' && write !== 'on') {
      errors.push(new ValidationError('memory_options', stepIndex, 'checkbox', 'Please select at least one of Read Memory or Write Memory'));
    }
  }
  const schema = schemas[step.agent_type] || [];
  for (const field of schema) {
    const value = step.config?.[field.name];
    const error = validateField(field, value);
    if (error) errors.push(new ValidationError(field.name, stepIndex, field.field_type, error));
  }
  return errors;
}

export function validatePipeline(pipeline, schemas) {
  const errors = [];
  const steps = pipeline?.steps ?? [];
  if (steps.length === 0) {
    errors.push(new ValidationError('steps', -1, 'pipeline', 'Pipeline must have at least one step'));
  }
  for (let i = 0; i < steps.length; i++) {
    errors.push(...validateStep(steps[i], i, schemas));
  }
  return errors;
}

export function validateSingleField(fieldName, value, fieldDef, stepIndex) {
  const error = validateField(fieldDef, value);
  if (error) return [new ValidationError(fieldName, stepIndex, fieldDef.field_type, error)];
  return [];
}

export function displayFieldError(fieldName, stepIndex, message) {
  let el = document.getElementById(`error-${stepIndex}-${fieldName}`);
  if (!el) {
    const fieldEl = document.getElementById(`field-${stepIndex}-${fieldName}`);
    if (fieldEl) {
      el = document.createElement('span');
      el.id = `error-${stepIndex}-${fieldName}`;
      el.className = 'field-error-message';
      fieldEl.parentNode.insertBefore(el, fieldEl.nextSibling);
    }
  }
  if (el) { el.textContent = message; el.classList.add('visible'); }
}

export function clearFieldError(fieldName, stepIndex) {
  const el = document.getElementById(`error-${stepIndex}-${fieldName}`);
  if (el) el.classList.remove('visible');
}

export function displayValidationSummary(errors, container) {
  if (!errors.length) { container.style.display = 'none'; return; }
  container.innerHTML = `<h3>Validation Errors (${errors.length})</h3><ul>${errors.map(e => {
    const stepLabel = e.stepIndex === -1 ? '(Pipeline)' : `(Step ${e.stepIndex + 1})`;
    return `<li>${stepLabel}: ${e.message}</li>`;
  }).join('')}</ul>`;
  container.style.display = 'block';
}

export function highlightInvalidFields(errors) {
  errors.forEach(e => {
    const el = document.getElementById(`field-${e.stepIndex}-${e.fieldName}`);
    if (el) el.classList.add('has-error');
  });
}

export function clearAllValidationUI() {
  document.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
  document.querySelectorAll('.field-error-message').forEach(el => el.classList.remove('visible'));
  const banner = document.getElementById('validation-banner');
  if (banner) banner.style.display = 'none';
}
