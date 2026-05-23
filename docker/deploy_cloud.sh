#!/bin/bash

# ==============================================================================
# CloudPhone 云服务器 Docker & TURN 中转一键部署脚本
# ==============================================================================

set -e

PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
COTURN_DIR="${PROJECT_ROOT}/coturn"
mkdir -p "${COTURN_DIR}"

echo "========================================================"
echo "      开始部署 CloudPhone 云端服务架构 (含中转)"
echo "========================================================"

# 1. 智能检测运行环境
RUN_IN_RELEASE="false"
if [ -d "${PROJECT_ROOT}/../bin" ] && [ -d "${PROJECT_ROOT}/../assets" ]; then
    RUN_IN_RELEASE="true"
    SRC_BIN_DIR="${PROJECT_ROOT}/../bin"
    SRC_ASSETS_DIR="${PROJECT_ROOT}/../assets"
    echo "[环境检测] 运行于打包后的 release/docker 目录"
elif [ -d "${PROJECT_ROOT}/../release/bin" ] && [ -d "${PROJECT_ROOT}/../release/assets" ]; then
    SRC_BIN_DIR="${PROJECT_ROOT}/../release/bin"
    SRC_ASSETS_DIR="${PROJECT_ROOT}/../release/assets"
    echo "[环境检测] 运行于开发环境"
else
    echo "错误: 未找到 bin/ 和 assets/ 资源目录！请确保在 docker 目录下运行。"
    exit 1
fi

# 2. 探测 CPU 架构并校验二进制
ARCH=$(uname -m)
if [[ "$ARCH" == "x86_64" ]] || [[ "$ARCH" == "amd64" ]]; then
    OS_ARCH="linux_amd64"
else
    OS_ARCH="linux_arm64"
fi

TARGET_BIN="${SRC_BIN_DIR}/${OS_ARCH}/webrtc-signaling"

if [ "$RUN_IN_RELEASE" = "true" ]; then
    if [ ! -f "$TARGET_BIN" ]; then
        echo "错误: 未在 ${SRC_BIN_DIR}/${OS_ARCH}/ 目录中找到 webrtc-signaling 二进制文件！"
        exit 1
    fi
else
    # 开发环境若无产物，自动构建
    if [ ! -f "$TARGET_BIN" ] || [ ! -d "${SRC_ASSETS_DIR}" ]; then
        echo "未检测到本地打包产物，开始自动调用 ../build_all.sh 编译源码..."
        chmod +x "${PROJECT_ROOT}/../build_all.sh"
        (cd "${PROJECT_ROOT}/.." && ./build_all.sh)
    fi
fi

# 3. 准备临时 Docker 构建上下文
echo "正在为 Docker 引擎准备临时构建上下文..."
rm -f "${PROJECT_ROOT}/webrtc-signaling"
rm -rf "${PROJECT_ROOT}/assets"

cp "${TARGET_BIN}" "${PROJECT_ROOT}/webrtc-signaling"
cp -r "${SRC_ASSETS_DIR}" "${PROJECT_ROOT}/assets"
echo "上下文准备完毕。"

# 确保脚本退出时清理临时构建文件
cleanup() {
    echo "正在清理临时构建介质..."
    rm -f "${PROJECT_ROOT}/webrtc-signaling"
    rm -rf "${PROJECT_ROOT}/assets"
    echo "清理完毕。"
}
trap cleanup EXIT

# 4. 自动探测或引导输入公网 IP
echo "正在自动探测服务器公网 IP..."
DETECTED_IP=""
DETECTED_IP=$(curl -s -4 --connect-timeout 5 https://ifconfig.me || curl -s -4 --connect-timeout 5 https://api.ipify.org || echo "")

if [ -n "$DETECTED_IP" ]; then
    read -p "探测到公网 IP 为 [ $DETECTED_IP ]，是否使用此 IP? (Y/n): " confirm
    if [[ "$confirm" =~ ^[Nn]$ ]]; then
        read -p "请输入您服务器的真实公网 IP: " PUBLIC_IP
    else
        PUBLIC_IP=$DETECTED_IP
    fi
else
    echo "警告: 无法自动获取公网 IP，请在下面手动输入。"
    read -p "请输入您服务器的真实公网 IP: " PUBLIC_IP
fi

if [ -z "$PUBLIC_IP" ]; then
    echo "错误: 公网 IP 不能为空！"
    exit 1
fi

# 5. 生成随机安全的中转凭证
echo "生成随机且高强度中转连接安全凭证..."
TURN_USER="cp_user_$(openssl rand -hex 3 2>/dev/null || echo "admin")"
TURN_PASSWORD="$(openssl rand -hex 12 2>/dev/null || echo "cloudphone_pass_secret")"

# 6. 渲染生成配置文件
echo "开始渲染配置及环境参数..."

# 6.1 生成 .env
SIGNALING_PORT=${SIGNALING_PORT:-8443}
UI_VERSION="${UI_VERSION:-v1}"
DEFAULT_SETTINGS=${DEFAULT_SETTINGS:-'{"maxBitrate":4,"minBitrate":1,"fps":30,"size":1920,"bitrate":4}'}

cat <<EOF > "${PROJECT_ROOT}/.env"
# 自动生成的环境变量配置文件
PUBLIC_IP=${PUBLIC_IP}
TURN_USER=${TURN_USER}
TURN_PASSWORD=${TURN_PASSWORD}
SIGNALING_PORT=${SIGNALING_PORT}
UI_VERSION=${UI_VERSION}
DEFAULT_SETTINGS=${DEFAULT_SETTINGS}
EOF
echo "已生成环境配置文件: .env"

# 6.2 渲染生成 turnserver.conf
if [ -f "${COTURN_DIR}/turnserver.conf.template" ]; then
    sed -e "s/{{TURN_USER}}/${TURN_USER}/g" \
        -e "s/{{TURN_PASSWORD}}/${TURN_PASSWORD}/g" \
        -e "s/{{PUBLIC_IP}}/${PUBLIC_IP}/g" \
        "${COTURN_DIR}/turnserver.conf.template" > "${COTURN_DIR}/turnserver.conf"
    echo "已成功渲染并生成中转配置文件: coturn/turnserver.conf"
else
    echo "错误: 未找到 coturn/turnserver.conf.template"
    exit 1
fi

# 7. 构建信令服务器 Docker 镜像
echo "构建信令与前端一体化轻量 Docker 镜像..."
docker build -t cloudphone-all-in-one "${PROJECT_ROOT}"

# 8. 拉起 Docker Compose 服务
echo "拉起 Docker Compose 容器集群..."
(
    cd "${PROJECT_ROOT}"
    if docker compose version >/dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi
    $COMPOSE_CMD down || true
    $COMPOSE_CMD up -d
)

echo "========================================================"
echo "                  🎉 部署服务已成功启动！"
echo "========================================================"
echo "1. 网页管理后台已上线，请访问："
echo "   http://${PUBLIC_IP}:${SIGNALING_PORT}"
echo ""
echo "2. 在物理设备或 redroid 容器内，运行以下指令启动 Agent 接入当前云端服务："
echo "   ./cloudphone-agent \\"
echo "     -signaling \"ws://${PUBLIC_IP}:${SIGNALING_PORT}/register_agent\" \\"
echo "     -id \"<自定义设备ID>\" \\"
echo "     -ice-servers \"turn:${TURN_USER}:${TURN_PASSWORD}@${PUBLIC_IP}:3478?transport=udp,stun:${PUBLIC_IP}:3478\""
echo "========================================================"
