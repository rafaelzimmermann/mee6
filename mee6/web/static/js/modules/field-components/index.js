/**
 * Component Registry for Field Types
 *
 * Each field component implements this interface:
 * {
 *   render(field, value, index, options) => string
 *   getValue(element) => string
 *   validate(field, value) => { valid: boolean, error: string | null }
 * }
 *
 * @param {Object} field - Field definition from schema
 * @param {string} field.name - Field identifier
 * @param {string} field.label - Display label
 * @param {string} field.field_type - Type: text, textarea, select, checkbox, combobox, group_select, calendar_select
 * @param {string} field.placeholder - Placeholder text (optional)
 * @param {boolean} field.required - Whether field is required
 * @param {Array<string>} field.options - Options for select/combobox fields (optional)
 *
 * @param {string} value - Current field value
 * @param {number} index - Step index (used in ID generation)
 *
 * @param {Object} options - Additional context:
 * @param {Array<string>} options.placeholderHints - Placeholder hint strings (e.g., ['{previous_output}', '{pipeline_name}'])
 * @param {Object} options.schema - Full field schemas (for validation context)
 */

import { TextComponent } from './text-field.js';
import { TextareaComponent } from './textarea-field.js';
import { SelectComponent } from './select-field.js';
import { CheckboxComponent } from './checkbox-field.js';
import { ComboboxComponent } from './combobox-field.js';
import { GroupSelectComponent } from './group-select-field.js';
import { CalendarSelectComponent } from './calendar-select-field.js';

const COMPONENTS = {
  text: TextComponent,
  textarea: TextareaComponent,
  select: SelectComponent,
  checkbox: CheckboxComponent,
  combobox: ComboboxComponent,
  group_select: GroupSelectComponent,
  calendar_select: CalendarSelectComponent,
};

/**
 * Get component for a field type
 * @param {string} fieldType - The field type (e.g., 'text', 'textarea')
 * @returns {Object} Field component or TextComponent as fallback
 */
export function getComponent(fieldType) {
  return COMPONENTS[fieldType] || TextComponent;
}

/**
 * Register a custom component at runtime
 * @param {string} name - Component name (e.g., 'custom_field')
 * @param {Object} component - Component object with render, getValue, validate methods
 */
export function registerComponent(name, component) {
  COMPONENTS[name] = component;
}
