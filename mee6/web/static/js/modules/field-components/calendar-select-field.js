/**
 * Calendar Select Field Component
 * Renders a select box with "||" format parsing for calendar selection
 */
import { esc } from '../../utils/esc.js';

export function render(field, value, index, options = {}) {
  const id = `field-${index}-${esc(field.name)}`;
  const hintId = `calid-hint-${index}-${esc(field.name)}`;
  const required = field.required ? ' required' : '';

  // Build onchange handler that updates the hint span
  const handleChange = `(function(s){
    var o=s.options[s.selectedIndex];
    var h=document.getElementById('${hintId}');
    if(h)h.textContent=o?o.dataset.calid:'';
  })(this)`;

  let html = `<label class="field-label">${esc(field.label)}`;
  html += `<select name="${esc(field.name)}" id="${id}"${required} onchange="${handleChange}">`;

  // Add empty option
  html += `<option value="">— select calendar —</option>`;

  let calHint = '';
  for (const opt of field.options) {
    const parts = opt.split('||', 2);
    const calid = parts.length > 1 ? parts[1] : '';
    const selected = value === parts[0] ? ' selected' : '';
    if (value === parts[0]) calHint = calid;
    html += `<option value="${esc(parts[0])}" data-calid="${esc(calid)}"${selected}>${esc(parts[0])}</option>`;
  }

  html += `</select>`;
  html += `<span class="field-hint" id="${hintId}">${esc(calHint)}</span>`;
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

export const CalendarSelectComponent = {
  render,
  getValue,
  validate,
};
