/**
 * Text Input Field Component
 * Renders a standard text input field
 */
import { esc } from '../../utils/esc.js';

export function render(field, value, index, options = {}) {
  const id = `field-${index}-${esc(field.name)}`;
  const valueEsc = esc(value ?? '');
  const required = field.required ? 'required' : '';

  let html = `<label class="field-label">${esc(field.label)}`;
  html += `<input type="text" name="${esc(field.name)}" id="${id}" value="${valueEsc}" ${required}`;

  if (field.placeholder) {
    html += ` placeholder="${esc(field.placeholder)}"`;
  }

  html += `>`;
  html += `<span class="field-error-message" id="error-${index}-${esc(field.name)}"></span>`;
  html += `</label>`;

  return html;
}

export function getValue(element) {
  return element.value;
}

export function validate(field, value) {
  // Field validation is handled by validator.js validateField().
  // This stub satisfies the component interface contract.
  return null;
}

export const TextComponent = {
  render,
  getValue,
  validate,
};
