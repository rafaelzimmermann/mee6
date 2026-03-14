export function validateTriggerForm(formData) {
  const errors = [];

  if (!formData.pipeline_id || formData.pipeline_id.trim() === '') {
    errors.push('pipeline_id is required');
  }

  if (formData.trigger_type === 'cron') {
    if (!formData.cron_expr || formData.cron_expr.trim() === '') {
      errors.push('cron_expr is required for cron type');
    } else if (!/^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/.test(formData.cron_expr)) {
      errors.push('cron_expr must have 5 fields separated by spaces');
    }
  }

  if (formData.trigger_type === 'whatsapp') {
    if (!formData.phone || formData.phone.trim() === '') {
      errors.push('phone is required for whatsapp type');
    }
  }

  if (formData.trigger_type === 'wa_group') {
    if (!formData.group_jid || formData.group_jid.trim() === '') {
      errors.push('group_jid is required for wa_group type');
    }
  }

  return errors;
}

export function displayErrors(errors) {
  const container = document.getElementById('form-errors');
  if (!container) return;

  if (errors.length === 0) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  let ul = container.querySelector('ul');
  if (!ul) {
    ul = document.createElement('ul');
    container.appendChild(ul);
  }

  ul.innerHTML = errors.map(err => `<li>${err}</li>`).join('');
  container.style.display = 'block';
}

export function clearErrors() {
  const container = document.getElementById('form-errors');
  if (!container) return;

  container.style.display = 'none';
  container.innerHTML = '';
}
