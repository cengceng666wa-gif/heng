import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor 配置 —— 把同一个 PWA 包成真正的 Android APK。
 *
 * 为什么保留这条路径：
 *   PWA 在 Android 上已经够用，但有两点不如原生 APK：
 *     1. GitHub Pages 在国内可能加载慢（APK 把静态资源全打包进去，不依赖网络）
 *     2. 分享给别人时，发个 APK 文件比让对方「打开网址再添加到主屏幕」简单得多
 *
 * 代码零改动：webDir 直接指向 vite 的构建产物 dist/。
 */
const config: CapacitorConfig = {
  appId: 'com.cengceng.heng',
  appName: '衡',
  webDir: 'dist',
  // 数据存 IndexedDB，不做任何服务端同步
  android: {
    // 不允许混合内容——App 里所有请求都应该是 https
    allowMixedContent: false,
    // 深色状态栏，和 App 主题一致
    backgroundColor: '#111214'
  }
}

export default config
