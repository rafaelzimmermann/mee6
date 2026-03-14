// State manager for pipeline editor
export class PipelineEditorState {
  constructor() {
    this.pipeline = {
      id: null,
      name: '',
      steps: []
    };
    this.schemas = {};
    this.listeners = [];
  }
}

export const state = new PipelineEditorState();
