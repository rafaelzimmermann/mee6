/**
 * Group Select Field Component
 * Renders a select box with "||" format parsing and hint display
 */
import { esc } from '../../utils/esc.js';

export function render(field, value, index, options = {}) {
  const id = `field-${index}-${esc(field.name)}`;
  const hintId = `hint-${index}-${esc(field.name)}`;
  const required = field.required ? ' required' : '';

  let html = `<label class="field-label">${esc(field.label)}`;
  html += `<select name="${esc(field.name)}" id="${id}"${required} data-hint-target="${esc(hintId)}">`;

  // Add empty option
  html += `<option value="">— select group —</option>`;

  let hintVal = '';
  for (const opt of field.options) {
    const parts = opt.split('||', 2);
    const jid = parts.length > 1 ? parts[1] : parts[0];
    const selected = value === jid ? ' selected' : '';
    if (value === jid) hintVal = jid;
    html += `<option value="${esc(jid)}" data-hint="${esc(jid)}"${selected}>${esc(parts[0])}</option>`;
  }

  html += `</select>`;
  html += `<span class="field-hint" id="${hintId}">${esc(hintVal)}</span>`;
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

export const GroupSelectComponent = {
  render,
  getValue,
  validate,
};
