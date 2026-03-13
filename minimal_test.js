// Minimal working version of pipeline editor to test step configuration
function buildCardHTML(idx, selectedType) {
  const opts = ['<option value="">— select agent —</option>']
    .concat(AGENT_PLUGINS.map(p =>
      `<option value="${p.name}"${p.name === selectedType ? ' selected' : ''}>${p.label}</option>`
    )).join('');
  return `
    <div class="step-card" data-idx="${idx}">
      <div class="step-header">
        <strong>Step ${idx + 1}</strong>
        <select class="agent-select">${opts}</select>
        <button type="button" class="sm danger remove-step">Remove</button>
      </div>
      <div class="step-fields" id="step-fields-${idx}"></div>
    </div>
  `;
}

async function loadFields(idx, agentType, existingConfig) {
  console.log('Loading fields for index:', idx, 'agent:', agentType, 'config:', existingConfig);
  const container = document.getElementById(`step-fields-${idx}`);
  if (!agentType) { 
    container.innerHTML = ''; 
    return; 
  }
  const params = new URLSearchParams({
    step_index: idx,
    config: JSON.stringify(existingConfig),
  });
  console.log('Fetching fields from:', `/api/agents/${agentType}/fields?${params}`);
  const resp = await fetch(`/api/agents/${agentType}/fields?${params}`);
  container.innerHTML = await resp.text();
  console.log('Fields loaded for step', idx);
}