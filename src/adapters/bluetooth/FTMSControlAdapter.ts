import { logDebug } from "../../utils/errors";

const FTMS_CONTROL_OP_REQUEST_CONTROL = 0x00;
const FTMS_CONTROL_OP_RESET = 0x01;
const FTMS_CONTROL_OP_SET_TARGET_POWER = 0x05;

export class FTMSControlAdapter {
	private controlRequested = false;

	constructor(
		private readonly characteristic: BluetoothRemoteGATTCharacteristic,
	) {}

	async start(): Promise<void> {
		try {
			await this.characteristic.startNotifications();
		} catch (error) {
			logDebug("Starting control point indications was not clean", error);
		}
	}

	resetState(): void {
		this.controlRequested = false;
	}

	async reset(): Promise<void> {
		await this.ensureControlRequested();
		await this.write(new Uint8Array([FTMS_CONTROL_OP_RESET]).buffer);
	}

	async setTargetPower(watts: number): Promise<void> {
		await this.ensureControlRequested();
		const payload = new ArrayBuffer(3);
		const view = new DataView(payload);
		view.setUint8(0, FTMS_CONTROL_OP_SET_TARGET_POWER);
		view.setInt16(1, watts, true);
		await this.write(payload);
	}

	private async ensureControlRequested(): Promise<void> {
		if (this.controlRequested) {
			return;
		}

		await this.write(new Uint8Array([FTMS_CONTROL_OP_REQUEST_CONTROL]).buffer);
		this.controlRequested = true;
	}

	private async write(value: ArrayBuffer): Promise<void> {
		await (
			this.characteristic as BluetoothRemoteGATTCharacteristic & {
				writeValue: (buffer: BufferSource) => Promise<void>;
			}
		).writeValue(value);
	}
}
