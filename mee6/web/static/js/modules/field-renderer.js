/**
 * Field Renderer
 * Coordinates rendering of all fields for a step using the component registry
 */
import { getComponent } from './field-components/index.js';

/**
 * Renders all fields for a given agent step
 * @param {number} idx - Step index (used for ID generation)
 * @param {string} agentType - Agent type identifier (e.g., 'openai', 'memory_agent')
 * @param {Object} config - Current field values (field.name -> value)
 * @param {Object} schemas - All field schemas keyed by agent type
 * @param {Array<string>} placeholderHints - Placeholder hint strings for textarea fields
 * @returns {string} HTML string of all rendered fields
 */
export function renderFields(idx, agentType, config, schemas, placeholderHints) {
  if (!agentType || !schemas[agentType]) {
    return '';
  }

  const fields = schemas[agentType];
  let html = '';

  for (const field of fields) {
    const value = config[field.name] ?? '';
    const component = getComponent(field.field_type);

    const options = {
      placeholderHints,
      schema: schemas,
    };

    html += component.render(field, value, idx, options);
  }

  return html;
}
