/**
 * Checkbox Field Component
 * Renders a checkbox input field
 */
import { esc } from '../../utils/esc.js';

export function render(field, value, index, options = {}) {
  const id = `field-${index}-${esc(field.name)}`;
  const required = field.required ? 'required' : '';
  // Checkbox is checked when value === 'on'
  const checked = value === 'on' ? 'checked' : '';

  let html = `<label class="field-label">${esc(field.label)}`;
  html += `<input type="checkbox" name="${esc(field.name)}" id="${id}" value="on" ${checked}${required}>`;
  html += `<span class="field-error-message" id="error-${index}-${esc(field.name)}"></span>`;
  html += `</label>`;

  return html;
}

export function getValue(element) {
  return element.checked ? 'on' : '';
}

export function validate(field, value) {
  // Field validation is handled by validator.js validateField().
  // This stub satisfies the component interface contract.
  return null;
}

export const CheckboxComponent = {
  render,
  getValue,
  validate,
};
