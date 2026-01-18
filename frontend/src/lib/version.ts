/**
 * 앱 버전 정보 냥~ 🐱
 * package.json에서 버전을 가져옵니다
 */

// Vite에서 빌드 시 package.json의 version을 주입
export const APP_VERSION = __APP_VERSION__

// TypeScript 타입 선언
declare global {
  const __APP_VERSION__: string
}
