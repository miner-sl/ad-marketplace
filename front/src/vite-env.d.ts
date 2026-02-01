/// <reference types="vite/client" />

declare module '@assets/*.json' {
  const value: unknown
  export default value
}
