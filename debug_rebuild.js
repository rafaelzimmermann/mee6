async function rebuildSteps() {
  console.log('Rebuilding steps...');
  document.getElementById('steps-container').innerHTML = '';
  const toAdd = [...steps];
  steps = [];
  
  for (const s of toAdd) {
    console.log('Adding step:', s);
    await addStep(s);
  }
  
  console.log('Step count after rebuild:', steps.length);
  updateStepNumbers();
}