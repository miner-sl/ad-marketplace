import {Address} from "@ton/core";

export function formatTonAddress(rawAddress: string): string {
  try {
    if (!rawAddress) return '';
    return Address.parse(rawAddress).toString();
  } catch (error) {
    console.error('Invalid TON address:', rawAddress);
    return rawAddress;
  }
}

/**
 * Converts raw TON address to non-bounceable format (UQ...)
 */
export function formatTonAddressNonBounceable(rawAddress: string): string {
  try {
    if (!rawAddress) return '';
    return Address.parse(rawAddress).toString({ bounceable: false });
  } catch (error) {
    console.error('Invalid TON address:', rawAddress);
    return rawAddress;
  }
}
