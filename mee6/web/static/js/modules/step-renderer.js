/**
 * Step Renderer
 * Renders complete step cards for pipeline editor
 * Maps current template behavior from pipeline_editor.html buildCardHTML()
 *
 * CONTRACT - PRESERVE EXISTING BEHAVIOR:
 * - Wrapper div has class="step-card" and data-idx attribute (set by caller, not rendered here)
 * - Header has class="step-header"
 * - Step number shown in <strong> as "Step {idx + 1}"
 * - Move buttons in div class="step-move-buttons" with class="sm", onclick="moveStepUp/Down({idx})"
 * - Agent selector is <select class="agent-select"> with options from agentList
 * - Remove button has classes "sm danger remove-step"
 * - Fields container is <div class="step-fields" id="step-fields-{idx}">
 * - All agent options rendered, currently selected one has 'selected' attribute
 * - Empty agent type shows placeholder option "— select agent —"
 *
 * INPUT DATA SHAPES:
 * - step: { agent_type: string, config: object }
 * - agentList: [{ name: string, label: string }, ...]
 * - fields: [{ name, label, field_type, ... }, ...] (from schema, may be empty)
 * - placeholderHints: [string, ...]
 */
import { getComponent } from './field-components/index.js';
import { esc } from '../utils/esc.js';

/**
 * Renders agent type selector <select> element
 * @param {Object} step - Step object with agent_type property
 * @param {number} index - Step index (0-based)
 * @param {Array<Object>} agentList - Array of { name, label } for agent options
 * @returns {string} HTML string of agent selector
 */
export function renderAgentSelector(step, index, agentList) {
  const opts = ['<option value="">— select agent —</option>']
    .concat(agentList.map(agent =>
      `<option value="${esc(agent.name)}"${agent.name === step.agent_type ? ' selected' : ''}>${esc(agent.label)}</option>`
    )).join('');

  return `<select class="agent-select">${opts}</select>`;
}

/**
 * Renders just the fields section within a card (used when agent type changes)
 * @param {Array<Object>} fields - Field definitions from schema
 * @param {Object} config - Step's current config object (field.name -> value)
 * @param {number} index - Step index
 * @param {Array<string>} placeholderHints - Placeholder hint strings
 * @returns {string} HTML string of rendered fields
 */
export function renderStepFields(fields, config, index, placeholderHints) {
  let html = '';

  for (const field of fields) {
    const value = config[field.name] ?? '';
    const component = getComponent(field.field_type);

    const options = {
      placeholderHints,
      schema: {},
    };

    html += component.render(field, value, index, options);
  }

  return html;
}

/**
 * Renders a complete step card HTML string for one step
 * @param {Object} step - Step object: { agent_type: string, config: object }
 * @param {number} index - Step index (0-based position in pipeline)
 * @param {Array<Object>} agentList - Array of { name, label } for agent type selector
 * @param {Array<Object>} fields - Field definitions from schema (may be empty if no agent selected)
 * @param {Array<string>} placeholderHints - Placeholder hint strings
 * @param {Object} schema - Full schema object mapping agent_type to field definitions
 * @returns {string} HTML string of complete step card (without wrapper div)
 */
export function renderStepCard(step, index, agentList, fields, placeholderHints, schema) {
  const agentSelector = renderAgentSelector(step, index, agentList);

  // Render fields only if agent type is selected
  let fieldsHtml = '';
  if (step.agent_type && fields && fields.length > 0) {
    fieldsHtml = renderStepFields(fields, step.config, index, placeholderHints, schema);
  }

  return `
    <div class="step-header">
      <strong>Step ${index + 1}</strong>
      <div class="step-move-buttons">
        <button type="button" class="sm" title="Move up">↑</button>
        <button type="button" class="sm" title="Move down">↓</button>
      </div>
      ${agentSelector}
      <button type="button" class="sm danger remove-step">Remove</button>
    </div>
    <div class="step-fields" id="step-fields-${index}">${fieldsHtml}</div>
  `;
}
