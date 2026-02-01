import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import { TonConnectUIProvider } from '@tonconnect/ui-react';

import {ThemeProvider} from "./context";
import AppRouter from "@routes";
import config from "./config";
import { ToastProvider } from "@components";
import { ErrorBoundary } from "@components";

const queryClient = new QueryClient()

function App() {
  return (
    // Provide the client to your App
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TonConnectUIProvider
            manifestUrl={config.tonConnectManifestUrl}
            actionsConfiguration={{
              twaReturnUrl: `https://t.me/${config.botName}/gate`,
            }}
          >
            <ToastProvider>
              <AppRouter/>
            </ToastProvider>
          </TonConnectUIProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}


export default App;
