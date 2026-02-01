import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {BrowserRouter} from "react-router-dom";

import './index.css'

import App from './App'

import {retrieveLaunchParams} from "@tma.js/sdk-react";

import {init} from "./init";

import {EnvUnsupported} from "./EnvUnsupported";

const root = createRoot(document.getElementById('root') as HTMLElement);

try {
  const launchParams = retrieveLaunchParams();
  const { tgWebAppPlatform: platform } = launchParams;
  const debug = (launchParams.tgWebAppStartParam || '').includes('debug')
    || import.meta.env.DEV;

  // Configure all application dependencies.
  await init({
    debug,
    eruda: debug && ['ios', 'android'].includes(platform),
    mockForMacOS: platform === 'macos',
  })
    .then(() => {
      root.render(
        <StrictMode>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </StrictMode>,
      )
    });
} catch (e) {
  root.render(<EnvUnsupported/>);
}
