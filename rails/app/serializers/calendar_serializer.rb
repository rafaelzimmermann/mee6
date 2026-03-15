class CalendarSerializer < Blueprinter::Base
  identifier :id
  fields :label, :calendar_id, :credentials_file, :created_at, :updated_at
end
