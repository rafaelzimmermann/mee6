import { useForm, Controller } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { usePipelines } from "../../hooks/usePipelines";
import { whatsappApi } from "../../api/whatsapp";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { CronPreview } from "./CronPreview";
import type { Trigger, WhatsAppGroup } from "../../api/types";

type TriggerType = "cron" | "whatsapp" | "wa_group";

interface TriggerFormValues {
  pipeline_id: string;
  trigger_type: TriggerType;
  cron_expr: string;
  phone: string;
  group_jid: string;
  enabled: boolean;
}

interface TriggerFormProps {
  onSubmit: (data: Partial<Trigger>) => void;
  isSubmitting: boolean;
}

function GroupJidSelect({ error, fieldProps }: { error?: string; fieldProps: any }) {
  const { data: groups, isLoading } = useQuery({
    queryKey: ["whatsapp_groups"],
    queryFn: whatsappApi.groups,
  });

  const groupOptions = (groups ?? []).map((g: WhatsAppGroup) => ({
    value: g.jid,
    label: g.label || g.name,
  }));

  return (
    <Select
      id="group_jid"
      label="Group"
      options={[
        { value: "", label: isLoading ? "Loading groups..." : "Select group…" },
        ...groupOptions,
      ]}
      error={error}
      {...fieldProps}
    />
  );
}

export function TriggerForm({ onSubmit, isSubmitting }: TriggerFormProps) {
  const { list: pipelineList } = usePipelines();

  const { control, watch, handleSubmit, formState: { errors } } = useForm<TriggerFormValues>({
    defaultValues: {
      pipeline_id: "",
      trigger_type: "cron",
      cron_expr: "",
      phone: "",
      group_jid: "",
      enabled: true,
    },
  });

  const triggerType = watch("trigger_type");
  const cronExpr = watch("cron_expr");

  const pipelineOptions = (pipelineList.data ?? []).map((p) => ({
    value: p.id,
    label: p.name,
  }));

  function handleFormSubmit(values: TriggerFormValues) {
    const config: Record<string, string> = {};
    if (values.trigger_type === "whatsapp") config.phone = values.phone;
    if (values.trigger_type === "wa_group") config.group_jid = values.group_jid;

    onSubmit({
      pipeline_id: values.pipeline_id,
      trigger_type: values.trigger_type,
      cron_expr: values.trigger_type === "cron" ? values.cron_expr : undefined,
      config,
      enabled: values.enabled,
    });
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)}>
      <Controller
        name="trigger_type"
        control={control}
        rules={{ required: true }}
        render={({ field }) => (
          <Select
            id="trigger_type"
            label="Trigger Type"
            options={[
              { value: "cron", label: "Cron Schedule" },
              { value: "whatsapp", label: "WhatsApp DM" },
              { value: "wa_group", label: "WhatsApp Group" },
            ]}
            error={errors.trigger_type ? "Required" : undefined}
            {...field}
          />
        )}
      />

      <Controller
        name="pipeline_id"
        control={control}
        rules={{ required: "Pipeline is required" }}
        render={({ field }) => (
          <Select
            id="pipeline_id"
            label="Pipeline"
            options={[{ value: "", label: "Select pipeline…" }, ...pipelineOptions]}
            error={errors.pipeline_id?.message}
            {...field}
          />
        )}
      />

      {triggerType === "cron" && (
        <>
          <Controller
            name="cron_expr"
            control={control}
            rules={{ required: "Cron expression is required" }}
            render={({ field }) => (
              <Input
                id="cron_expr"
                label="Cron Expression"
                placeholder="0 8 * * *"
                error={errors.cron_expr?.message}
                {...field}
              />
            )}
          />
          <CronPreview expression={cronExpr} />
        </>
      )}

      {triggerType === "whatsapp" && (
        <Controller
          name="phone"
          control={control}
          rules={{ required: "Phone number is required" }}
          render={({ field }) => (
            <Input
              id="phone"
              label="Phone Number"
              type="tel"
              placeholder="+15550001234"
              error={errors.phone?.message}
              {...field}
            />
          )}
        />
      )}

      {triggerType === "wa_group" && (
        <Controller
          name="group_jid"
          control={control}
          rules={{ required: "Group is required" }}
          render={({ field }) => (
            <GroupJidSelect error={errors.group_jid?.message} fieldProps={field} />
          )}
        />
      )}

      <Controller
        name="enabled"
        control={control}
        render={({ field }) => (
          <label>
            <input
              type="checkbox"
              checked={field.value}
              onChange={(e) => field.onChange(e.target.checked)}
            />
            {" "}Enabled
          </label>
        )}
      />

      <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
        Create Trigger
      </Button>
    </form>
  );
}
