#!/bin/bash
# ViPER Corpus Initialization Script
# Downloads and extracts test corpus files for the desktop

# Variables will be substituted when the script is deployed
SERVICE_URL="{{SERVICE_URL}}"
CORPUS_URL="${SERVICE_URL}/files/corpora.tar.gz"
CORPUS_DIR="/tmp/corpora"
DESKTOP_DIR="/config/Desktop"
LOG_FILE="/tmp/corpus-init.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log "Starting corpus initialization..."

# Check if corpus already exists
if [ -d "$CORPUS_DIR" ]; then
    log "Corpus directory already exists at $CORPUS_DIR, skipping download"
    exit 0
fi

# Download corpus archive
log "Downloading corpus from $CORPUS_URL"
if curl -f -L -o /tmp/corpora.tar.gz "$CORPUS_URL" 2>&1 | tee -a "$LOG_FILE"; then
    log "Corpus downloaded successfully"
else
    log "ERROR: Failed to download corpus"
    exit 1
fi

# Extract to /tmp
log "Extracting corpus to $CORPUS_DIR"
mkdir -p "$CORPUS_DIR"
if tar -xzf /tmp/corpora.tar.gz -C /tmp 2>&1 | tee -a "$LOG_FILE"; then
    log "Corpus extracted successfully"
else
    log "ERROR: Failed to extract corpus"
    exit 1
fi

# Remove the tar.gz
log "Removing archive file"
rm -f /tmp/corpora.tar.gz

# Set permissions
log "Setting permissions"
chown -R abc:abc "$CORPUS_DIR" 2>&1 | tee -a "$LOG_FILE"
chmod -R 755 "$CORPUS_DIR" 2>&1 | tee -a "$LOG_FILE"

# Create desktop shortcut
log "Creating desktop shortcut"
mkdir -p "$DESKTOP_DIR"
cat > "$DESKTOP_DIR/test-corpus.desktop" << 'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=Test Corpus Files
GenericName=Sample Test Files
Comment=Access test corpus files for validation and testing
Exec=thunar /tmp/corpora
Icon=folder
Terminal=false
Categories=Utility;FileTools;
EOF

# Set ownership and permissions for desktop file
chown abc:abc "$DESKTOP_DIR/test-corpus.desktop"
chmod 755 "$DESKTOP_DIR/test-corpus.desktop"

# Mark desktop file as trusted (generate checksum for XFCE)
checksum=$(sha256sum "$DESKTOP_DIR/test-corpus.desktop" | awk '{print $1}')
log "Desktop shortcut created with checksum: $checksum"

# Try to set metadata (may not work in all environments)
gio set -t string "$DESKTOP_DIR/test-corpus.desktop" metadata::xfce-exe-checksum "$checksum" 2>&1 | tee -a "$LOG_FILE" || true

log "Corpus initialization completed successfully"
log "Files available at: $CORPUS_DIR"
log "Desktop shortcut: $DESKTOP_DIR/test-corpus.desktop"
