import type {TonConnectUI} from "@tonconnect/ui-react";
import config from "@config";

// const status = {
//   cropper: false,
// };

// export const initializeCropper = async () => {
//   if (status.cropper) return status.cropper;
//
//   // await import("cropperjs");
//
//   status.cropper = true;
//   return status.cropper;
// };

// export const initializeDOMPurify = async () =>
//   (await import("dompurify")).default;

export let tonConnectUI: TonConnectUI | undefined;

export let parseTONAddress: (
  hexAddress: string,
  testOnly?: boolean,
) => string | undefined;

export const initializeTonConnect = async () => {
  if (tonConnectUI) return true;

  try {
    const { THEME, TonConnectUI, toUserFriendlyAddress } = await import(
      "@tonconnect/ui-react"
      );
    const darkMode = document.body.getAttribute("data-theme") === "dark";

    parseTONAddress = toUserFriendlyAddress;

    tonConnectUI = new TonConnectUI({
      manifestUrl: config.tonConnectManifestUrl,
      uiPreferences: {
        theme: darkMode ? THEME.DARK : THEME.LIGHT,
      },
      restoreConnection: false,
      walletsRequiredFeatures: {
        sendTransaction: {
          minMessages: 2,
        },
      },
      actionsConfiguration: {
        twaReturnUrl: `https://t.me/${config.botName}/${config.appName}`,
      },
    });

    // Handle bridge connection errors gracefully
    if (tonConnectUI) {
      tonConnectUI.onStatusChange((wallet) => {
        if (wallet) {
          console.log('TON Connect: Wallet connected', wallet);
        }
      });

      // Listen for errors and handle certificate issues gracefully
      const errorHandler = (event: ErrorEvent) => {
        const errorMessage = event.message || event.error?.message || '';
        const errorSource = event.filename || '';

        if (errorMessage.includes('ERR_CERT_DATE_INVALID') ||
            errorMessage.includes('ton-connect.mytokenpocket.vip') ||
            errorMessage.includes('bridge.tonapi.io') ||
            errorSource.includes('bridge')) {
          console.warn('TON Connect bridge certificate error detected. Wallet may use alternative connection method.', {
            error: errorMessage,
            source: errorSource,
          });
          // Prevent the error from propagating and breaking the app
          event.preventDefault();
          return false;
        }
      };

      window.addEventListener('error', errorHandler, true);

      // Also listen for unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason?.message || String(event.reason || '');
        if (reason.includes('ERR_CERT_DATE_INVALID') ||
            reason.includes('bridge') ||
            reason.includes('certificate')) {
          console.warn('TON Connect bridge certificate error (unhandled rejection).', {
            reason,
          });
          event.preventDefault();
        }
      });
    }

    return true;
  } catch (error) {
    console.error("Failed to initialize TonConnectUI:", error);
  }

  return false;
};
