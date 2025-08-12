'use client';

import { createClient } from '@/utils/supabase/client';
import printerService from '@/utils/printerService';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';

type Participant = {
	id: string;
	staff_id: string;
	title: string;
	first_name: string;
	last_name: string;
	email: string;
	post: string;
	department: string;
	attended: boolean;
	created_at: string;
};

export default function LandingPage() {
	const [scanning, setScanning] = useState(false);
	const [scanResult, setScanResult] = useState<string | null>(null);
	const [participant, setParticipant] = useState<Participant | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [printing, setPrinting] = useState(false);
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const router = useRouter();

	// Initialize camera for QR scanning
	useEffect(() => {
		if (scanning) {
			startCamera();
		} else {
			stopCamera();
		}

		return () => {
			stopCamera();
		};
	}, [scanning]);

	const startCamera = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'environment' },
			});

			if (videoRef.current) {
				videoRef.current.srcObject = stream;
			}

			// Start scanning for QR codes
			scanQRCode();
		} catch (err) {
			setError(
				'Could not access camera. Please ensure you have granted camera permissions.',
			);
			setScanning(false);
		}
	};

	const stopCamera = () => {
		if (videoRef.current && videoRef.current.srcObject) {
			const stream = videoRef.current.srcObject as MediaStream;
			const tracks = stream.getTracks();
			tracks.forEach((track) => track.stop());
			videoRef.current.srcObject = null;
		}
	};

	const scanQRCode = () => {
		if (!scanning) return;

		const scan = async () => {
			if (videoRef.current && canvasRef.current) {
				const video = videoRef.current;
				const canvas = canvasRef.current;
				const ctx = canvas.getContext('2d');

				if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
					canvas.width = video.videoWidth;
					canvas.height = video.videoHeight;
					ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

					// In a real implementation, you would use a QR code scanning library here
					// For now, we'll simulate scanning with a manual input
				}
			}

			if (scanning) {
				requestAnimationFrame(scan);
			}
		};

		scan();
	};

	const handleManualScan = (id: string) => {
		setScanResult(id);
		fetchParticipant(id);
	};

	// Function to validate if a string is a valid UUID
	const isValidUUID = (str: string): boolean => {
		const uuidRegex =
			/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		return uuidRegex.test(str);
	};

	const fetchParticipant = async (searchValue: string) => {
		setLoading(true);
		setError(null);
		try {
			const supabase = await createClient();
			let data = null;
			let error = null;

			// Check if the input looks like a UUID
			if (isValidUUID(searchValue)) {
				// Try to find by participant ID (UUID)
				const result = await supabase
					.from('participants')
					.select('*')
					.eq('id', searchValue)
					.single();

				data = result.data;
				error = result.error;
			}

			// If not found by ID or input is not a UUID, try to find by staff_id
			if (!data) {
				const result = await supabase
					.from('participants')
					.select('*')
					.eq('staff_id', searchValue)
					.single();

				if (result.data) {
					data = result.data;
					error = null;
				} else if (result.error && result.error.code !== 'PGRST116') {
					error = result.error;
				}
			}

			// Check if we found any data
			if (error && error.code !== 'PGRST116') {
				throw error;
			}

			if (!data) {
				throw new Error(
					'Participant not found with the provided ID or Staff ID',
				);
			}

			setParticipant(data);
		} catch (err: unknown) {
			const errorMessage =
				err instanceof Error
					? err.message
					: 'An error occurred while fetching participant data.';
			setError(errorMessage);
			setParticipant(null);
		} finally {
			setLoading(false);
		}
	};

	const handlePrint = async () => {
		if (!participant) return;
		setPrinting(true);
		try {
			const supabase = await createClient();
			const printer = printerService as any; // Type assertion for the printer service
			
			// First, try to initialize the printer if not already connected
			if (!printer.isConnected) {
				try {
					await printer.initializePrinter();
				} catch (printerError) {
					console.warn('Could not initialize printer:', printerError);
					// Continue with database update even if printer fails
				}
			}
			
			// Mark participant as attended
			const { error: updateError } = await supabase
				.from('participants')
				.update({ attended: true })
				.eq('id', participant.id);
				
			if (updateError) throw updateError;
			
			// Try to print the label
			try {
				await printer.printParticipantLabel(participant);
				alert('Label printed successfully!');
			} catch (printError) {
				console.error('Print error:', printError);
				alert(`Attendance marked successfully, but printing failed: ${printError instanceof Error ? printError.message : 'Unknown error'}. Please ensure the printer service is running and a printer is connected.`);
			}
			
			// Refresh participant data to show updated attendance status
			await fetchParticipant(participant.id);
		} catch (err: unknown) {
			const errorMessage =
				err instanceof Error
					? err.message
					: 'An error occurred while processing the request.';
			setError(errorMessage);
		} finally {
			setPrinting(false);
		}
	};

	const resetScan = () => {
		setScanResult(null);
		setParticipant(null);
		setError(null);
	};

	return (
		<div className="min-h-screen bg-gray-50">
			<nav className="bg-white shadow">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between h-16">
						<div className="flex-shrink-0 flex items-center">
							<h1 className="text-xl font-bold">QR Attendance System</h1>
						</div>
					</div>
				</div>
			</nav>

			<main>
				<div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
					<div className="px-4 py-6 sm:px-0">
						<div className="mb-6 text-center">
							<h1 className="text-2xl font-bold text-gray-900">
								Scan Your QR Code
							</h1>
							<p className="mt-1 text-sm text-gray-500">
								Point your camera at the QR code to check in
							</p>
						</div>

						{!scanning && !scanResult && (
							<div className="bg-white shadow sm:rounded-lg">
								<div className="px-4 py-5 sm:p-6">
									<div className="text-center">
										<button
											onClick={() => setScanning(true)}
											className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
											type="button"
										>
											Start Scanning
										</button>

										<div className="mt-6">
											<p className="text-sm text-gray-500">
												Demo mode: Enter a participant ID or staff ID to
												simulate scanning
											</p>
											<div className="mt-2 max-w-xs mx-auto">
												<input
													type="text"
													placeholder="Enter participant ID or staff ID"
													className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
													onKeyDown={(e) => {
														if (e.key === 'Enter') {
															const target = e.target as HTMLInputElement;
															if (target.value) {
																handleManualScan(target.value);
															}
														}
													}}
												/>
											</div>
										</div>
									</div>
								</div>
							</div>
						)}

						{scanning && (
							<div className="bg-white shadow sm:rounded-lg">
								<div className="px-4 py-5 sm:p-6">
									<div className="text-center">
										<h3 className="text-lg leading-6 font-medium text-gray-900">
											Camera Scanning
										</h3>
										<p className="mt-1 text-sm text-gray-500">
											Point your camera at a QR code
										</p>

										<div className="mt-4 relative">
											<video
												ref={videoRef}
												autoPlay
												playsInline
												className="w-full max-w-md mx-auto rounded-lg border border-gray-300"
											/>
											<canvas ref={canvasRef} className="hidden" />

											<div className="absolute inset-0 flex items-center justify-center">
												<div className="border-4 border-white rounded-lg w-64 h-64 animate-pulse"></div>
											</div>
										</div>

										<button
											onClick={() => {
												setScanning(false);
												stopCamera();
											}}
											className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
											type="button"
										>
											Stop Scanning
										</button>
									</div>
								</div>
							</div>
						)}

						{loading && (
							<div className="bg-white shadow sm:rounded-lg">
								<div className="px-4 py-5 sm:p-6">
									<div className="text-center">
										<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
										<p className="mt-2 text-sm text-gray-500">
											Loading participant data...
										</p>
									</div>
								</div>
							</div>
						)}

						{error && (
							<div className="bg-white shadow sm:rounded-lg">
								<div className="px-4 py-5 sm:p-6">
									<div className="text-center">
										<div className="rounded-md bg-red-50 p-4">
											<div className="text-sm text-red-700">{error}</div>
										</div>
										<button
											onClick={resetScan}
											className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
											type="button"
										>
											Try Again
										</button>
									</div>
								</div>
							</div>
						)}

						{participant && (
							<div className="bg-white shadow sm:rounded-lg">
								<div className="px-4 py-5 sm:p-6">
									<div className="text-center">
										<h3 className="text-lg leading-6 font-medium text-gray-900">
											Participant Details
										</h3>

										<div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
											<div className="border-t border-gray-200 pt-4">
												<dl>
													<div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
														<dt className="text-sm font-medium text-gray-500">
															Name
														</dt>
														<dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
															{participant.title} {participant.first_name}{' '}
															{participant.last_name}
														</dd>
													</div>
													<div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
														<dt className="text-sm font-medium text-gray-500">
															Staff ID
														</dt>
														<dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
															{participant.staff_id}
														</dd>
													</div>
													<div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
														<dt className="text-sm font-medium text-gray-500">
															Email
														</dt>
														<dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
															{participant.email || 'N/A'}
														</dd>
													</div>
													<div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
														<dt className="text-sm font-medium text-gray-500">
															Post
														</dt>
														<dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
															{participant.post || 'N/A'}
														</dd>
													</div>
													<div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
														<dt className="text-sm font-medium text-gray-500">
															Department
														</dt>
														<dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
															{participant.department || 'N/A'}
														</dd>
													</div>
													<div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
														<dt className="text-sm font-medium text-gray-500">
															Attendance
														</dt>
														<dd className="mt-1 text-sm sm:col-span-2 sm:mt-0">
															<span
																className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${participant.attended ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
															>
																{participant.attended
																	? 'Attended'
																	: 'Not Attended'}
															</span>
														</dd>
													</div>
												</dl>
											</div>

											<div className="border-t border-gray-200 pt-4">
												<div className="flex flex-col items-center">
													<QRCodeSVG
														value={participant.id}
														size={128}
														level="H"
														includeMargin={true}
													/>
													<p className="mt-2 text-sm text-gray-500">
														Your QR Code
													</p>
												</div>

												<div className="mt-6">
													<button
														onClick={handlePrint}
														disabled={printing}
														className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
														type="button"
													>
														{printing ? (
															<>
																<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
																Printing...
															</>
														) : (
															'Print Label'
														)}
													</button>

													<button
														onClick={resetScan}
														className="mt-3 w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
														type="button"
													>
														Scan Another Code
													</button>
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</main>
		</div>
	);
}
