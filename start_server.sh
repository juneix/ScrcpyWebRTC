#!/bin/bash
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
[[ "$ARCH" == "x86_64" ]] && ARCH="amd64"
[[ "$ARCH" == "aarch64" ]] && ARCH="arm64"

# 默认版本
UI_VER="v1"
if [ "$1" == "v2" ]; then
    UI_VER="v2"
fi

# 默认全局及虚机连接参数配置（最高 4m, 最低 1m, fps 30, 分辨率 1920）
export DEFAULT_SETTINGS=${DEFAULT_SETTINGS:-'{"fps":60,"size":1920}'}

BIN_PATH="./bin/${OS}_${ARCH}/webrtc-signaling"
if [ -f "$BIN_PATH" ]; then
    echo "Starting Signaling Server for $OS/$ARCH using UI: $UI_VER..."
    $BIN_PATH -port 8443 -assets ./assets/$UI_VER
else
    echo "Error: Binary not found for $OS/$ARCH at $BIN_PATH"
fi
