import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerBuiltinPlugins } from './plugins/builtin'

// 同梱のプラグインを、外部のプラグインと同じ仕組み（registerPlugin）で登録する
registerBuiltinPlugins()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
