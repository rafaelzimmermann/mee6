import { z } from "zod";

// Pipeline validation schema
export const pipelineSchema = z
  .object({
    name: z
      .string()
      .min(1, "Pipeline name is required")
      .max(100, "Pipeline name must be less than 100 characters")
      .trim(),
    steps: z
      .array(
        z.object({
          agent_type: z
            .string()
            .min(1, "Agent type is required")
            .trim(),
          config: z.record(z.string()).default({}),
        })
      )
      .min(1, "Pipeline must have at least one step"),
  })
  .refine(
    (data) => {
      // Additional validation: at least one step must have a valid agent type
      return data.steps.every((step) => step.agent_type.trim().length > 0);
    },
    {
      message: "All steps must have a valid agent type",
      path: ["steps"],
    }
  );

// Memory configuration validation schema
export const memoryConfigSchema = z.object({
  label: z
    .string()
    .min(1, "Label is required")
    .max(50, "Label must be less than 50 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Label can only contain letters, numbers, underscores, and hyphens"
    )
    .trim(),
  max_memories: z
    .number()
    .int("max_memories must be an integer")
    .positive("max_memories must be positive")
    .max(1000, "max_memories must be less than 1000")
    .default(20),
  ttl_hours: z
    .number()
    .int("ttl_hours must be an integer")
    .positive("ttl_hours must be positive")
    .max(87600, "ttl_hours must be less than 87600 (10 years)")
    .default(720),
  max_value_size: z
    .number()
    .int("max_value_size must be an integer")
    .min(0, "max_value_size cannot be negative")
    .max(100000, "max_value_size must be less than 100000")
    .default(2000),
});

// Trigger validation schema
export const triggerSchema = z.object({
  name: z
    .string()
    .min(1, "Trigger name is required")
    .max(100, "Trigger name must be less than 100 characters")
    .trim(),
  pipeline_id: z
    .string()
    .min(1, "Pipeline ID is required")
    .trim(),
  trigger_type: z.enum(["cron", "whatsapp", "manual"], {
    errorMap: () => ({ message: "Invalid trigger type" }),
  }),
  enabled: z.boolean().default(true),
  cron_expression: z.string().optional(),
});

// Type inference from schemas
export type PipelineInput = z.infer<typeof pipelineSchema>;
export type MemoryConfigInput = z.infer<typeof memoryConfigSchema>;
export type TriggerInput = z.infer<typeof triggerSchema>;
