/**
 * Helper for defensive step copies
 */
export function copyStep(step) {
  return { agent_type: step.agent_type, config: { ...step.config } };
}
