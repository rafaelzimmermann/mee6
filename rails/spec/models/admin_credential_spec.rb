RSpec.describe AdminCredential, type: :model do
  describe "has_secure_password" do
    it "has secure password" do
      credential = build(:admin_credential)
      expect(credential).to have_secure_password
    end

    it "authenticates with correct password" do
      credential = create(:admin_credential, password: "ValidPassword123", password_confirmation: "ValidPassword123")
      expect(credential.authenticate("ValidPassword123")).to eq(credential)
    end

    it "does not authenticate with incorrect password" do
      credential = create(:admin_credential, password: "ValidPassword123", password_confirmation: "ValidPassword123")
      expect(credential.authenticate("WrongPassword")).to be_falsey
    end
  end

  describe "validations" do
    it "is invalid on create with a password shorter than 8 chars" do
      credential = build(:admin_credential, password: "short", password_confirmation: "short")
      expect(credential).not_to be_valid
      expect(credential.errors[:password]).to be_present
    end

    it "allows update without providing a password (allow_nil)" do
      credential = create(:admin_credential)
      # Updating without touching password should not trigger length validation
      credential.password = nil
      expect(credential).to be_valid
    end

    it "is invalid on update when a new password is provided but too short" do
      credential = create(:admin_credential)
      credential.password = "short"
      expect(credential).not_to be_valid
    end
  end

  describe ".configured?" do
    it "returns false when no record exists" do
      expect(AdminCredential.configured?).to be false
    end

    it "returns true after a credential is created" do
      create(:admin_credential)
      expect(AdminCredential.configured?).to be true
    end
  end

  describe ".instance" do
    it "returns nil when no record exists" do
      expect(AdminCredential.instance).to be_nil
    end

    it "returns the credential when one exists" do
      credential = create(:admin_credential)
      expect(AdminCredential.instance).to eq(credential)
    end
  end
end
