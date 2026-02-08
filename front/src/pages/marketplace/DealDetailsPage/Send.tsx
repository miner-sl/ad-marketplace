import {useTonConnectUI} from "@tonconnect/ui-react";
import {Address, beginCell, toNano} from "@ton/core";



function buildJettonTransfer({
                               amount,
                               toAddress,
                               responseAddress
                             }: { amount: number, toAddress: string, responseAddress: string }) {
  return beginCell()
    .storeUint(0xf8a7ea5, 32) // jetton transfer op code
    .storeUint(0, 64) // query id
    .storeCoins(amount) // amount in jetton units
    .storeAddress(Address.parse(toAddress))
    .storeAddress(Address.parse(responseAddress))
    .storeBit(false) // no custom payload
    .storeCoins(toNano("0.02")) // forward TON for notification
    .storeBit(false)
    .endCell();
}
/**
 * Component for sending USDT on TON network
 * Uses only @tonconnect/ui-react (no @ton/core dependency)
 */
export function SendUSDT() {
  const [tonConnectUI] = useTonConnectUI();

  const send = async (usdt: number, toAddress: string) => {
    if (!tonConnectUI.account) {
      alert('Please connect your wallet first');
      return;
    }

    // User's Jetton wallet address - this should be derived from their TON wallet
    // by calling get_wallet_address() on the USDT Jetton Master contract
    const jettonWalletAddress = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
    const senderAddress = tonConnectUI.account?.address;

    const payload = buildJettonTransfer({
      amount: usdt * 1_000_000, // 1 USDT
      toAddress: toAddress,
      responseAddress: senderAddress
    });

    const result = await tonConnectUI.sendTransaction({
      validUntil: Math.floor(Date.now() / 1000) + 600,
      messages: [
        {
          address: jettonWalletAddress,
          amount: "50000000", // TON for gas (~0.05 TON)
          payload: payload.toBoc().toString("base64")
        }
      ]
    });
    console.log(result);
  };

  return (
    <button onClick={() => send(1, 'UQDwbxpqt_ps-V5H89mo8PWKErXuz__9fDRyU8HKgj4YdOah')}>
      Send USDT
    </button>
  );
}
