#!/usr/bin/env bash
# setup-google-credentials.sh — create a GCP project, enable the Calendar API,
# and generate a service account key for mee6.
#
# gcloud CLI is installed automatically if not found (linux-x86_64).
# You will be prompted to authenticate via gcloud auth login if not already done.
# After running this script, complete setup manually:
#   1. Share your Google Calendar with the printed service account email
#   2. Copy the Calendar ID into .mee6.conf as GOOGLE_CALENDAR_ID

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[ok]${NC}    $*"; }
warn() { echo -e "${YELLOW}[warn]${NC}  $*"; }
err()  { echo -e "${RED}[error]${NC} $*"; exit 1; }
info() { echo -e "        $*"; }

# ---------------------------------------------------------------------------
# Config — override via env vars if needed
# ---------------------------------------------------------------------------
PROJECT_ID="${GCP_PROJECT_ID:-mee6-calendar}"
SA_NAME="${GCP_SA_NAME:-mee6-calendar}"
CREDENTIALS_OUT="${CREDENTIALS_FILE:-./data/credentials.json}"

# ---------------------------------------------------------------------------
# Check prerequisites
# ---------------------------------------------------------------------------
echo "=== Checking prerequisites ==="

if ! command -v gcloud &>/dev/null; then
    warn "gcloud CLI not found — installing..."
    GCLOUD_TMP=$(mktemp -d)
    curl -O --output-dir "$GCLOUD_TMP" https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-x86_64.tar.gz
    tar -xf "$GCLOUD_TMP/google-cloud-cli-linux-x86_64.tar.gz" -C "$HOME"
    "$HOME/google-cloud-sdk/install.sh" --quiet
    rm -rf "$GCLOUD_TMP"

    # Add to PATH for this session
    export PATH="$HOME/google-cloud-sdk/bin:$PATH"

    # Persist PATH in the user's shell rc file if not already present
    GCLOUD_PATH_LINE='export PATH="$HOME/google-cloud-sdk/bin:$PATH"'
    SHELL_RC=""
    case "${SHELL:-}" in
        */zsh)  SHELL_RC="$HOME/.zshrc" ;;
        */bash) SHELL_RC="$HOME/.bashrc" ;;
    esac
    if [[ -n "$SHELL_RC" ]]; then
        if ! grep -qF "google-cloud-sdk/bin" "$SHELL_RC" 2>/dev/null; then
            echo "" >> "$SHELL_RC"
            echo "# Google Cloud SDK" >> "$SHELL_RC"
            echo "$GCLOUD_PATH_LINE" >> "$SHELL_RC"
            ok "PATH added to $SHELL_RC — run: source $SHELL_RC"
        else
            ok "google-cloud-sdk/bin already in $SHELL_RC"
        fi
    else
        warn "Unknown shell '${SHELL:-}' — add manually to your rc file: $GCLOUD_PATH_LINE"
    fi

    command -v gcloud &>/dev/null || err "gcloud installation failed. See https://cloud.google.com/sdk/docs/install"
    ok "gcloud installed at $(command -v gcloud)"
fi
ok "gcloud found at $(command -v gcloud)"

ACCOUNT=$(gcloud auth list --filter="status:ACTIVE" --format="value(account)" 2>/dev/null | head -1)
if [[ -z "$ACCOUNT" ]]; then
    warn "No active gcloud account — launching authentication..."
    gcloud auth login
    ACCOUNT=$(gcloud auth list --filter="status:ACTIVE" --format="value(account)" 2>/dev/null | head -1)
    [[ -n "$ACCOUNT" ]] || err "Authentication failed. Run manually: gcloud auth login"
fi
ok "Authenticated as $ACCOUNT"
echo ""

# ---------------------------------------------------------------------------
# 1. Create GCP project
# ---------------------------------------------------------------------------
echo "=== Step 1: GCP project ==="
if gcloud projects describe "$PROJECT_ID" &>/dev/null; then
    ok "Project '$PROJECT_ID' already exists — skipping creation"
else
    gcloud projects create "$PROJECT_ID" --name="mee6 Calendar"
    ok "Project '$PROJECT_ID' created"
fi

gcloud config set project "$PROJECT_ID"
ok "Active project set to '$PROJECT_ID'"
echo ""

# ---------------------------------------------------------------------------
# 2. Enable Google Calendar API
# ---------------------------------------------------------------------------
echo "=== Step 2: Enable Google Calendar API ==="
if gcloud services list --enabled --filter="name:calendar-json.googleapis.com" --format="value(name)" | grep -q "calendar"; then
    ok "Calendar API already enabled"
else
    gcloud services enable calendar-json.googleapis.com
    ok "Calendar API enabled"
fi
echo ""

# ---------------------------------------------------------------------------
# 3. Create service account
# ---------------------------------------------------------------------------
echo "=== Step 3: Service account ==="
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

if gcloud iam service-accounts describe "$SA_EMAIL" &>/dev/null; then
    ok "Service account '$SA_EMAIL' already exists — skipping creation"
else
    gcloud iam service-accounts create "$SA_NAME" \
        --display-name="mee6 Calendar" \
        --project="$PROJECT_ID"
    ok "Service account '$SA_EMAIL' created"
fi
echo ""

# ---------------------------------------------------------------------------
# 4. Download credentials JSON
# ---------------------------------------------------------------------------
echo "=== Step 4: Credentials JSON ==="
mkdir -p "$(dirname "$CREDENTIALS_OUT")"

if [[ -f "$CREDENTIALS_OUT" ]]; then
    warn "Credentials file already exists at $CREDENTIALS_OUT"
    read -r -p "        Overwrite? [y/N] " REPLY
    [[ "$REPLY" =~ ^[Yy]$ ]] || { info "Skipped. Existing file kept."; echo ""; }
fi

if [[ ! -f "$CREDENTIALS_OUT" ]] || [[ "${REPLY:-n}" =~ ^[Yy]$ ]]; then
    gcloud iam service-accounts keys create "$CREDENTIALS_OUT" \
        --iam-account="$SA_EMAIL" \
        --project="$PROJECT_ID"
    ok "Credentials written to $CREDENTIALS_OUT"
fi
echo ""

# ---------------------------------------------------------------------------
# Summary + manual steps remaining
# ---------------------------------------------------------------------------
echo "=== Done ==="
ok "Service account: $SA_EMAIL"
ok "Credentials:     $CREDENTIALS_OUT"
echo ""
echo -e "${YELLOW}Manual steps still required:${NC}"
echo ""
echo "  1. Open Google Calendar → find your target calendar"
echo "     → ⋮ → Settings and sharing → Share with specific people"
echo "     → Add: ${SA_EMAIL}"
echo "     → Permission: 'Make changes to events'"
echo ""
echo "  2. Copy the Calendar ID from that same Settings page"
echo "     and add it to .mee6.conf:"
echo ""
echo "       GOOGLE_CALENDAR_ID=<your-calendar-id>"
echo "       GOOGLE_CREDENTIALS_FILE=$(realpath "$CREDENTIALS_OUT" 2>/dev/null || echo "$CREDENTIALS_OUT")"
