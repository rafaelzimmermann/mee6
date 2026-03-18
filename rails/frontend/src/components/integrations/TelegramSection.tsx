import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { telegramApi } from "../../api/integrations/telegram";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardHeader, CardBody } from "../ui/Card";
import { Input } from "../ui/Input";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { showSuccess, showError } from "../../lib/toast";

function statusBadgeVariant(status: string) {
  if (status === "connected") return "success" as const;
  if (status === "error") return "error" as const;
  return "neutral" as const;
}

export function TelegramSection() {
  const queryClient = useQueryClient();

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ["telegram_status"],
    queryFn: telegramApi.status,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "connected" ? false : 5_000;
    },
  });

  const { data: settingsData } = useQuery({
    queryKey: ["telegram_settings"],
    queryFn: telegramApi.settings,
  });

  const connectMutation = useMutation({
    mutationFn: telegramApi.connect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["telegram_status"] });
      showSuccess("Connect initiated");
    },
    onError: (err: Error) => showError(err.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: telegramApi.disconnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["telegram_status"] });
      showSuccess("Disconnected");
    },
    onError: (err: Error) => showError(err.message),
  });

  if (statusLoading) return <LoadingSpinner />;

  return (
    <div>
      <h2>Telegram</h2>

      <Card>
        <CardHeader>Connection</CardHeader>
        <CardBody>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <Badge variant={statusBadgeVariant(statusData?.status ?? "disconnected")}>
              {statusData?.status ?? "disconnected"}
            </Badge>
            {statusData?.status !== "connected" && (
              <Button size="sm" onClick={() => connectMutation.mutate()} loading={connectMutation.isPending}>
                Connect
              </Button>
            )}
            {statusData?.status === "connected" && (
              <Button size="sm" variant="danger" onClick={() => disconnectMutation.mutate()} loading={disconnectMutation.isPending}>
                Disconnect
              </Button>
            )}
          </div>
          {statusData?.bot && (
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
              Connected as <strong>@{statusData.bot.username}</strong> ({statusData.bot.first_name})
            </p>
          )}
        </CardBody>
      </Card>

      <BotTokenCard botToken={settingsData?.bot_token ?? ""} />
    </div>
  );
}

function BotTokenCard({ botToken }: { botToken: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(botToken);

  const updateMutation = useMutation({
    mutationFn: (token: string) => telegramApi.updateSettings({ bot_token: token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["telegram_settings"] });
      showSuccess("Bot token saved");
      setEditing(false);
    },
    onError: (err: Error) => showError(err.message),
  });

  return (
    <Card className="mt-4">
      <CardHeader>Bot Token</CardHeader>
      <CardBody>
        {editing ? (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <Input
              id="bot_token"
              label="Bot Token"
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="123456:ABC-DEF..."
            />
            <Button size="sm" onClick={() => updateMutation.mutate(value)} loading={updateMutation.isPending}>
              Save
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              {botToken ? "••••••••••••••••" : "Not configured — get a token from @BotFather"}
            </span>
            <Button size="sm" variant="secondary" onClick={() => { setValue(botToken); setEditing(true); }}>
              {botToken ? "Edit" : "Set Token"}
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
