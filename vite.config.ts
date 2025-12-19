
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // 환경 변수가 없을 경우 빈 문자열을 주입하여 브라우저 런타임 에러를 방지합니다.
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || "")
  },
  server: {
    host: true
  }
})
