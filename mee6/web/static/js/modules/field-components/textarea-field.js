/**
 * Textarea Field Component
 * Renders a multi-line text input with optional placeholder hints
 */
import { esc } from '../../utils/esc.js';

export function render(field, value, index, options = {}) {
  const id = `field-${index}-${esc(field.name)}`;
  const valueEsc = esc(value ?? '');
  const required = field.required ? 'required' : '';
  const placeholderHints = options.placeholderHints || [];

  let html = `<label class="field-label">${esc(field.label)}`;
  html += `<textarea name="${esc(field.name)}" id="${id}" ${required}`;

  if (field.placeholder) {
    html += ` placeholder="${esc(field.placeholder)}"`;
  }

  html += `>${valueEsc}</textarea>`;

  // Add placeholder hints if provided
  if (placeholderHints.length > 0) {
    const hints = placeholderHints.map(p => `<code>${esc(p)}</code>`).join(' ');
    html += `<span class="field-hint">Placeholders: ${hints}</span>`;
  }

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

export const TextareaComponent = {
  render,
  getValue,
  validate,
};
