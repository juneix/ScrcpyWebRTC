#!/bin/bash

# ==============================================================================
# Web App 构建脚本
# ==============================================================================

set -e

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
WEB_APP_DIR="${SCRIPT_DIR}/web-app"

echo "=== Building Web App ==="

rm -rf "${SCRIPT_DIR}"/assets
cd "$WEB_APP_DIR"

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo "-> Installing dependencies..."
    npm install --registry=https://registry.npmmirror.com
fi

# 构建
echo "-> Building..."
npm run build

echo "------------------------------------------------"
mkdir -p "${SCRIPT_DIR}"/assets/agent
ln -f "${SCRIPT_DIR}"/agentd/cloudphone-agent-amd64 "${SCRIPT_DIR}"/assets/agent/cloudphone-agent-amd64
ln -f "${SCRIPT_DIR}"/agentd/cloudphone-agent-arm64 "${SCRIPT_DIR}"/assets/agent/cloudphone-agent-arm64
ln -f "${SCRIPT_DIR}"/agentd/libsys_core.so "${SCRIPT_DIR}"/assets/agent/libsys_core.so
echo "Build Complete!"
echo "Output: "${SCRIPT_DIR}"/assets"
echo "------------------------------------------------"
