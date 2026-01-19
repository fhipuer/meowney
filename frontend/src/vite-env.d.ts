/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_APP_NAME: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// 마크다운 파일 타입 선언 냥~
declare module '*.md' {
  const content: string
  export default content
}
