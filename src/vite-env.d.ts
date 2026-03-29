/// <reference types="vite/client" />

type BluetoothServiceUUID = number | string;
type BluetoothCharacteristicUUID = number | string;

interface BluetoothLEScanFilter {
	name?: string;
	namePrefix?: string;
	services?: BluetoothServiceUUID[];
}

interface RequestDeviceOptions {
	acceptAllDevices?: boolean;
	filters?: BluetoothLEScanFilter[];
	optionalServices?: BluetoothServiceUUID[];
}

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
	readonly uuid: string;
	readonly value?: DataView;
	startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
	stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
	readValue(): Promise<DataView>;
}

interface BluetoothRemoteGATTService {
	readonly uuid: string;
	getCharacteristic(
		characteristic: BluetoothCharacteristicUUID,
	): Promise<BluetoothRemoteGATTCharacteristic>;
	getCharacteristics(
		characteristic?: BluetoothCharacteristicUUID,
	): Promise<BluetoothRemoteGATTCharacteristic[]>;
}

interface BluetoothRemoteGATTServer {
	readonly connected: boolean;
	connect(): Promise<BluetoothRemoteGATTServer>;
	disconnect(): void;
	getPrimaryService(
		service: BluetoothServiceUUID,
	): Promise<BluetoothRemoteGATTService>;
	getPrimaryServices(
		service?: BluetoothServiceUUID,
	): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothDevice extends EventTarget {
	readonly id: string;
	readonly name?: string;
	readonly gatt?: BluetoothRemoteGATTServer;
}

interface Bluetooth extends EventTarget {
	requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
}

interface Navigator {
	readonly bluetooth: Bluetooth;
}
