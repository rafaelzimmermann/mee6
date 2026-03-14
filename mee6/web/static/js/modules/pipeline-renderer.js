/**
 * Pipeline Renderer
 * Renders full list of step cards
 * Delegates to step-renderer.js for each step
 */
import { renderStepCard } from './step-renderer.js';

/**
 * Renders all step cards as a single HTML string
 * @param {Array<Object>} steps - Array of step objects: [{ agent_type, config }, ...]
 * @param {Array<Object>} agentList - Array of { name, label } for agent type selector
 * @param {Object} schema - Schema object mapping agent_type to field definitions
 * @param {Array<string>} placeholderHints - Placeholder hint strings
 * @returns {string} HTML string of all step cards
 */
export function renderPipeline(steps, agentList, schema, placeholderHints) {
  return steps.map((step, index) => {
    const fields = step.agent_type ? schema[step.agent_type] || [] : [];
    return renderStepCard(step, index, agentList, fields, placeholderHints, schema);
  }).join('');
}

/**
 * Renders a single step by index — used for targeted re-renders
 * @param {Object} step - Step object: { agent_type, config }
 * @param {number} index - Step index (0-based)
 * @param {Array<Object>} agentList - Array of { name, label }
 * @param {Object} schema - Schema object mapping agent_type to field definitions
 * @param {Array<string>} placeholderHints - Placeholder hint strings
 * @returns {string} HTML string of single step card
 */
export function renderStep(step, index, agentList, schema, placeholderHints) {
  const fields = step.agent_type ? schema[step.agent_type] || [] : [];
  return renderStepCard(step, index, agentList, fields, placeholderHints, schema);
}
