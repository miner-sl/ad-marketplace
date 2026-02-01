import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import { TonConnectUIProvider } from '@tonconnect/ui-react';

import {ThemeProvider} from "./context";
import AppRouter from "@routes";
import config from "./config.ts";
import {useParams} from "react-router-dom";
import ToastProvider from "./components/Toast/Toast.tsx";

const queryClient = new QueryClient()

function App() {
  const { clientChatSlug } = useParams<{ clientChatSlug: string }>()

  return (
    // Provide the client to your App
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TonConnectUIProvider
          manifestUrl={config.tonConnectManifestUrl}
          actionsConfiguration={{
            twaReturnUrl: `https://t.me/${config.botName}/gate?startapp=ch_${clientChatSlug}`,
          }}
        >
          <ToastProvider>
            <AppRouter/>
          </ToastProvider>
        </TonConnectUIProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}


export default App;
