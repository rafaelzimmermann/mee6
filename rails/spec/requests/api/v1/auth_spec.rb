require "rails_helper"

RSpec.describe "Api::V1::Auth", type: :request do
  describe "GET /api/v1/auth/setup_required" do
    it "returns true when no credential exists" do
      get "/api/v1/auth/setup_required"
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["setup_required"]).to be true
    end

    it "returns false when a credential exists" do
      create(:admin_credential)
      get "/api/v1/auth/setup_required"
      expect(JSON.parse(response.body)["setup_required"]).to be false
    end
  end

  describe "POST /api/v1/auth/setup" do
    it "creates credential and sets session on valid password" do
      post "/api/v1/auth/setup", params: { password: "securepass1", password_confirmation: "securepass1" }
      expect(response).to have_http_status(:ok)
      expect(AdminCredential.configured?).to be true
    end

    it "returns 422 when passwords do not match" do
      post "/api/v1/auth/setup", params: { password: "securepass1", password_confirmation: "different1" }
      expect(response).to have_http_status(:unprocessable_entity)
      expect(AdminCredential.count).to eq(0)
    end

    it "returns 422 when password is too short" do
      post "/api/v1/auth/setup", params: { password: "short", password_confirmation: "short" }
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "returns 403 when already configured" do
      create(:admin_credential)
      post "/api/v1/auth/setup", params: { password: "newpassword1", password_confirmation: "newpassword1" }
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "POST /api/v1/auth/login" do
    let!(:credential) { create(:admin_credential, password: "correctpass1") }

    it "returns 200 and sets session with correct password" do
      post "/api/v1/auth/login", params: { password: "correctpass1" }
      expect(response).to have_http_status(:ok)
    end

    it "returns 401 with wrong password" do
      post "/api/v1/auth/login", params: { password: "wrongpassword" }
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "DELETE /api/v1/auth/logout" do
    it "returns 200 and clears session" do
      create(:admin_credential, password: "correctpass1")
      post "/api/v1/auth/login", params: { password: "correctpass1" }

      delete "/api/v1/auth/logout"
      expect(response).to have_http_status(:ok)

      get "/api/v1/auth/me"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/auth/me" do
    it "returns 200 when session is active" do
      create(:admin_credential, password: "correctpass1")
      post "/api/v1/auth/login", params: { password: "correctpass1" }

      get "/api/v1/auth/me"
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["authenticated"]).to be true
    end

    it "returns 401 without a session" do
      get "/api/v1/auth/me"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "require_auth guard" do
    it "returns 401 for protected endpoints without a session" do
      get "/api/v1/pipelines"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "PUT /api/v1/auth/password" do
    let!(:credential) { create(:admin_credential, password: "oldpassword1") }

    before do
      post "/api/v1/auth/login", params: { password: "oldpassword1" }
    end

    it "updates password with correct current password" do
      put "/api/v1/auth/password", params: {
        current_password:          "oldpassword1",
        new_password:              "newpassword1",
        new_password_confirmation: "newpassword1"
      }
      expect(response).to have_http_status(:ok)
      expect(credential.reload.authenticate("newpassword1")).to be_truthy
    end

    it "returns 401 with wrong current password" do
      put "/api/v1/auth/password", params: {
        current_password:          "wrongpassword",
        new_password:              "newpassword1",
        new_password_confirmation: "newpassword1"
      }
      expect(response).to have_http_status(:unauthorized)
    end

    it "returns 422 when new passwords do not match" do
      put "/api/v1/auth/password", params: {
        current_password:          "oldpassword1",
        new_password:              "newpassword1",
        new_password_confirmation: "differentpass1"
      }
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end
