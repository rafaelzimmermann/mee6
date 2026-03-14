const LABEL_REGEX = /^[a-zA-Z0-9_-]+$/;

export function validateMemoryForm(data) {
  const errors = [];
  if (!data.label || !data.label.trim()) errors.push('Label is required');
  else if (data.label.length > 50) errors.push('Label must be 50 characters or less');
  else if (!LABEL_REGEX.test(data.label)) errors.push('Label can only contain letters, numbers, underscores, and hyphens');
  if (!data.max_memories || data.max_memories <= 0) errors.push('Max memories must be a positive integer');
  if (!data.ttl_hours || data.ttl_hours <= 0) errors.push('TTL hours must be a positive integer');
  if (!data.max_value_size || data.max_value_size <= 0) errors.push('Max value size must be a positive integer');
  return errors;
}

export function validateCalendarForm(data) {
  const errors = [];
  if (!data.label || !data.label.trim()) errors.push('Label is required');
  if (!data.calendar_id || !data.calendar_id.trim()) errors.push('Calendar ID is required');
  return errors;
}

export function validatePhone(phone) {
  if (!phone || !phone.trim()) return ['Phone number is required'];
  return [];
}

export function displayErrors(containerId, errors) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!errors.length) { container.style.display = 'none'; container.innerHTML = ''; return; }
  let ul = container.querySelector('ul');
  if (!ul) { ul = document.createElement('ul'); container.appendChild(ul); }
  ul.innerHTML = errors.map(e => `<li>${e}</li>`).join('');
  container.style.display = 'block';
}

export function clearErrors(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.style.display = 'none';
  container.innerHTML = '';
}
