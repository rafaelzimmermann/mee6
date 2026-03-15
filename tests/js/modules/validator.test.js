import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import * as validator from '/home/spike/workspace/mee6/mee6/web/static/js/modules/validator.js';

describe('ValidationError', () => {
  it('sets all four properties correctly', () => {
    const err = new validator.ValidationError('prompt', 0, 'textarea', 'Prompt is required');
    expect(err.fieldName).toBe('prompt');
    expect(err.stepIndex).toBe(0);
    expect(err.fieldType).toBe('textarea');
    expect(err.message).toBe('Prompt is required');
  });

  it('properties are accessible', () => {
    const err = new validator.ValidationError('agent_type', 1, 'select', 'Agent type is required');
    expect(err.fieldName).toEqual(expect.any(String));
    expect(err.stepIndex).toEqual(expect.any(Number));
    expect(err.fieldType).toEqual(expect.any(String));
    expect(err.message).toEqual(expect.any(String));
  });
});

describe('validateField', () => {
  describe('text field', () => {
    it('rejects empty string when required', () => {
      const field = { name: 'prompt', label: 'Prompt', field_type: 'text', required: true };
      expect(validator.validateField(field, '')).toBe('Prompt is required');
    });

    it('rejects whitespace-only when required', () => {
      const field = { name: 'prompt', label: 'Prompt', field_type: 'text', required: true };
      expect(validator.validateField(field, '   ')).toBe('Prompt is required');
    });

    it('accepts non-empty when required', () => {
      const field = { name: 'prompt', label: 'Prompt', field_type: 'text', required: true };
      expect(validator.validateField(field, 'Hello world')).toBe(null);
    });

    it('accepts empty when not required', () => {
      const field = { name: 'prompt', label: 'Prompt', field_type: 'text', required: false };
      expect(validator.validateField(field, '')).toBe(null);
    });
  });

  describe('textarea field', () => {
    it('rejects empty string when required', () => {
      const field = { name: 'prompt', label: 'Prompt', field_type: 'textarea', required: true };
      expect(validator.validateField(field, '')).toBe('Prompt is required');
    });

    it('rejects whitespace-only when required', () => {
      const field = { name: 'prompt', label: 'Prompt', field_type: 'textarea', required: true };
      expect(validator.validateField(field, '   ')).toBe('Prompt is required');
    });

    it('accepts non-empty when required', () => {
      const field = { name: 'prompt', label: 'Prompt', field_type: 'textarea', required: true };
      expect(validator.validateField(field, 'Hello world')).toBe(null);
    });

    it('accepts empty when not required', () => {
      const field = { name: 'prompt', label: 'Prompt', field_type: 'textarea', required: false };
      expect(validator.validateField(field, '')).toBe(null);
    });
  });

  describe('select field', () => {
    it('rejects empty string when required', () => {
      const field = { name: 'model', label: 'Model', field_type: 'select', required: true };
      expect(validator.validateField(field, '')).toBe('Model is required');
    });

    it('rejects null when required', () => {
      const field = { name: 'model', label: 'Model', field_type: 'select', required: true };
      expect(validator.validateField(field, null)).toBe('Model is required');
    });

    it('rejects undefined when required', () => {
      const field = { name: 'model', label: 'Model', field_type: 'select', required: true };
      expect(validator.validateField(field, undefined)).toBe('Model is required');
    });

    it('accepts valid value when required', () => {
      const field = { name: 'model', label: 'Model', field_type: 'select', required: true };
      expect(validator.validateField(field, 'gpt-4')).toBe(null);
    });

    it('accepts empty when not required', () => {
      const field = { name: 'model', label: 'Model', field_type: 'select', required: false };
      expect(validator.validateField(field, '')).toBe(null);
    });
  });

  describe('combobox field', () => {
    it('rejects empty string when required', () => {
      const field = { name: 'target', label: 'Target', field_type: 'combobox', required: true };
      expect(validator.validateField(field, '')).toBe('Target is required');
    });

    it('rejects whitespace-only when required', () => {
      const field = { name: 'target', label: 'Target', field_type: 'combobox', required: true };
      expect(validator.validateField(field, '   ')).toBe('Target is required');
    });

    it('accepts non-empty when required', () => {
      const field = { name: 'target', label: 'Target', field_type: 'combobox', required: true };
      expect(validator.validateField(field, '@user')).toBe(null);
    });

    it('accepts empty when not required', () => {
      const field = { name: 'target', label: 'Target', field_type: 'combobox', required: false };
      expect(validator.validateField(field, '')).toBe(null);
    });
  });

  describe('group_select field', () => {
    it('rejects empty string when required', () => {
      const field = { name: 'group', label: 'Group', field_type: 'group_select', required: true };
      expect(validator.validateField(field, '')).toBe('Group is required');
    });

    it('rejects null when required', () => {
      const field = { name: 'group', label: 'Group', field_type: 'group_select', required: true };
      expect(validator.validateField(field, null)).toBe('Group is required');
    });

    it('accepts valid value when required', () => {
      const field = { name: 'group', label: 'Group', field_type: 'group_select', required: true };
      expect(validator.validateField(field, 'group123')).toBe(null);
    });

    it('accepts empty when not required', () => {
      const field = { name: 'group', label: 'Group', field_type: 'group_select', required: false };
      expect(validator.validateField(field, '')).toBe(null);
    });
  });

  describe('calendar_select field', () => {
    it('rejects empty string when required', () => {
      const field = { name: 'calendar', label: 'Calendar', field_type: 'calendar_select', required: true };
      expect(validator.validateField(field, '')).toBe('Calendar is required');
    });

    it('rejects null when required', () => {
      const field = { name: 'calendar', label: 'Calendar', field_type: 'calendar_select', required: true };
      expect(validator.validateField(field, null)).toBe('Calendar is required');
    });

    it('accepts valid value when required', () => {
      const field = { name: 'calendar', label: 'Calendar', field_type: 'calendar_select', required: true };
      expect(validator.validateField(field, 'primary')).toBe(null);
    });

    it('accepts empty when not required', () => {
      const field = { name: 'calendar', label: 'Calendar', field_type: 'calendar_select', required: false };
      expect(validator.validateField(field, '')).toBe(null);
    });
  });

  describe('checkbox field', () => {
    it('rejects non-on value when required', () => {
      const field = { name: 'read_memory', label: 'Read Memory', field_type: 'checkbox', required: true };
      expect(validator.validateField(field, '')).toBe('Read Memory is required');
    });

    it('accepts on value when required', () => {
      const field = { name: 'read_memory', label: 'Read Memory', field_type: 'checkbox', required: true };
      expect(validator.validateField(field, 'on')).toBe(null);
    });

    it('accepts anything when not required', () => {
      const field = { name: 'read_memory', label: 'Read Memory', field_type: 'checkbox', required: false };
      expect(validator.validateField(field, '')).toBe(null);
      expect(validator.validateField(field, 'on')).toBe(null);
    });
  });
});

  describe('text field edge cases', () => {
    it('rejects null when required', () => {
      const field = { name: 'prompt', label: 'Prompt', field_type: 'text', required: true };
      expect(validator.validateField(field, null)).toBe('Prompt is required');
    });

    it('rejects undefined when required', () => {
      const field = { name: 'prompt', label: 'Prompt', field_type: 'text', required: true };
      expect(validator.validateField(field, undefined)).toBe('Prompt is required');
    });
  });

  describe('textarea field edge cases', () => {
    it('rejects null when required', () => {
      const field = { name: 'prompt', label: 'Prompt', field_type: 'textarea', required: true };
      expect(validator.validateField(field, null)).toBe('Prompt is required');
    });

    it('rejects undefined when required', () => {
      const field = { name: 'prompt', label: 'Prompt', field_type: 'textarea', required: true };
      expect(validator.validateField(field, undefined)).toBe('Prompt is required');
    });
  });

  describe('combobox field edge cases', () => {
    it('rejects null when required', () => {
      const field = { name: 'target', label: 'Target', field_type: 'combobox', required: true };
      expect(validator.validateField(field, null)).toBe('Target is required');
    });

    it('rejects undefined when required', () => {
      const field = { name: 'target', label: 'Target', field_type: 'combobox', required: true };
      expect(validator.validateField(field, undefined)).toBe('Target is required');
    });
  });

  describe('group_select field edge cases', () => {
    it('rejects undefined when required', () => {
      const field = { name: 'group', label: 'Group', field_type: 'group_select', required: true };
      expect(validator.validateField(field, undefined)).toBe('Group is required');
    });
  });

  describe('calendar_select field edge cases', () => {
    it('rejects undefined when required', () => {
      const field = { name: 'calendar', label: 'Calendar', field_type: 'calendar_select', required: true };
      expect(validator.validateField(field, undefined)).toBe('Calendar is required');
    });
  });

  describe('checkbox field edge cases', () => {
    it('rejects null when required', () => {
      const field = { name: 'read_memory', label: 'Read Memory', field_type: 'checkbox', required: true };
      expect(validator.validateField(field, null)).toBe('Read Memory is required');
    });

    it('rejects undefined when required', () => {
      const field = { name: 'read_memory', label: 'Read Memory', field_type: 'checkbox', required: true };
      expect(validator.validateField(field, undefined)).toBe('Read Memory is required');
    });
  });

describe('validateField — null/undefined safety', () => {
  const requiredText = { name: 'f', label: 'Field', field_type: 'text', required: true };
  const requiredSelect = { name: 'f', label: 'Model', field_type: 'select', required: true };

  it('handles null value without throwing', () => {
    expect(() => validator.validateField(requiredText, null)).not.toThrow();
  });
  it('treats null as empty for required text', () => {
    expect(validator.validateField(requiredText, null)).toBeTruthy();
  });
  it('handles undefined value without throwing', () => {
    expect(() => validator.validateField(requiredText, undefined)).not.toThrow();
  });
  it('handles null for required select without throwing', () => {
    expect(() => validator.validateField(requiredSelect, null)).not.toThrow();
  });
});

describe('validateStep', () => {
  const schemas = {
    llm_agent: [
      { name: 'prompt', label: 'Prompt', field_type: 'textarea', required: true },
      { name: 'model', label: 'Model', field_type: 'select', required: true }
    ],
    memory_agent: [
      { name: 'memory_label', label: 'Memory Label', field_type: 'select', required: true }
    ]
  };

  it('returns single error when no agent type', () => {
    const step = { agent_type: '', config: {} };
    const errors = validator.validateStep(step, 0, schemas);
    expect(errors).toHaveLength(1);
    expect(errors[0].fieldName).toBe('agent_type');
    expect(errors[0].stepIndex).toBe(0);
    expect(errors[0].message).toBe('Agent type is required');
  });

  it('returns error when memory_agent with empty memory_label', () => {
    const step = { agent_type: 'memory_agent', config: { memory_label: '' } };
    const errors = validator.validateStep(step, 0, schemas);
    expect(errors).toHaveLength(1);
    expect(errors[0].fieldName).toBe('memory_label');
    expect(errors[0].message).toBe('Memory Label is required');
  });

  it('no error when memory_agent with valid memory_label', () => {
    const step = { agent_type: 'memory_agent', config: { memory_label: 'customer_notes' } };
    const errors = validator.validateStep(step, 0, schemas);
    expect(errors).toHaveLength(0);
  });

  it('returns error when llm_agent with empty required text field', () => {
    const step = { agent_type: 'llm_agent', config: { prompt: '', model: 'gpt-4' } };
    const errors = validator.validateStep(step, 0, schemas);
    expect(errors).toHaveLength(1);
    expect(errors[0].fieldName).toBe('prompt');
  });

  it('no errors when llm_agent with all required fields filled', () => {
    const step = { agent_type: 'llm_agent', config: { prompt: 'Hello', model: 'gpt-4' } };
    const errors = validator.validateStep(step, 0, schemas);
    expect(errors).toHaveLength(0);
  });

  it('returns multiple errors when llm_agent with multiple empty required fields', () => {
    const step = { agent_type: 'llm_agent', config: { prompt: '', model: '' } };
    const errors = validator.validateStep(step, 0, schemas);
    expect(errors).toHaveLength(2);
    expect(errors.map(e => e.fieldName)).toEqual(['prompt', 'model']);
  });

  it('no field errors when unknown agent_type not in schema', () => {
    const step = { agent_type: 'unknown_agent', config: {} };
    const errors = validator.validateStep(step, 0, schemas);
    expect(errors).toHaveLength(0);
  });
});

describe('validatePipeline', () => {
  const schemas = {
    llm_agent: [
      { name: 'prompt', label: 'Prompt', field_type: 'textarea', required: true }
    ],
    memory_agent: [
      { name: 'memory_label', label: 'Memory Label', field_type: 'select', required: true }
    ]
  };

  it('returns one error when steps array is empty', () => {
    const pipeline = { id: null, name: 'Test', steps: [] };
    const errors = validator.validatePipeline(pipeline, schemas);
    expect(errors).toHaveLength(1);
    expect(errors[0].fieldName).toBe('steps');
    expect(errors[0].stepIndex).toBe(-1);
    expect(errors[0].message).toBe('Pipeline must have at least one step');
  });

  it('no errors when one valid step', () => {
    const pipeline = { id: null, name: 'Test', steps: [{ agent_type: 'memory_agent', config: { memory_label: 'customer_notes' } }] };
    const errors = validator.validatePipeline(pipeline, schemas);
    expect(errors).toHaveLength(0);
  });

  it('returns errors from one invalid step', () => {
    const pipeline = { id: null, name: 'Test', steps: [{ agent_type: '', config: {} }] };
    const errors = validator.validatePipeline(pipeline, schemas);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].stepIndex).toBe(0);
  });

  it('no errors when multiple steps all valid', () => {
    const pipeline = {
      id: null,
      name: 'Test',
      steps: [
        { agent_type: 'memory_agent', config: { memory_label: 'customer_notes' } },
        { agent_type: 'memory_agent', config: { memory_label: 'user_data' } }
      ]
    };
    const errors = validator.validatePipeline(pipeline, schemas);
    expect(errors).toHaveLength(0);
  });

  it('returns errors from invalid steps only', () => {
    const pipeline = {
      id: null,
      name: 'Test',
      steps: [
        { agent_type: '', config: {} },
        { agent_type: 'memory_agent', config: { memory_label: 'customer_notes' } },
        { agent_type: '', config: {} }
      ]
    };
    const errors = validator.validatePipeline(pipeline, schemas);
    expect(errors.length).toBeGreaterThan(0);
    const stepIndices = errors.map(e => e.stepIndex);
    expect(stepIndices).toContain(0);
    expect(stepIndices).toContain(2);
    expect(stepIndices).not.toContain(1);
  });

  it('two invalid steps return errors with correct stepIndex values', () => {
    const pipeline = {
      id: null,
      name: 'Test',
      steps: [
        { agent_type: '', config: {} },
        { agent_type: '', config: {} }
      ]
    };
    const errors = validator.validatePipeline(pipeline, schemas);
    expect(errors).toHaveLength(2);
    expect(errors[0].stepIndex).toBe(0);
    expect(errors[1].stepIndex).toBe(1);
  });
});


describe('validatePipeline — null safety', () => {
  it('handles null steps without throwing', () => {
    expect(() => validator.validatePipeline({ steps: null }, {})).not.toThrow();
  });
  it('handles undefined steps without throwing', () => {
    expect(() => validator.validatePipeline({}, {})).not.toThrow();
  });
  it('treats null steps as empty pipeline', () => {
    const errors = validator.validatePipeline({ steps: null }, {});
    expect(errors.some(e => e.message && e.message.includes('at least one step'))).toBe(true);
  });
});

  describe('validatePipeline edge cases', () => {
    it('handles undefined config gracefully (FIXED with optional chaining)', () => {
      const schemas = {
        llm_agent: [
          { name: 'prompt', label: 'Prompt', field_type: 'textarea', required: true }
        ]
      };
      const pipeline = {
        id: null,
        name: 'Test',
        steps: [
          { agent_type: 'llm_agent', config: undefined },
          { agent_type: 'memory_agent', config: { memory_label: 'customer_notes' } }
        ]
      };
      const errors = validator.validatePipeline(pipeline, schemas);
      expect(errors).toBeDefined();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.fieldName === 'prompt')).toBe(true);
    });
  });
describe('validateSingleField', () => {
  it('returns array (not a string)', () => {
    const fieldDef = { name: 'prompt', label: 'Prompt', field_type: 'text', required: true };
    const result = validator.validateSingleField('prompt', '', fieldDef, 0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns empty array when valid', () => {
    const fieldDef = { name: 'prompt', label: 'Prompt', field_type: 'text', required: true };
    const result = validator.validateSingleField('prompt', 'Hello', fieldDef, 0);
    expect(result).toHaveLength(0);
  });

  it('returns one ValidationError when invalid', () => {
    const fieldDef = { name: 'prompt', label: 'Prompt', field_type: 'text', required: true };
    const result = validator.validateSingleField('prompt', '', fieldDef, 0);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(validator.ValidationError);
  });

  it('ValidationError has correct properties', () => {
    const fieldDef = { name: 'prompt', label: 'Prompt', field_type: 'text', required: true };
    const result = validator.validateSingleField('prompt', '', fieldDef, 0);
    expect(result[0].fieldName).toBe('prompt');
    expect(result[0].stepIndex).toBe(0);
    expect(result[0].fieldType).toBe('text');
    expect(result[0].message).toBe('Prompt is required');
  });
});

describe('DOM feedback functions', () => {
  let dom;
  let container;

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><body>
      <input id="field-0-prompt" name="prompt">
      <input id="field-0-model" name="model">
      <div id="validation-banner"></div>
    </body>`);
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    container = dom.window.document.getElementById('validation-banner');
  });

  afterEach(() => {
    delete global.document;
    delete global.HTMLElement;
  });

  describe('displayFieldError', () => {
    it('creates span if not present', () => {
      validator.displayFieldError('prompt', 0, 'Prompt is required');
      const el = dom.window.document.getElementById('error-0-prompt');
      expect(el).not.toBeNull();
      expect(el.classList.contains('field-error-message')).toBe(true);
      expect(el.textContent).toBe('Prompt is required');
      expect(el.classList.contains('visible')).toBe(true);
    });

    it('updates existing span if already present', () => {
      const fieldEl = dom.window.document.getElementById('field-0-prompt');
      const span = dom.window.document.createElement('span');
      span.id = 'error-0-prompt';
      span.className = 'field-error-message';
      fieldEl.parentNode.insertBefore(span, fieldEl.nextSibling);

      validator.displayFieldError('prompt', 0, 'New error message');
      const el = dom.window.document.getElementById('error-0-prompt');
      expect(el.textContent).toBe('New error message');
      expect(el.classList.contains('visible')).toBe(true);
    });

    it('adds visible class', () => {
      validator.displayFieldError('prompt', 0, 'Error');
      const el = dom.window.document.getElementById('error-0-prompt');
      expect(el.classList.contains('visible')).toBe(true);
    });
  });

  describe('clearFieldError', () => {
    it('removes visible class', () => {
      validator.displayFieldError('prompt', 0, 'Error');
      validator.clearFieldError('prompt', 0);
      const el = dom.window.document.getElementById('error-0-prompt');
      expect(el.classList.contains('visible')).toBe(false);
    });
  });

  describe('displayValidationSummary', () => {
    it('hides container with empty array', () => {
      validator.displayValidationSummary([], container);
      expect(container.style.display).toBe('none');
    });

    it('shows correct count in heading', () => {
      const errors = [
        new validator.ValidationError('prompt', 0, 'textarea', 'Prompt is required'),
        new validator.ValidationError('model', 0, 'select', 'Model is required')
      ];
      validator.displayValidationSummary(errors, container);
      expect(container.innerHTML).toContain('Validation Errors (2)');
    });

    it('includes (Step 1) for stepIndex 0', () => {
      const errors = [new validator.ValidationError('prompt', 0, 'textarea', 'Error')];
      validator.displayValidationSummary(errors, container);
      expect(container.innerHTML).toContain('(Step 1)');
    });

    it('uses (Pipeline) for stepIndex -1', () => {
      const errors = [new validator.ValidationError('steps', -1, 'pipeline', 'No steps')];
      validator.displayValidationSummary(errors, container);
      expect(container.innerHTML).toContain('(Pipeline)');
    });

    it('displays container', () => {
      const errors = [new validator.ValidationError('prompt', 0, 'textarea', 'Error')];
      validator.displayValidationSummary(errors, container);
      expect(container.style.display).toBe('block');
    });
  });

  describe('highlightInvalidFields', () => {
    it('adds has-error to correct field elements', () => {
      const errors = [new validator.ValidationError('prompt', 0, 'textarea', 'Error')];
      validator.highlightInvalidFields(errors);
      const el = dom.window.document.getElementById('field-0-prompt');
      expect(el.classList.contains('has-error')).toBe(true);
    });

    it('does not add has-error to valid fields', () => {
      const errors = [new validator.ValidationError('prompt', 0, 'textarea', 'Error')];
      validator.highlightInvalidFields(errors);
      const el = dom.window.document.getElementById('field-0-model');
      expect(el.classList.contains('has-error')).toBe(false);
    });

    it('does not throw when field element missing from DOM', () => {
      const errors = [{ stepIndex: 0, fieldName: 'nonexistent', fieldType: 'text', message: 'Required' }];
      expect(() => validator.highlightInvalidFields(errors)).not.toThrow();
    });
    it('skips pipeline-level errors (stepIndex -1)', () => {
      const errors = [{ stepIndex: -1, fieldName: 'steps', fieldType: 'pipeline', message: 'Pipeline error' }];
      expect(() => validator.highlightInvalidFields(errors)).not.toThrow();
    });
  });

  describe('clearAllValidationUI', () => {
    beforeEach(() => {
      dom.window.document.getElementById('field-0-prompt').classList.add('has-error');
      dom.window.document.getElementById('field-0-model').classList.add('has-error');
      validator.displayFieldError('prompt', 0, 'Error');
      container.style.display = 'block';
    });

    it('removes all has-error classes', () => {
      validator.clearAllValidationUI();
      expect(dom.window.document.getElementById('field-0-prompt').classList.contains('has-error')).toBe(false);
      expect(dom.window.document.getElementById('field-0-model').classList.contains('has-error')).toBe(false);
    });

    it('hides all field-error-message elements', () => {
      validator.clearAllValidationUI();
      const el = dom.window.document.getElementById('error-0-prompt');
      expect(el.classList.contains('visible')).toBe(false);
    });

    it('hides validation banner', () => {
      validator.clearAllValidationUI();
      expect(container.style.display).toBe('none');
    });
  });
});
