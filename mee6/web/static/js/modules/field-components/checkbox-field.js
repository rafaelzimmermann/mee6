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
  html += `</label>`;

  return html;
}

export function getValue(element) {
  return element.checked ? 'on' : '';
}

export function validate(field, value) {
  // Stub - will be implemented in Phase 6
  return null;
}

export const CheckboxComponent = {
  render,
  getValue,
  validate,
};
