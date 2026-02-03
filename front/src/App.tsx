import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TonConnectUIProvider } from '@tonconnect/ui-react';

import AppRouter from "@routes";
import {ErrorBoundary, SkeletonElement, ToastProvider, AppHeader} from "@components";
import {LoginPage} from "@pages";

import {AuthProvider, ThemeProvider, useAuth} from "@context";
import config from "./config";

const queryClient = new QueryClient();

function InnerApp () {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: '100px' }}>
        <SkeletonElement />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <>
      <AppHeader />
      <AppRouter />
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <TonConnectUIProvider
            manifestUrl={config.tonConnectManifestUrl}
            actionsConfiguration={{
              twaReturnUrl: `https://t.me/${config.botName}/gate`,
            }}
          >
            <ToastProvider>
              <ErrorBoundary>
               <InnerApp />
              </ErrorBoundary>
            </ToastProvider>
          </TonConnectUIProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
