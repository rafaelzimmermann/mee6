require "rails_helper"

RSpec.describe WhatsAppSyncJob, type: :job do
  describe "#perform" do
    let(:client) { instance_double(::Integrations::WhatsAppClient) }

    before do
      allow(::Integrations::WhatsAppClient).to receive(:new).and_return(client)
    end

    it "upserts WhatsAppGroup records from service response" do
      groups_data = [
        { "jid" => "1234567890@g.us", "name" => "Test Group 1" },
        { "jid" => "9876543210@g.us", "name" => "Test Group 2" }
      ]

      allow(client).to receive(:groups).and_return(groups_data)

      expect {
        subject.perform
      }.to change { WhatsAppGroup.count }.by(2)

      expect(WhatsAppGroup.find_by(jid: "1234567890@g.us").name).to eq("Test Group 1")
      expect(WhatsAppGroup.find_by(jid: "9876543210@g.us").name).to eq("Test Group 2")
    end

    it "updates existing WhatsAppGroup records" do
      WhatsAppGroup.create!(jid: "1234567890@g.us", name: "Old Name", label: "Old Label")

      groups_data = [
        { "jid" => "1234567890@g.us", "name" => "New Name" }
      ]

      allow(client).to receive(:groups).and_return(groups_data)

      subject.perform

      group = WhatsAppGroup.find_by(jid: "1234567890@g.us")
      expect(group.name).to eq("New Name")
      expect(group.label).to eq("Old Label")
    end

    it "preserves existing labels on upsert" do
      WhatsAppGroup.create!(jid: "1234567890@g.us", name: "Group", label: "Custom Label")

      groups_data = [
        { "jid" => "1234567890@g.us", "name" => "Updated Group" }
      ]

      allow(client).to receive(:groups).and_return(groups_data)

      subject.perform

      group = WhatsAppGroup.find_by(jid: "1234567890@g.us")
      expect(group.label).to eq("Custom Label")
    end

    it "creates new groups when JID does not exist" do
      WhatsAppGroup.create!(jid: "existing@g.us", name: "Existing Group")

      groups_data = [
        { "jid" => "existing@g.us", "name" => "Updated Existing Group" },
        { "jid" => "new@g.us", "name" => "New Group" }
      ]

      allow(client).to receive(:groups).and_return(groups_data)

      expect {
        subject.perform
      }.to change { WhatsAppGroup.count }.by(1)

      expect(WhatsAppGroup.find_by(jid: "existing@g.us").name).to eq("Updated Existing Group")
      expect(WhatsAppGroup.find_by(jid: "new@g.us").name).to eq("New Group")
    end

    it "handles empty response from service" do
      allow(client).to receive(:groups).and_return([])

      expect {
        subject.perform
      }.not_to change { WhatsAppGroup.count }
    end

    it "raises error when service fails" do
      allow(client).to receive(:groups).and_raise(Faraday::ConnectionFailed, "Connection failed")

      expect {
        subject.perform
      }.to raise_error(Faraday::ConnectionFailed)
    end
  end
end
