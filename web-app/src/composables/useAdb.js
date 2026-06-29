import { ref, toRaw } from 'vue'
import { Adb, AdbDaemonTransport, AdbPacket, AdbPacketSerializeStream } from '@yume-chan/adb'
import { PushReadableStream, Consumable, StructDeserializeStream, pipeFrom } from '@yume-chan/stream-extra'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { debugLog } from '@/utils/debug'



/**
 * 通过 WebRTC DataChannel 建立 ADB 连接，使用 @yume-chan/adb 处理认证和协议
 */
export function useAdb(webrtcProxy) {
  const webrtc = toRaw(webrtcProxy)
  const isAdbConnected = ref(false)
  let term = null
  let fitAddon = null
  let adb = null
  let transport = null
  let shellSocket = null
  let readableController = null

  /**
   * 将 WebRTC DataChannel 的原始字节流包装为 AdbDaemonConnection
   */
  function createConnectionFromDataChannel() {
    // readable: DataChannel 收到的原始字节 → AdbPacket 对象
    const rawReadable = new PushReadableStream((controller) => {
      readableController = controller

      // 注册 WebRTC 数据回调
      webrtc.onAdbData((data) => {
        const bytes = new Uint8Array(data)
        controller.enqueue(bytes)
      })

      controller.abortSignal.addEventListener('abort', () => {
        webrtc.onAdbData(null)
        readableController = null
      })
    })

    const readable = rawReadable.pipeThrough(new StructDeserializeStream(AdbPacket))

    // writable: AdbPacket 对象 → 序列化为原始字节 → 通过 DataChannel 发送
    const writable = pipeFrom(
      new Consumable.WritableStream({
        write(chunk) {
          // chunk 是 Uint8Array，发送 to WebRTC DataChannel
          webrtc.sendAdbData(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength))
        },
      }),
      new AdbPacketSerializeStream(),
    )

    return { readable, writable }
  }

  async function initAdb(container) {
    debugLog('[ADB] initAdb requested (yume-chan)')

    if (adb || transport) {
      closeAdb()
      await new Promise(r => setTimeout(r, 150))
    }

    // 初始化终端，设置历史缓冲区行数为 10000 行
    term = new Terminal({
      cursorBlink: true,
      background: '#000',
      theme: { background: '#000' },
      fontSize: 12,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      scrollback: 10000
    })
    fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(container)
    setTimeout(() => { if (fitAddon) try { fitAddon.fit() } catch (e) {} }, 100)

    term.writeln('\x1b[33m[ADB] 正在建立 WebRTC ADB 连接通道...\x1b[0m')

    try {
      if (!webrtc._adbInstance) {
        if (typeof webrtc.recreateAdbChannel === 'function') {
          webrtc.recreateAdbChannel()
        }
        // 动态加载 CredentialStore 以确保 SubtleCrypto 垫片已完全就绪
        const AdbWebCredentialStore = (await import('@yume-chan/adb-credential-web')).default
        const credentialStore = new AdbWebCredentialStore('cloudphone-adb')

        term.writeln('\x1b[33m[ADB] 正在认证设备密钥...\x1b[0m')
        // 1. 创建基于 DataChannel 的连接
        const connection = createConnectionFromDataChannel()

        // 2. 使用 yume-chan/adb 进行认证握手
        transport = await AdbDaemonTransport.authenticate({
          serial: 'webrtc-adb',
          connection,
          credentialStore,
          preserveConnection: false,
        })

        adb = new Adb(transport)
        debugLog('[ADB] Authenticated, banner:', transport.banner.toString())
        term.writeln(`\x1b[32m[ADB] 设备认证成功 (${transport.banner.product || 'device'})\x1b[0m`)

        webrtc._adbTransport = transport
        webrtc._adbInstance = adb
        webrtc._adbRawConnection = connection
        webrtc._adbActiveSocketsCount = 0
      } else {
        adb = toRaw(webrtc._adbInstance)
        transport = toRaw(webrtc._adbTransport)
        term.writeln('\x1b[32m[ADB] 复用已建立的 ADB 连接物理通道\x1b[0m')
      }

      webrtc._adbActiveSocketsCount++

      // 3. 打开交互式 shell
      term.writeln('\x1b[33m[ADB] 正在创建独立 Shell 会话...\x1b[0m')
      shellSocket = await adb.createSocket('shell:')

      term.writeln('\x1b[32m[ADB] 终端 Shell 已就绪\x1b[0m\r\n')
      isAdbConnected.value = true
      setTimeout(() => { if (fitAddon) try { fitAddon.fit() } catch (e) {} }, 200)

      // 4. 读取 shell 输出 -> xterm
      const reader = shellSocket.readable.getReader()
      ;(async () => {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (term && value) {
              term.write(value)
            }
          }
        } catch (e) {
          if (e.name !== 'AbortError') {
            console.error('[ADB] Shell read error:', e)
          }
        }
        if (term) term.writeln('\r\n\x1b[31m[ADB] 终端 Shell 已断开\x1b[0m')
        isAdbConnected.value = false
      })()

      // 5. 终端输入 -> shell
      term.onData((data) => {
        if (shellSocket) {
          const writer = shellSocket.writable.getWriter()
          writer.write(new TextEncoder().encode(data)).then(() => writer.releaseLock()).catch(() => {})
        }
      })

    } catch (e) {
      console.error('[ADB] Connection failed:', e)
      if (term) term.writeln(`\r\n\x1b[31m[ADB] 连接失败: ${e.message}\x1b[0m`)
      isAdbConnected.value = false
    }
  }

  async function closeAdb() {
    debugLog('[ADB] Closing session')
    isAdbConnected.value = false

    if (shellSocket) {
      try { await shellSocket.close() } catch (e) {}
      shellSocket = null
    }

    if (webrtc && webrtc._adbActiveSocketsCount !== undefined) {
      webrtc._adbActiveSocketsCount--
      if (webrtc._adbActiveSocketsCount <= 0) {
        debugLog('[ADB] No active shell sessions remaining. Disconnecting transport.')
        if (typeof webrtc.closeAdbChannel === 'function') {
          webrtc.closeAdbChannel()
        }
        if (webrtc._adbInstance) {
          try { await webrtc._adbInstance.close() } catch (e) {}
          webrtc._adbInstance = null
        }
        if (webrtc._adbTransport) {
          try { await webrtc._adbTransport.close() } catch (e) {}
          webrtc._adbTransport = null
        }
        webrtc.onAdbData(null)
        webrtc._adbRawConnection = null
      }
    }

    adb = null
    transport = null

    if (term) {
      const t = term
      term = null
      fitAddon = null
      try { t.dispose() } catch (e) {}
    }
  }

  function resize() {
    if (fitAddon) {
      try { fitAddon.fit() } catch (e) {}
    }
  }

  return { isAdbConnected, initAdb, closeAdb, resize }
}
