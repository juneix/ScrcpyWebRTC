# CloudPhone 云服务器容器化部署与中转调试指南

本指南详细介绍如何在云服务器上，通过 Docker Compose 快速完成信令服务器与 coturn (TURN/STUN) 中转服务的联合部署，并在复杂公网（如对称型 NAT）网络环境下进行连接测试与网络调试。

---

## 1. 网络与端口开放规则 (极重要)

云服务器部署前，必须在**云厂商控制台安全组/防火墙**以及**系统本地防火墙（如 ufw/iptables）**中开放以下端口：

| 服务名称 | 端口 | 协议 | 说明 |
| :--- | :--- | :--- | :--- |
| **Signaling & Web UI** | `8443` | TCP | 信令交互、WebSocket 连接与管理后台网页托管 |
| **TURN/STUN Listening**| `3478` | TCP & UDP | coturn 中转服务的控制通道监听端口 |
| **TURN Media Relaying** | `49152-65535` | UDP | **必须开放**！中转视频、音频及控制流媒体数据传输端口范围 |

> [!WARNING]
> 若未开放 `49152-65535` 的 UDP 端口，当处于复杂 NAT 网络下，连接将无法进行媒体流中转，表现为网页可以正常显示设备列表，但点击连接后卡在 `signaling` 或 `connecting` 阶段并最终报错黑屏。

---

## 2. 部署前置条件

1. **操作系统**：推荐 Ubuntu 20.04/22.04 或 Debian 11/12。
2. **基础依赖**：
   - 安装有 Docker (20.10+) 与 Docker Compose (v2.0+)。
   - 拥有 `curl`、`openssl` 等基本命令行工具。

---

## 3. 一键部署流程

项目内置了一键渲染配置与容器拉起脚本 `deploy_cloud.sh`。

### 第一步：准备部署文件
在您的云服务器上拉取项目源码，并进入项目 `docker` 目录：
```bash
git clone <your-repository-url> cloudphone
cd cloudphone/docker
```

### 第二步：执行一键部署脚本
运行以下指令启动自动化部署流水线：
```bash
chmod +x deploy_cloud.sh
./deploy_cloud.sh
```

**脚本自动执行以下操作**：
1. **编译检查**：若本地无编译产物，自动调用 `build_all.sh` 构建前端 V1/V2 网页和信令服务器二进制。
2. **自适应平台提取**：根据当前云服务器 CPU 架构（amd64 / arm64），提取匹配的 Linux 平台二进制文件用于 Docker 封装。
3. **公网 IP 探测**：自动探测云服务器的公网 IP，并提示您进行确认或手动纠正。
4. **生成安全凭证**：随机生成强密码作为 TURN 中转服务的认证账号。
5. **配置文件渲染**：自动将公网 IP 和密码凭证渲染进 `.env` 和 `coturn/turnserver.conf` 配置文件中。
6. **镜像编译**：构建包含最新静态 Web UI 资产的 `cloudphone-all-in-one` 信令镜像。
7. **容器拉起**：自动执行 `docker compose up -d` 启动 `cloudphone-coturn` 和 `cloudphone-signaling` 容器服务。

---

## 4. 接入 Agent 设备

服务部署成功后，终端将输出接入引导信息。按照提示，在您的 **Android 设备** 或 **redroid 容器** 内部拉起 Agent。

### 接入命令结构：
```bash
./cloudphone-agent \
  -signaling "ws://<YOUR_PUBLIC_IP>:8443/register_agent" \
  -id "device-cloud-01" \
  -ice-servers "turn:<TURN_USER>:<TURN_PASSWORD>@<YOUR_PUBLIC_IP>:3478?transport=udp,stun:<YOUR_PUBLIC_IP>:3478"
```
*(注：上述具体参数已由一键部署脚本在完成时在终端中直接输出，请直接复制使用即可。)*

---

## 5. WebRTC 中转调试与有效性验证

为了确保流量确实通过我们搭建的 coturn 中转，而非在本地尝试直连（如果碰巧在同个内网），可以按照以下方式进行诊断：

### 5.1 浏览器网络诊断 (Chrome / Edge / Safari)
1. 在电脑浏览器上，访问 `http://<YOUR_PUBLIC_IP>:8443`（默认展示 V2 UI，可在 `.env` 中修改 `UI_VERSION` 切换）。
2. 在新标签页中打开 WebRTC 内部仪表盘：`chrome://webrtc-internals`。
3. 在 CloudPhone 页面点击连接设备。
4. 返回 `chrome://webrtc-internals` 标签页，在当前连接的 PeerConnection 详情中，滚动到下方找到名为 **`Conn-ice-local-candidate`** 和 **`Conn-ice-remote-candidate`** 的分类。
5. 检查本地或远端 Candidate 的类型（`candidateType`）：
   - 如果 `candidateType` 显示为 **`relay`**，且当前连接活跃（`packetsReceived` 持续增长，视频渲染流畅），说明您的**云服务器 TURN 中转服务已完美生效并正在承载媒体流量**！
   - 如果显示为 `srflx` 或 `host`，说明使用了 STUN 反射连接或局域网直连。

### 5.2 命令行与容器日志排查
若连接不成功，可以使用以下命令查看日志：
- **查看信令服务器日志**：
  ```bash
  docker compose logs -f signaling
  ```
  检查是否有 Web 客户端和 Agent 设备正常注册与路由 SDP 的记录。
- **查看 Coturn 中转服务日志**：
  ```bash
  docker compose logs -f coturn
  ```
  检查是否有客户端在进行 `Allocate` 请求及鉴权成功（`user <YOUR_TURN_USER> authorized`）的记录。

---

## 6. 常见故障排查 (Troubleshooting)

### Q1: 页面正常显示设备，点击连接后一直卡在 Connecting / Signaling 状态，最终黑屏
* **原因**：大段 UDP 媒体端口被防火墙阻拦。
* **排查方法**：确认云服务器控制台安全组中 `49152-65535` UDP 端口已完全放开。可以使用网络工具测试 UDP 连通性。

### Q2: 报错 `Signaling Server connection lost` 且浏览器控制台提示 WebSocket 连接失败
* **原因**：信令端口 `8443` 未放开，或者在 Docker 中由于端口冲突导致信令容器未成功启动。
* **排查方法**：运行 `docker compose ps` 确保服务状态为 `Up`；检查端口 `8443` 是否被其他软件（例如已存在的 Web 服务器）占用。可在 `.env` 中更改 `SIGNALING_PORT` 参数，并重新 `docker compose up -d` 部署。

### Q3: Coturn 容器不断报错退出或提示 `Address already in use`
* **原因**：coturn 容器使用了 `network_mode: host` 模式，如果服务器上已经安装或启用了系统级的 coturn 实例，会产生 `3478` 端口冲突。
* **排查方法**：在宿主机运行 `sudo systemctl stop coturn` 和 `sudo systemctl disable coturn` 彻底关闭本地自带的服务进程，然后重新启动容器。
