// Validator - form validation logic
export class ValidationError {
  constructor(fieldName, stepIndex, fieldType, message) {
    this.fieldName = fieldName;
    this.stepIndex = stepIndex;
    this.fieldType = fieldType;
    this.message = message;
  }
}

export function validateField(field, value) {
  // TODO: Implement field validation
  return null;
}

export function validateStep(step, stepIndex, schema) {
  // TODO: Implement step validation
  return [];
}

export function validatePipeline(pipeline, schema) {
  // TODO: Implement pipeline validation
  return [];
}
