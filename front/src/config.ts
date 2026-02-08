interface BaseConfig {
  isDev?: boolean
  isProd?: boolean
  apiHost: string
  tonConnectManifestUrl: string
  accessToken?: string
  botName: string,
  appName: string,
}

class Config implements BaseConfig {
    isDev?: boolean | undefined
    isProd?: boolean | undefined
    apiHost: string
    tonConnectManifestUrl: string
    accessToken?: string | undefined
    botName: string
    appName: string

  constructor(config: BaseConfig) {
    this.isDev = config.isDev
    this.isProd = config.isProd
    this.apiHost = config.apiHost
    this.tonConnectManifestUrl = config.tonConnectManifestUrl
    this.accessToken = config.accessToken
    this.botName = config.botName
    this.appName = config.appName
  }

  get botLink(): string {
    return `https://t.me/${this.botName}`
  }

  get miniAppLink(): string {
    return `https://t.me/${this.botName}/${this.appName}`
  }
}

const devConfigBase: BaseConfig = {
  isDev: true,
  // apiHost: 'http://192.168.31.106:5173',
  apiHost: 'http://192.168.64.1:3000',
  // apiHost: 'http://localhost:3000',
  botName: 'NonNano_Bot',
  appName: 'app',
  tonConnectManifestUrl: 'https://cdn.joincommunity.xyz/gateway/manifest.json',
  // tonConnectManifestUrl: '/manifest.json',
  accessToken: import.meta.env.VITE_ACCESS_TOKEN,
}

const prodConfigBase: BaseConfig = {
  isProd: true,
  apiHost: 'https://api.access.tools.tg',
  botName: import.meta.env.VITE_BOT_USERNAME || 'NonNano_Bot',
  appName: 'Open',
  tonConnectManifestUrl: 'https://cdn.joincommunity.xyz/gateway/manifest.json',
}

let config

switch (import.meta.env.MODE) {
  case 'production':
    config = new Config(prodConfigBase)
    break
  default:
    config = new Config(devConfigBase)
}

export default config as Config
