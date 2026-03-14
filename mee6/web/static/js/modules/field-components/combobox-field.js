/**
 * Combobox Field Component
 * Renders a text input with a datalist for autocomplete
 */
import { esc } from '../../utils/esc.js';

export function render(field, value, index, options = {}) {
  const id = `field-${index}-${esc(field.name)}`;
  const valueEsc = esc(value ?? '');
  const required = field.required ? 'required' : '';

  let html = `<label class="field-label">${esc(field.label)}`;
  html += `<input type="text" list="dl-${index}-${esc(field.name)}" name="${esc(field.name)}" id="${id}" value="${valueEsc}"${required}`;

  if (field.placeholder) {
    html += ` placeholder="${esc(field.placeholder)}"`;
  }

  html += `>`;
  html += `<datalist id="dl-${index}-${esc(field.name)}">`;

  for (const opt of field.options) {
    html += `<option value="${esc(opt)}">`;
  }

  html += `</datalist>`;
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

export const ComboboxComponent = {
  render,
  getValue,
  validate,
};
