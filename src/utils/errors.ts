const DEFAULT_ERROR_MESSAGE =
	"Something went wrong while talking to the trainer.";

const ERROR_MESSAGES: Record<string, string> = {
	InvalidStateError: "The trainer connection is not in a usable state yet.",
	NetworkError:
		"Could not connect to the trainer. Make sure it is awake and nearby.",
	NotAllowedError:
		"Bluetooth permission was denied. Allow access and try again.",
	NotFoundError: "No trainer was selected in the Bluetooth picker.",
	NotSupportedError:
		"This app currently requires Chrome or Edge with Web Bluetooth support.",
	SecurityError:
		"Web Bluetooth requires HTTPS or localhost. Open the app in a secure context and try again.",
};

export function getUserFacingError(error: unknown): string {
	if (error instanceof DOMException) {
		return ERROR_MESSAGES[error.name] ?? error.message ?? DEFAULT_ERROR_MESSAGE;
	}

	if (error instanceof Error && error.message.trim()) {
		return error.message;
	}

	if (typeof error === "string" && error.trim()) {
		return error;
	}

	return DEFAULT_ERROR_MESSAGE;
}

export function logDebug(message: string, details?: unknown): void {
	if (import.meta.env.DEV) {
		console.debug(`[trainer] ${message}`, details);
	}
}

export function logError(message: string, error: unknown): void {
	console.error(`[trainer] ${message}`, error);
}
