class WhatsAppGroupSerializer < Blueprinter::Base
  identifier :jid
  fields :name, :label
end
