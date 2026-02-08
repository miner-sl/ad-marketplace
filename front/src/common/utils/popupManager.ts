import { popup } from '@tma.js/sdk-react';

type PopupButtonType = "default" | "destructive" | "ok" | "close" | "cancel";

interface PopupButton {
	id: string; // 0-64 chars
	type: PopupButtonType;
	text?: string; // Ignored for ok, close, cancel
}

interface PopupOptions {
	title: string; // 0-64 chars
	message: string; // 1-256 chars
	buttons: PopupButton[]; // 1-3 buttons
}

interface PopupResult {
	button_id?: string;
}

export class TelegramPopupManager {
	/**
	 * Opens a Telegram popup and resolves when the user closes it.
	 */
	public async openPopup(options: PopupOptions): Promise<PopupResult> {
		// Validate Telegram constraints for safety
		if (!options.title || options.title.length > 64) {
			throw new Error("Popup title must be 0-64 characters");
		}
		if (!options.message || options.message.length > 256) {
			throw new Error("Popup message must be 1-256 characters");
		}
		if (options.buttons.length < 1 || options.buttons.length > 3) {
			throw new Error("Popup must have between 1 and 3 buttons");
		}

		try {
			// Convert button types to match Telegram API
			const telegramButtons = options.buttons.map(btn => ({
				id: btn.id,
				text: btn.text || '',
				type: btn.type === 'ok' || btn.type === 'close' || btn.type === 'cancel' 
					? 'cancel' 
					: btn.type as 'default' | 'destructive' | 'cancel'
			}));

			// Use tma-js SDK popup.show() which returns a promise
			// It will throw an error if popup is not supported
			const buttonId = await popup.show({
				title: options.title,
				message: options.message,
				buttons: telegramButtons,
			});

			// popup.show() returns the button ID or null if closed without clicking
			return { button_id: buttonId || undefined };
		} catch (err) {
			// Re-throw with a more descriptive error if needed
			if (err instanceof Error) {
				throw err;
			}
			throw new Error("Failed to show popup");
		}
	}

	public dispose() {
		// Cleanup if needed in the future
	}
}

export const popupManager = new TelegramPopupManager();
