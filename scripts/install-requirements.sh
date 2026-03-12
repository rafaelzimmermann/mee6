#!/usr/bin/env bash
# install-requirements.sh — install system dependencies for mee6 / agntrick-whatsapp
#
# Required:
#   libmagic   — file-type detection used by agntrick-whatsapp (neonize)
#   gcloud     — Google Cloud CLI (needed for setup-google-credentials.sh)
#
# Optional:
#   ffmpeg     — audio format conversion for WhatsApp voice-message transcription
#                (also requires GROQ_AUDIO_API_KEY or GROQ_API_KEY in your env)
#
# Python / uv are also checked; instructions are printed if missing.
#
# References:
#   https://github.com/jeancsil/agntrick/tree/main/packages/agntrick-whatsapp#requirements

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[ok]${NC}    $*"; }
warn() { echo -e "${YELLOW}[warn]${NC}  $*"; }
err()  { echo -e "${RED}[error]${NC} $*"; }
info() { echo -e "        $*"; }

# ---------------------------------------------------------------------------
# Detect OS
# ---------------------------------------------------------------------------
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ -f /etc/os-release ]]; then
        # shellcheck source=/dev/null
        source /etc/os-release
        case "$ID" in
            ubuntu|debian|linuxmint|pop) echo "debian" ;;
            fedora|rhel|centos|rocky|almalinux) echo "fedora" ;;
            arch|manjaro) echo "arch" ;;
            *) echo "unknown" ;;
        esac
    else
        echo "unknown"
    fi
}

OS=$(detect_os)
echo "Detected OS: $OS"
echo ""

# ---------------------------------------------------------------------------
# Helper: check if a command exists
# ---------------------------------------------------------------------------
has() { command -v "$1" &>/dev/null; }

# ---------------------------------------------------------------------------
# 1. Python 3.12+
# ---------------------------------------------------------------------------
echo "=== Python 3.12+ ==="
PYTHON_OK=false
for cmd in python3.12 python3 python; do
    if has "$cmd"; then
        VERSION=$("$cmd" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)
        MAJOR=$(echo "$VERSION" | cut -d. -f1)
        MINOR=$(echo "$VERSION" | cut -d. -f2)
        if [[ "$MAJOR" -ge 3 && "$MINOR" -ge 12 ]]; then
            ok "Python $VERSION found at $(command -v "$cmd")"
            PYTHON_OK=true
            break
        fi
    fi
done
if [[ "$PYTHON_OK" == false ]]; then
    err "Python 3.12+ not found."
    case "$OS" in
        macos)   info "Install via: brew install python@3.12" ;;
        debian)  info "Install via: sudo apt-get install python3.12 python3.12-venv" ;;
        fedora)  info "Install via: sudo dnf install python3.12" ;;
        arch)    info "Install via: sudo pacman -S python" ;;
        *)       info "See https://www.python.org/downloads/" ;;
    esac
fi
echo ""

# ---------------------------------------------------------------------------
# 2. uv
# ---------------------------------------------------------------------------
echo "=== uv (package manager) ==="
if has uv; then
    ok "uv found at $(command -v uv)"
else
    warn "uv not found — installing via official installer..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    # shellcheck source=/dev/null
    source "$HOME/.local/bin/env" 2>/dev/null || export PATH="$HOME/.local/bin:$PATH"
    if has uv; then
        ok "uv installed successfully"
    else
        err "uv installation failed. See https://docs.astral.sh/uv/getting-started/installation/"
    fi
fi
echo ""

# ---------------------------------------------------------------------------
# 3. libmagic (required)
# ---------------------------------------------------------------------------
echo "=== libmagic (required) ==="
LIBMAGIC_OK=false

# Check via python-magic / file command
if python3 -c "import magic" &>/dev/null 2>&1; then
    ok "python-magic importable (libmagic present)"
    LIBMAGIC_OK=true
elif has file && file --version 2>&1 | grep -q "magic"; then
    ok "libmagic available via 'file' command"
    LIBMAGIC_OK=true
fi

if [[ "$LIBMAGIC_OK" == false ]]; then
    warn "libmagic not detected — attempting install..."
    case "$OS" in
        macos)
            if has brew; then
                brew install libmagic && ok "libmagic installed via Homebrew"
            else
                err "Homebrew not found. Install Homebrew first: https://brew.sh"
                info "Then run: brew install libmagic"
            fi
            ;;
        debian)
            sudo apt-get update -qq && sudo apt-get install -y libmagic1 && ok "libmagic1 installed"
            ;;
        fedora)
            sudo dnf install -y file-devel && ok "file-devel (libmagic) installed"
            ;;
        arch)
            sudo pacman -S --noconfirm file && ok "file (libmagic) installed"
            ;;
        *)
            err "Unknown OS. Install libmagic manually:"
            info "  macOS:          brew install libmagic"
            info "  Ubuntu/Debian:  sudo apt-get install libmagic1"
            info "  Fedora:         sudo dnf install file-devel"
            ;;
    esac
fi
echo ""

# ---------------------------------------------------------------------------
# 4. ffmpeg (optional — needed only for voice message transcription)
# ---------------------------------------------------------------------------
echo "=== ffmpeg (optional — for audio transcription) ==="
if has ffmpeg; then
    ok "ffmpeg found at $(command -v ffmpeg)"
    if [[ -z "${GROQ_AUDIO_API_KEY:-}" && -z "${GROQ_API_KEY:-}" ]]; then
        warn "ffmpeg present but GROQ_AUDIO_API_KEY / GROQ_API_KEY not set in environment."
        info "Audio transcription requires a Groq API key."
    fi
else
    warn "ffmpeg not found — audio transcription will not work."
    info "To install (optional):"
    case "$OS" in
        macos)   info "  brew install ffmpeg" ;;
        debian)  info "  sudo apt-get install ffmpeg" ;;
        fedora)  info "  sudo dnf install ffmpeg" ;;
        arch)    info "  sudo pacman -S ffmpeg" ;;
        *)       info "  See https://ffmpeg.org/download.html" ;;
    esac
fi
echo ""

# ---------------------------------------------------------------------------
# 5. gcloud CLI (required for setup-google-credentials.sh)
# ---------------------------------------------------------------------------
echo "=== gcloud CLI ==="
if has gcloud; then
    ok "gcloud found at $(command -v gcloud)"
else
    warn "gcloud not found — installing..."
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

    if has gcloud; then
        ok "gcloud installed at $(command -v gcloud)"
    else
        err "gcloud installation failed. See https://cloud.google.com/sdk/docs/install"
    fi
fi
echo ""

# ---------------------------------------------------------------------------
# 6. Python deps via uv
# ---------------------------------------------------------------------------
echo "=== Python dependencies ==="
if has uv && [[ -f "$(dirname "$0")/../pyproject.toml" ]]; then
    REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
    (cd "$REPO_ROOT" && uv sync) && ok "uv sync completed"
else
    warn "Run 'uv sync' from the repo root to install Python dependencies."
fi
echo ""

# ---------------------------------------------------------------------------
# 6. Config directory
# ---------------------------------------------------------------------------
echo "=== Config directory ==="
CONFIG_DIR="${HOME}/.config/agntrick"
if [[ -d "$CONFIG_DIR" ]]; then
    ok "$CONFIG_DIR exists"
else
    mkdir -p "$CONFIG_DIR"
    ok "Created $CONFIG_DIR"
fi

[[ -f "$CONFIG_DIR/.env" ]]          && ok ".env found"          || warn ".env missing — copy .env.example to $CONFIG_DIR/.env"
[[ -f "$CONFIG_DIR/whatsapp.yaml" ]] && ok "whatsapp.yaml found" || warn "whatsapp.yaml missing — see whatsapp.yaml.example for format"

# .mee6.conf can live in the agntrick config dir or in the repo root (or both)
if [[ -f "$CONFIG_DIR/.mee6.conf" ]]; then
    ok ".mee6.conf found in $CONFIG_DIR"
elif [[ -f ".mee6.conf" ]]; then
    ok ".mee6.conf found in repo root"
else
    warn ".mee6.conf missing — copy .mee6.conf.example to $CONFIG_DIR/.mee6.conf or to .mee6.conf"
fi
echo ""

echo "Done. Review any warnings above before starting mee6."
