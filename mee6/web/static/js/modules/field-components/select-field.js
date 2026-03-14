/**
 * Select Field Component
 * Renders a dropdown select box
 */
import { esc } from '../../utils/esc.js';

export function render(field, value, index, options = {}) {
  const id = `field-${index}-${esc(field.name)}`;
  const required = field.required ? ' required' : '';

  let html = `<label class="field-label">${esc(field.label)}`;
  html += `<select name="${esc(field.name)}" id="${id}"${required}>`;

  for (const opt of field.options) {
    // Default selected option: current value, or field.options[0] if no value set
    const isSelected = (value || field.options[0]) === opt;
    const selected = isSelected ? ' selected' : '';
    html += `<option value="${esc(opt)}"${selected}>${esc(opt)}</option>`;
  }

  html += `</select>`;
  html += `<span class="field-error-message" id="error-${index}-${esc(field.name)}"></span>`;
  html += `</label>`;

  return html;
}

export function getValue(element) {
  return element.value;
}

export function validate(field, value) {
  // Stub - will be implemented in Phase 6
  return null;
}

export const SelectComponent = {
  render,
  getValue,
  validate,
};
