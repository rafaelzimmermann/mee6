# Phase 8: Template Refactoring — Switchover Plan

## Overview

This document provides a precise surgical plan for replacing the working inline script in `pipeline_editor.html` with the module system built across Phases 1–7.

**Risk Assessment:** HIGH - This is the only phase that modifies a file the app currently depends on.
**Rollback Time:** < 30 seconds (git checkout)
**Verification:** Comprehensive test coverage (394 tests, 97.35% line coverage)

---

## SECTION 1 — Config Object Shape

### JavaScript object to inject into template

```javascript
<script type="module">
  import { initializePipelineEditor } from '/static/js/pipeline-editor.js';

  // API client implementation
  const apiClient = {
    fetchSchemas: async () => {
      const resp = await fetch('/api/v1/agents/fields/batch');
      return resp.json();
    }
  };

  // Configuration object
  const config = {
    pipeline: {
      id: {{ 'null' if not pipeline else '"' ~ pipeline.id ~ '"' }},
      name: {{ 'null' if not pipeline else '"' ~ pipeline.name ~ '"' }},
      steps: {{ initial_pipeline_json | safe }}
    },
    agentList: {{ plugin_list_json | safe }},
    schemas: {{ schemas_json | safe }}, // Pre-loaded or fetched on demand
    placeholderHints: {{ placeholder_hints_json | safe }},
    apiClient: apiClient
  };

  // Initialize editor
  const { state, rerenderAll, rerenderStep } = initializePipelineEditor(config);
</script>
```

### Template Variable Mapping

| Template Variable | Config Field | Notes |
|------------------|--------------|-------|
| `pipeline.id` | `config.pipeline.id` | `null` for new pipeline, string for edit |
| `pipeline.name` | `config.pipeline.name` | `null` or string |
| `initial_pipeline_json` | `config.pipeline.steps` | Array of step objects |
| `plugin_list_json` | `config.agentList` | Array of { name, label } |
| `schemas_json` | `config.schemas` | Pre-loaded schemas (if available) |
| `placeholder_hints_json` | `config.placeholderHints` | Array of hint strings |

### Important Notes

1. **Schemas:** The template may pre-load schemas via `schemas_json`, or they may be fetched on demand. Check template:
   - If `schemas_json` exists: Use it in config
   - If not: Set `schemas: {}` and let `fetchSchemas()` load them

2. **Pipeline object shape:**
   - For new pipeline: `{ id: null, name: null, steps: [] }`
   - For edit: `{ id: "123", name: "My Pipeline", steps: [...] }`

3. **API client:** Must be inline function to avoid import issues
   - `fetchSchemas()`: Returns Promise resolving to schema object
   - Other methods (createPipeline, updatePipeline) are imported from `api-client.js` by event handlers

---

## SECTION 2 — Functions to Remove

### Inline Template Functions → Module Ownership

| Template Function | Line # | Owning Module | Module Function |
|------------------|--------|---------------|-----------------|
| `loadAllSchemas()` | 41-44 | api-client.js | `fetchSchemas()` |
| `esc()` | 48-50 | utils/esc.js | `esc()` |
| `renderFields()` | 52-117 | field-renderer.js | `renderStepFields()` |
| `buildCardHTML()` | 121-138 | step-renderer.js | `renderStepCard()` |
| `addStep()` | 140-156 | event-handlers.js | `handleAddStep()` |
| `collectConfigs()` | 158-167 | state-manager.js | `getPipeline()` (implicit via state) |
| `rebuildSteps()` | 169-175 | pipeline-renderer.js | `renderPipeline()` |
| `validateMemorySteps()` | 201-215 | validator.js | `validatePipeline()` |
| `showBanner()` | 219-225 | pipeline-editor.js | `showBanner()` |
| `savePipeline()` | 227-264 | event-handlers.js | `handleSave()` |
| `initializeSteps()` | 268-275 | pipeline-editor.js | `initializePipelineEditor()` |
| `moveStepUp()` | 279-285 | event-handlers.js | `handleMoveUp()` |
| `moveStepDown()` | 287-293 | event-handlers.js | `handleMoveDown()` |

**Total functions to remove:** 13

---

## SECTION 3 — Global Variables to Remove

### Inline Template Global Variables → State Fields

| Template Variable | Line # | State Field | Notes |
|-------------------|--------|-------------|-------|
| `AGENT_PLUGINS` | 32 | `state.agentList` | Array of { name, label } |
| `PLACEHOLDER_HINTS` | 33 | `state.placeholderHints` | Array of strings |
| `initialPipeline` | 34 | `state.pipeline` | Pipeline object |
| `steps` | 35 | `state.pipeline.steps` | Array of step objects |
| `isSaving` | 36 | Internal to handleSave | No longer needed |
| `ALL_SCHEMAS` | 37 | `state.schemas` | Schema object |

**Total global variables to remove:** 6

---

## SECTION 4 — Event Handlers to Remove

### Inline Event Handlers → Event Delegation

| Element | Handler Attribute | Line # | Event Delegation Target |
|---------|-------------------|--------|-------------------------|
| + Add step button | `onclick="addStep()"` | 26 | `#add-step-btn` click → `handleAddStep()` |
| Save button | `onclick="savePipeline()"` | 27 | `#save-btn` click → `handleSave()` |
| Move up button | `onclick="moveStepUp(${idx})"` | 130 | `[title="Move up"]` click → `handleMoveUp()` |
| Move down button | `onclick="moveStepDown(${idx})"` | 131 | `[title="Move down"]` click → `handleMoveDown()` |
| Remove button | None (uses delegation) | 134 | `.remove-step` click → `handleRemoveStep()` |
| Agent select | `onchange="..."` | 179-186 | `.agent-select` change → `handleAgentTypeChange()` |
| Field inputs | None (uses delegation) | Various | Field change → `handleFieldChange()` |
| Field inputs | None (uses delegation) | Various | Field blur → `handleFieldBlur()` |
| Pipeline name | None (uses delegation) | 16 | `#pipeline-name` input → `handlePipelineNameChange()` |

### HTML Changes Required

**Lines 26-27 (button elements):**
```html
<!-- Before -->
<button type="button" onclick="addStep()">+ Add step</button>
<button type="button" id="save-btn" onclick="savePipeline()">Save pipeline</button>

<!-- After -->
<button type="button" id="add-step-btn">+ Add step</button>
<button type="button" id="save-btn">Save pipeline</button>
```

**Line 134 (remove button):** No change needed (already has class for delegation)

**Lines 130-131 (move buttons):**
```html
<!-- Before -->
<button type="button" class="sm" onclick="moveStepUp(${idx})" title="Move up">↑</button>
<button type="button" class="sm" onclick="moveStepDown(${idx})" title="Move down">↓</button>

<!-- After -->
<button type="button" class="sm" title="Move up">↑</button>
<button type="button" class="sm" title="Move down">↓</button>
```

**Note:** The `onclick` attributes will be removed in Step 7 of switchover sequence.

---

## SECTION 5 — Switchover Sequence

### Pre-Switchover Verification

**Before starting, verify:**
- [ ] All 394 JavaScript tests pass
- [ ] All 3 pipeline editor Python tests pass
- [ ] Git status is clean
- [ ] Current working tree committed as "Phase 7 complete — pre-Phase 8 baseline"

### Step-by-Step Switchover

#### Step 1 — Commit baseline state

```bash
git add -A
git commit -m "Phase 7 complete — pre-Phase 8 baseline

- Coverage: 97.35% lines, 84.23% branches
- Tests: 394 passing
- Bug fixed: validator.js optional chaining
- All Phase 7 objectives met"
```

#### Step 2 — Add module script to template

Insert after line 29 (after `</form>` tag, before `<script>`):

```html
<script type="module" src="/static/js/pipeline-editor.js"></script>
```

**Location:** Line 30 (new line)

#### Step 3 — Add config JSON block

Insert after the module script tag (after line 30):

```html
<script type="module">
  import { initializePipelineEditor } from '/static/js/pipeline-editor.js';

  const apiClient = {
    fetchSchemas: async () => {
      const resp = await fetch('/api/v1/agents/fields/batch');
      if (!resp.ok) {
        throw new Error(`Failed to fetch schemas: ${resp.status}`);
      }
      return resp.json();
    }
  };

  const config = {
    pipeline: {
      id: {{ 'null' if not pipeline else '"' ~ pipeline.id ~ '"' }},
      name: {{ 'null' if not pipeline else '"' ~ pipeline.name ~ '"' }},
      steps: {{ initial_pipeline_json | safe }}
    },
    agentList: {{ plugin_list_json | safe }},
    schemas: {{ schemas_json | safe }},
    placeholderHints: {{ placeholder_hints_json | safe }},
    apiClient: apiClient
  };

  const { state, rerenderAll, rerenderStep } = initializePipelineEditor(config);
</script>
```

**Location:** Lines 31-54 (new lines)

**Verification:**
- Check Jinja2 syntax is valid
- Ensure quotes are properly escaped

#### Step 4 — Test: Page loads without JS errors

1. Start the application
2. Navigate to `/pipelines/new` (new pipeline page)
3. Open browser DevTools Console
4. **Expected:** No JavaScript errors
5. **Expected:** Steps container shows "Add step" button
6. **Expected:** Page is functional (can add steps)

**If errors occur:**
- Check import paths (`/static/js/pipeline-editor.js`)
- Check Jinja2 template syntax
- Check browser console for specific errors
- Use rollback plan if needed

#### Step 5 — Remove inline script block

**Delete lines 31-294** (everything from `const AGENT_PLUGINS` through `moveStepDown()` function)

**Before deletion:**
- Lines 1-30: HTML template
- Lines 31-294: Inline script
- Line 295: `{% endblock %}`

**After deletion:**
- Lines 1-30: HTML template
- Lines 31-54: Config block (added in Step 3)
- Line 55: `{% endblock %}`

**Total lines removed:** 264

**Verification:**
- Template still has valid Jinja2 syntax
- No leftover inline event handlers
- No leftover global variables

#### Step 6 — Test: All behaviors work via module system

**Manual test checklist:**

1. **New pipeline page:**
   - [ ] Page loads
   - [ ] "Add step" button present
   - [ ] Can add step
   - [ ] Can select agent type
   - [ ] Fields render correctly
   - [ ] Can fill in fields
   - [ ] Can remove step
   - [ ] Can move step up/down
   - [ ] Validation works on blur
   - [ ] Save button works
   - [ ] Success banner shows on save

2. **Edit pipeline page:**
   - [ ] Page loads with existing data
   - [ ] Steps pre-populated
   - [ ] Can modify steps
   - [ ] Can add/remove steps
   - [ ] Save updates correctly

3. **Edge cases:**
   - [ ] Empty pipeline (no steps) validation works
   - [ ] Missing required field validation works
   - [ ] Memory agent validation works
   - [ ] All field types work (text, textarea, select, checkbox, combobox, etc.)

**If any test fails:**
- Use rollback plan
- Investigate specific failure
- Fix issue in module system (not template)
- Retry switchover

#### Step 7 — Remove inline event handler attributes

**Update line 26:**
```html
<!-- Before -->
<button type="button" onclick="addStep()">+ Add step</button>

<!-- After -->
<button type="button" id="add-step-btn">+ Add step</button>
```

**Update line 27:**
```html
<!-- Before -->
<button type="button" id="save-btn" onclick="savePipeline()">Save pipeline</button>

<!-- After -->
<button type="button" id="save-btn">Save pipeline</button>
```

**Note:** Move up/down buttons already have correct attributes (no `onclick`, just `title`)

**Verification:**
- No `onclick` attributes remain
- No `onchange` attributes remain
- All buttons have correct IDs or classes

#### Step 8 — Test: All interactions still work

Repeat manual test checklist from Step 6.

**Critical verification:**
- [ ] Add step button works (delegation catches click)
- [ ] Save button works (delegation catches click)
- [ ] Move up/down buttons work (delegation catches click)
- [ ] Remove button works (delegation catches click)
- [ ] Agent select works (delegation catches change)
- [ ] Field inputs work (delegation catches input/change)
- [ ] Field validation works (delegation catches blur)

#### Step 9 — Remove any unused CSS (if applicable)

Check for CSS that was only used by removed inline JS:

```bash
grep -r "class=\"[^\"]*\"" mee6/web/templates/pipeline_editor.html
```

Compare with classes used by module system:
- `.step-card`
- `.step-header`
- `.step-fields`
- `.step-move-buttons`
- `.agent-select`
- `.remove-step`
- `.field-label`
- `.field-hint`
- `.field-error-message`
- `.has-error`
- `.save-banner`
- `.validation-summary`
- `.sm`
- `.danger`

**If CSS is unused, remove it:**
- Delete unused CSS rules from `mee6/web/static/style.css`
- Test to ensure no visual regressions

#### Step 10 — Final test: Full manual walkthrough

**Complete end-to-end test:**

1. Navigate to `/pipelines`
2. Click "New Pipeline"
3. Enter pipeline name
4. Add 3 steps
5. Configure each step with different agent types
6. Fill in required fields
7. Try to save without completing all fields (verify validation)
8. Complete all fields
9. Save pipeline (verify success)
10. Navigate back to pipelines list
11. Click to edit the pipeline just created
12. Verify all data is preserved
13. Modify steps (add, remove, move)
14. Save changes
15. Verify update successful

**Expected outcome:** All steps complete without errors

#### Step 11 — Run test suite

```bash
npm test -- --run
```

**Expected:** All 394 JavaScript tests pass

**Note:** Tests don't use the template directly, so this verifies module system still works.

#### Step 12 — Final commit

```bash
git add -A
git commit -m "Phase 8 complete — template refactoring done

- Replaced inline script with module system
- Added initializePipelineEditor() to template
- Removed 13 inline functions
- Removed 6 global variables
- Removed inline event handlers
- All behaviors verified manually
- 394/394 tests passing"
```

---

## SECTION 6 — Rollback Plan

### Immediate Rollback (< 30 seconds)

If any step fails and you need to revert:

```bash
# Option 1: Reset to baseline commit
git reset --hard <baseline-commit-hash>

# Option 2: Restore specific file
git checkout HEAD -- mee6/web/templates/pipeline_editor.html

# Option 3: Use stash
git stash
```

### Rollback Verification

After rollback:

1. Start application
2. Navigate to `/pipelines/new`
3. Verify old inline script version works
4. Verify all behaviors are functional

### Post-Rollback Investigation

After rollback, investigate the failure:

1. **Module system bug:** Fix in module file (not template)
2. **Config shape issue:** Adjust config object in Step 3
3. **Event delegation issue:** Fix in event-delegation.js or event-handlers.js
4. **CSS issue:** Update CSS to match new classes
5. **Browser compatibility issue:** Check ES modules support

### Re-Attempt Switchover

After fixing the issue:

1. Verify tests still pass
2. Start from Step 1 of switchover sequence
3. Proceed with caution
4. Test thoroughly at each step

---

## SECTION 7 — Risk Mitigation

### Known Risks

1. **Browser ES Module Support:**
   - **Risk:** Older browsers may not support ES modules
   - **Mitigation:** Application already uses ES modules (check existing code)
   - **Fallback:** None required if already using modules

2. **Jinja2 Template Errors:**
   - **Risk:** Syntax errors in config block
   - **Mitigation:** Test template rendering before deployment
   - **Detection:** Step 4 (test page loads)

3. **State Loss During Transition:**
   - **Risk:** Users might lose unsaved changes during switchover
   - **Mitigation:** Deploy during low-traffic period
   - **Warning:** Notify users of maintenance window

4. **Event Delegation Timing:**
   - **Risk:** DOM not fully loaded when delegation set up
   - **Mitigation:** Module system uses `DOMContentLoaded` implicitly
   - **Detection:** Step 6 (manual testing)

### Success Criteria

Phase 8 is successful when:

- [ ] All 33 behavioral parity items work identically
- [ ] All 394 JavaScript tests pass
- [ ] All 3 pipeline editor Python tests pass
- [ ] No JavaScript errors in browser console
- [ ] No visual regressions
- [ ] Performance is equal or better than before
- [ ] Code is maintainable and well-documented

---

## SECTION 8 — Post-Switchover Tasks

### Immediate (After successful switchover)

1. **Clean up unused code:**
   - Remove any commented-out code from template
   - Remove unused CSS rules
   - Remove unused imports from modules

2. **Update documentation:**
   - Update any inline comments in template
   - Update API documentation if needed
   - Update developer documentation

3. **Performance testing:**
   - Measure page load time
   - Measure time to render large pipelines
   - Compare to pre-switchover metrics

### Short-term (Within 1 week)

1. **Monitor for issues:**
   - Check error logs for JavaScript errors
   - Monitor user reports of issues
   - Gather feedback on new system

2. **Optimization:**
   - Analyze bundle size (if using bundler)
   - Optimize imports (tree-shaking)
   - Consider lazy loading schemas

### Long-term (Within 1 month)

1. **Feature enhancements:**
   - Add undo/redo functionality
   - Add keyboard shortcuts
   - Improve accessibility

2. **Code quality:**
   - Add JSDoc comments to all functions
   - Consider TypeScript migration
   - Set up automated code quality checks

---

## APPENDIX A — Template File Comparison

### Before (Lines 1-50)

```html
{% extends "base.html" %}
{% block title %}{{ "Edit" if pipeline else "New" }} Pipeline{% endblock %}
{% block content %}
<div class="page-header">
  <h1>{{ "Edit" if pipeline else "New" }} Pipeline</h1>
  <a href="/pipelines" class="btn secondary">Return to Pipelines</a>
</div>

<div id="save-banner" style="display:none" class="save-banner"></div>
<div id="validation-banner" class="validation-summary" style="display:none"></div>

<form id="pipeline-form">
  <div class="pipeline-name-row">
    <label>
      Name
      <input type="text" id="pipeline-name"
             value="{{ pipeline.name if pipeline else '' }}"
             placeholder="My pipeline" required>
    </label>
  </div>

  <h2>Steps</h2>
  <div id="steps-container"></div>

  <div class="pipeline-actions">
    <button type="button" onclick="addStep()">+ Add step</button>
    <button type="button" id="save-btn" onclick="savePipeline()">Save pipeline</button>
  </div>
</form>

<script>
const AGENT_PLUGINS = {{ plugin_list_json | safe }};
const PLACEHOLDER_HINTS = {{ placeholder_hints_json | safe }};
const initialPipeline = {{ initial_pipeline_json | safe }};
let steps = [];
let isSaving = false;
let ALL_SCHEMAS = {};

// ... rest of inline script (lines 41-294)
</script>
{% endblock %}
```

### After (Expected)

```html
{% extends "base.html" %}
{% block title %}{{ "Edit" if pipeline else "New" }} Pipeline{% endblock %}
{% block content %}
<div class="page-header">
  <h1>{{ "Edit" if pipeline else "New" }} Pipeline</h1>
  <a href="/pipelines" class="btn secondary">Return to Pipelines</a>
</div>

<div id="save-banner" style="display:none" class="save-banner"></div>
<div id="validation-banner" class="validation-summary" style="display:none"></div>

<form id="pipeline-form">
  <div class="pipeline-name-row">
    <label>
      Name
      <input type="text" id="pipeline-name"
             value="{{ pipeline.name if pipeline else '' }}"
             placeholder="My pipeline" required>
    </label>
  </div>

  <h2>Steps</h2>
  <div id="steps-container"></div>

  <div class="pipeline-actions">
    <button type="button" id="add-step-btn">+ Add step</button>
    <button type="button" id="save-btn">Save pipeline</button>
  </div>
</form>

<script type="module" src="/static/js/pipeline-editor.js"></script>
<script type="module">
  import { initializePipelineEditor } from '/static/js/pipeline-editor.js';

  const apiClient = {
    fetchSchemas: async () => {
      const resp = await fetch('/api/v1/agents/fields/batch');
      if (!resp.ok) {
        throw new Error(`Failed to fetch schemas: ${resp.status}`);
      }
      return resp.json();
    }
  };

  const config = {
    pipeline: {
      id: {{ 'null' if not pipeline else '"' ~ pipeline.id ~ '"' }},
      name: {{ 'null' if not pipeline else '"' ~ pipeline.name ~ '"' }},
      steps: {{ initial_pipeline_json | safe }}
    },
    agentList: {{ plugin_list_json | safe }},
    schemas: {{ schemas_json | safe }},
    placeholderHints: {{ placeholder_hints_json | safe }},
    apiClient: apiClient
  };

  const { state, rerenderAll, rerenderStep } = initializePipelineEditor(config);
</script>
{% endblock %}
```

---

## APPENDIX B — Verification Checklist

### Pre-Switchover

- [ ] All Phase 7 objectives complete
- [ ] 394/394 tests passing
- [ ] 3/3 pipeline editor Python tests passing
- [ ] Git status clean
- [ ] Baseline commit created
- [ ] Rollback plan understood
- [ ] Team notified of switchover

### During Switchover

- [ ] Step 1: Baseline committed
- [ ] Step 2: Module script added
- [ ] Step 3: Config block added
- [ ] Step 4: Page loads without errors
- [ ] Step 5: Inline script removed
- [ ] Step 6: All behaviors work
- [ ] Step 7: Inline handlers removed
- [ ] Step 8: All interactions work
- [ ] Step 9: Unused CSS removed
- [ ] Step 10: Full walkthrough successful
- [ ] Step 11: Test suite passes
- [ ] Step 12: Final commit made

### Post-Switchover

- [ ] No JavaScript errors in console
- [ ] All behaviors work as expected
- [ ] Performance acceptable
- [ ] No user-reported issues within 24 hours
- [ ] Documentation updated
- [ ] Post-mortem completed (if issues occurred)

---

**Document Version:** 1.0
**Created:** 2026-03-14
**Author:** Phase 7 Completion
**Status:** Ready for Phase 8 Execution
