// Printer service utility for the QR attendance system
// This service handles the integration with the JC Printer SDK

export interface PrinterServiceInterface {
	isConnected: boolean;
	isPrinterConnected: boolean;
	initializePrinter(): Promise<void>;
	printParticipantLabel(participant: {
		id: string;
		staff_id: string;
		title: string;
		first_name: string;
		last_name: string;
		department?: string;
		post?: string;
	}): Promise<void>;
}

declare global {
	interface Window {
		// JC Printer SDK functions
		getInstance: (
			onServiceConnected: () => void,
			onNotSupportedService: () => void,
			onServiceDisconnected: () => void,
			onPrinterDisConnect: () => void,
		) => void;
		initSdk: (
			json: { fontDir: string },
			callback: (error: any, data: any) => void,
		) => void;
		getAllPrinters: (callback: (error: any, data: any) => void) => void;
		selectPrinter: (
			printerName: string,
			port: number,
			callback: (error: any, data: any) => void,
		) => void;
		InitDrawingBoard: (
			json: {
				width: number;
				height: number;
				rotate: number;
				path: string;
				verticalShift: number;
				HorizontalShift: number;
			},
			callback: (error: any, data: any) => void,
		) => void;
		DrawLableText: (
			json: {
				x: number;
				y: number;
				height: number;
				width: number;
				value: string;
				fontFamily: string;
				rotate: number;
				fontSize: number;
				textAlignHorizonral: number;
				textAlignVertical: number;
				letterSpacing: number;
				lineSpacing: number;
				lineMode: number;
				fontStyle: boolean[];
			},
			callback: (error: any, data: any) => void,
		) => void;
		DrawLableQrCode: (
			json: {
				x: number;
				y: number;
				height: number;
				width: number;
				value: string;
				codeType: number;
				rotate: number;
			},
			callback: (error: any, data: any) => void,
		) => void;
		startJob: (
			printDensity: number,
			printLabelType: number,
			printMode: number,
			count: number,
			callback: (error: any, data: any) => void,
		) => void;
		commitJob: (
			printData: any,
			printerImageProcessingInfo: string,
			callback: (error: any, data: any) => void,
		) => void;
		endJob: (callback: (error: any, data: any) => void) => void;
	}
}

class JCPrinterService implements PrinterServiceInterface {
	isConnected = false;
	isPrinterConnected = false;
	private allUsbPrinters: any = null;

	async initializePrinter(): Promise<void> {
		return new Promise((resolve, reject) => {
			// Check if SDK is loaded
			if (!window.getInstance) {
				reject(
					new Error(
						'JC Printer SDK not loaded. Please ensure the printer service is running.',
					),
				);
				return;
			}

			// Connect to printer service
			window.getInstance(
				() => {
					this.isConnected = true;
					console.log('Printer service connected');

					// Initialize SDK
					window.initSdk({ fontDir: '' }, (error, data) => {
						if (error) {
							reject(error);
							return;
						}

						const { errorCode, info } = JSON.parse(
							JSON.stringify(data),
						).resultAck;
						if (errorCode !== 0) {
							reject(new Error(info));
							return;
						}

						console.log('SDK initialized');
						this.setupPrinter()
							.then(() => resolve())
							.catch(reject);
					});
				},
				() => {
					reject(new Error('Printer service not supported'));
				},
				() => {
					this.isConnected = false;
					console.log('Printer service disconnected');
				},
				() => {
					this.isPrinterConnected = false;
					console.log('Printer disconnected');
				},
			);
		});
	}

	private async setupPrinter(): Promise<void> {
		return new Promise((resolve, reject) => {
			// Get available printers
			window.getAllPrinters((error, data) => {
				if (error) {
					reject(error);
					return;
				}

				const { errorCode, info } = JSON.parse(
					JSON.stringify(data),
				).resultAck;
				if (errorCode !== 0) {
					// No printers available, but don't reject - user can connect later
					console.log('No printers available');
					resolve();
					return;
				}

				this.allUsbPrinters = JSON.parse(info);
				const allPrintersName = Object.keys(this.allUsbPrinters);
				const allPrintersValue = Object.values(this.allUsbPrinters);

				if (allPrintersName.length > 0) {
					// Auto-select first available printer
					window.selectPrinter(
						allPrintersName[0],
						parseInt(allPrintersValue[0] as string),
						(error, data) => {
							if (error) {
								console.log('Could not connect to printer:', error.message);
								resolve(); // Don't reject, just continue without printer
								return;
							}

							const { errorCode } = JSON.parse(
								JSON.stringify(data),
							).resultAck;
							if (errorCode === 0) {
								this.isPrinterConnected = true;
								console.log('Printer connected successfully');
							}
							resolve();
						},
					);
				} else {
					resolve();
				}
			});
		});
	}

	async printParticipantLabel(participant: {
		id: string;
		staff_id: string;
		title: string;
		first_name: string;
		last_name: string;
		department?: string;
		post?: string;
	}): Promise<void> {
		if (!this.isConnected) {
			throw new Error('Printer service not connected');
		}

		return new Promise((resolve, reject) => {
			// Label dimensions (50mm x 30mm)
			const labelWidth = 50;
			const labelHeight = 30;
			const marginX = 2.0;
			const marginY = 2.0;

			// QR code dimensions
			const qrCodeSize = labelHeight - marginY * 2;
			const qrCodeX = marginX;
			const qrCodeY = marginY;

			// Text area dimensions
			const textAreaX = qrCodeX + qrCodeSize + marginX;
			const textAreaY = marginY;
			const textAreaWidth = labelWidth - qrCodeSize - marginX * 3;
			const textAreaHeight = qrCodeSize;

			const printData = {
				InitDrawingBoardParam: {
					width: labelWidth,
					height: labelHeight,
					rotate: 0,
					path: 'ZT001.ttf',
					verticalShift: 0,
					HorizontalShift: 0,
				},
				elements: [
					{
						type: 'qrCode',
						json: {
							x: qrCodeX,
							y: qrCodeY,
							height: qrCodeSize,
							width: qrCodeSize,
							value: participant.id,
							codeType: 31, // QR_CODE
							rotate: 0,
						},
					},
					{
						type: 'text',
						json: {
							x: textAreaX,
							y: textAreaY,
							height: textAreaHeight,
							width: textAreaWidth,
							value: `${participant.title} ${participant.first_name} ${participant.last_name}\\nID: ${participant.staff_id}\\n${participant.department || ''}\\n${participant.post || ''}`,
							fontFamily: '宋体',
							rotate: 0,
							fontSize: 3.2,
							textAlignHorizonral: 0, // Left align
							textAlignVertical: 1, // Vertical center
							letterSpacing: 0.0,
							lineSpacing: 1.0,
							lineMode: 6, // Fixed width/height with auto-scaling
							fontStyle: [false, false, false, false],
						},
					},
				],
			};

			this.executePrint(printData)
				.then(() => resolve())
				.catch(reject);
		});
	}

	private async executePrint(printData: any): Promise<void> {
		return new Promise((resolve, reject) => {
			// Print settings
			const printDensity = 3; // Default density
			const printLabelType = 1; // Gap paper
			const printMode = 1; // Thermal mode
			const printQuantity = 1;

			// Start print job
			window.startJob(
				printDensity,
				printLabelType,
				printMode,
				printQuantity,
				(error, data) => {
					if (error) {
						reject(error);
						return;
					}

					const { errorCode, info } = JSON.parse(
						JSON.stringify(data),
					).resultAck;
					if (errorCode !== 0) {
						reject(new Error(info));
						return;
					}

					// Initialize drawing board
					window.InitDrawingBoard(
						printData.InitDrawingBoardParam,
						(error, data) => {
							if (error) {
								reject(error);
								return;
							}

							const { errorCode, info } = JSON.parse(
								JSON.stringify(data),
							).resultAck;
							if (errorCode !== 0) {
								reject(new Error(info));
								return;
							}

							// Draw elements sequentially
							this.drawElements(printData.elements, 0, printQuantity)
								.then(() => resolve())
								.catch(reject);
						},
					);
				},
			);
		});
	}

	private async drawElements(
		elements: any[],
		index: number,
		printQuantity: number,
	): Promise<void> {
		return new Promise((resolve, reject) => {
			if (index >= elements.length) {
				// All elements drawn, commit the job
				const jsonObj = {
					printerImageProcessingInfo: {
						printQuantity: printQuantity,
					},
				};

				window.commitJob(null, JSON.stringify(jsonObj), (error, data) => {
					if (error) {
						reject(error);
						return;
					}

					const { errorCode, info } = JSON.parse(
						JSON.stringify(data),
					).resultAck;
					if (errorCode !== 0) {
						reject(new Error(info));
						return;
					}

					// End the job
					window.endJob((error, data) => {
						if (error) {
							reject(error);
							return;
						}
						resolve();
					});
				});
				return;
			}

			const element = elements[index];

			if (element.type === 'qrCode') {
				window.DrawLableQrCode(element.json, (error, data) => {
					if (error) {
						reject(error);
						return;
					}

					const { errorCode, info } = JSON.parse(
						JSON.stringify(data),
					).resultAck;
					if (errorCode !== 0) {
						reject(new Error(info));
						return;
					}

					// Draw next element
					this.drawElements(elements, index + 1, printQuantity)
						.then(() => resolve())
						.catch(reject);
				});
			} else if (element.type === 'text') {
				window.DrawLableText(element.json, (error, data) => {
					if (error) {
						reject(error);
						return;
					}

					const { errorCode, info } = JSON.parse(
						JSON.stringify(data),
					).resultAck;
					if (errorCode !== 0) {
						reject(new Error(info));
						return;
					}

					// Draw next element
					this.drawElements(elements, index + 1, printQuantity)
						.then(() => resolve())
						.catch(reject);
				});
			} else {
				// Skip unsupported element types
				this.drawElements(elements, index + 1, printQuantity)
					.then(() => resolve())
					.catch(reject);
			}
		});
	}
}

const printerService = new JCPrinterService();
export default printerService;
