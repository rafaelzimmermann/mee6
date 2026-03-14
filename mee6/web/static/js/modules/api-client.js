export async function fetchSchemas() {
  const response = await fetch('/api/v1/agents/fields/batch', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch schemas: ${response.status} ${errorText}`);
  }

  return response.json();
}

export async function fetchPipeline(id) {
  const response = await fetch(`/pipelines/${id}`, {});

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch pipeline ${id}: ${response.status} ${errorText}`);
  }

  return response.json();
}

export async function createPipeline(pipeline) {
  const response = await fetch('/pipelines', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pipeline),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create pipeline: ${response.status} ${errorText}`);
  }

  return response.json();
}

export async function updatePipeline(pipeline) {
  const response = await fetch(`/pipelines/${pipeline.id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: pipeline.name,
      steps: pipeline.steps,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update pipeline: ${response.status} ${errorText}`);
  }

  return response.json();
}
