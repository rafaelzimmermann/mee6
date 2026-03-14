/**
 * State Manager - Centralized pipeline state with subscription system
 *
 * GLOBALS: AGENT_PLUGINS->agentList, PLACEHOLDER_HINTS->placeholderHints,
 * initialPipeline->pipeline, steps->pipeline.steps, ALL_SCHEMAS->schemas
 *
 * MUTATIONS: add/remove/move/setAgentType/updateField emit events
 * CRITICAL: setStepAgentType() resets config to {}
 */
import { copyStep } from '../utils/state-helpers.js';
export class PipelineEditorState {
  constructor() {
    this.pipeline = { id: null, name: '', steps: [] };
    this.schemas = {};
    this.schemasFetched = new Set();
    this.agentList = [];
    this.placeholderHints = [];
    this.subscribers = new Map();
  }
  initialize(config) {
    this.pipeline = { id: config.id ?? null, name: config.name ?? '',
      steps: config.steps ? config.steps.map(copyStep) : [] };
    this.agentList = config.agentList ? [...config.agentList] : [];
    this.placeholderHints = config.placeholderHints ? [...config.placeholderHints] : [];
    this.schemas = config.schemas ? { ...config.schemas } : {};
    if (config.schemas) {
      Object.keys(config.schemas).forEach(type => this.schemasFetched.add(type));
    }
    this.notify('initialized', this.getPipeline());
  }
  setPipelineName(name) { this.pipeline.name = name; this.notify('pipeline-updated', this.getPipeline()); }
  setPipeline(pipeline) {
    this.pipeline = { id: pipeline.id ?? null, name: pipeline.name ?? '',
      steps: pipeline.steps ? pipeline.steps.map(copyStep) : [] };
    this.notify('pipeline-updated', this.getPipeline());
  }
  setSchemas(schemas) {
    this.schemas = { ...schemas };
    Object.keys(schemas).forEach(type => this.schemasFetched.add(type));
    this.notify('schemas-loaded', schemas);
  }
  isSchemaFetched(agentType) { return this.schemasFetched.has(agentType); }
  setAgentList(agentList) { this.agentList = [...agentList]; }
  addStep() {
    this.pipeline.steps.push({ agent_type: '', config: {} });
    this.notify('steps-updated', this.getSteps());
  }
  removeStep(index) {
    if (index < 0 || index >= this.pipeline.steps.length)
      throw new Error(`removeStep: index ${index} out of bounds (0-${this.pipeline.steps.length - 1})`);
    this.pipeline.steps.splice(index, 1);
    this.notify('steps-updated', this.getSteps());
  }
  moveStepUp(index) {
    if (index <= 0) return;
    const s = this.pipeline.steps;
    [s[index], s[index - 1]] = [s[index - 1], s[index]];
    this.notify('steps-updated', this.getSteps());
  }
  moveStepDown(index) {
    if (index >= this.pipeline.steps.length - 1) return;
    const s = this.pipeline.steps;
    [s[index], s[index + 1]] = [s[index + 1], s[index]];
    this.notify('steps-updated', this.getSteps());
  }
  setStepAgentType(index, agentType) {
    const step = this.pipeline.steps[index];
    if (!step) throw new Error(`setStepAgentType: index ${index} out of bounds`);
    step.agent_type = agentType;
    step.config = {}; // CRITICAL: Reset on agent type change
    this.notify('step-updated', { index, step: copyStep(step) });
  }
  updateStepField(index, fieldName, value) {
    const step = this.pipeline.steps[index];
    if (!step) throw new Error(`updateStepField: index ${index} out of bounds`);
    step.config[fieldName] = value;
    this.notify('step-updated', { index, step: copyStep(step) });
  }
  getStep(index) {
    const step = this.pipeline.steps[index];
    return step ? copyStep(step) : null;
  }
  getSteps() { return this.pipeline.steps.map(copyStep); }
  getPipeline() { return { id: this.pipeline.id, name: this.pipeline.name, steps: this.pipeline.steps.map(copyStep) }; }
  getSchema(agentType) {
    if (!this.schemas[agentType]) return [];
    return this.schemas[agentType].map(field => ({ ...field }));
  }
  subscribe(event, callback) {
    if (!this.subscribers.has(event)) this.subscribers.set(event, []);
    this.subscribers.get(event).push(callback);
  }
  unsubscribe(event, callback) {
    if (!this.subscribers.has(event)) return;
    const cbs = this.subscribers.get(event);
    const idx = cbs.indexOf(callback);
    if (idx !== -1) cbs.splice(idx, 1);
  }
  notify(event, data) {
    if (!this.subscribers.has(event)) return;
    this.subscribers.get(event).forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error(`[StateManager] Subscriber error for event "${event}":`, err);
      }
    });
  }
}
