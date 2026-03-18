class TelegramChatSerializer < Blueprinter::Base
  identifier :chat_id
  fields :title, :chat_type, :label
end
