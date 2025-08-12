'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import printerService from '@/utils/printerService';
import { createClient } from '@/utils/supabase/client';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useRef, useState } from 'react';

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
};

// Helper function to validate UUID format
const isValidUUID = (str: string): boolean => {
	const uuidRegex =
		/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return uuidRegex.test(str);
};

export default function Home() {
	const [scanning, setScanning] = useState(false);
	const [scanResult, setScanResult] = useState<string | null>(null);
	const [participant, setParticipant] = useState<Participant | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [printing, setPrinting] = useState(false);
	const [searchInput, setSearchInput] = useState('');
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

	// Initialize QR code reader
	useEffect(() => {
		codeReaderRef.current = new BrowserMultiFormatReader();
		return () => {
			if (codeReaderRef.current) {
				codeReaderRef.current.reset();
			}
		};
	}, []);

	const stopCamera = useCallback(() => {
		if (codeReaderRef.current) {
			codeReaderRef.current.reset();
		}
		if (videoRef.current?.srcObject) {
			const stream = videoRef.current.srcObject as MediaStream;
			const tracks = stream.getTracks();
			tracks.forEach((track) => track.stop());
			videoRef.current.srcObject = null;
		}
	}, []);

	const fetchParticipant = useCallback(async (searchValue: string) => {
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
	}, []);

	const startCamera = useCallback(async () => {
		try {
			if (!codeReaderRef.current || !videoRef.current) return;

			const constraints = {
				video: {
					facingMode: 'environment',
					width: { ideal: 1280 },
					height: { ideal: 720 },
				},
			};

			const stream = await navigator.mediaDevices.getUserMedia(constraints);
			videoRef.current.srcObject = stream;

			// Start scanning for QR codes
			codeReaderRef.current.decodeFromVideoDevice(
				null, // Use default video device
				videoRef.current,
				(result, error) => {
					if (result) {
						const text = result.getText();
						setScanResult(text);
						fetchParticipant(text);
						setScanning(false);
						stopCamera();
					}
					if (error && !(error instanceof NotFoundException)) {
						console.error('QR Scan error:', error);
					}
				},
			);
		} catch (error) {
			console.error('Camera error:', error);
			setError(
				'Could not access camera. Please ensure you have granted camera permissions.',
			);
			setScanning(false);
		}
	}, [stopCamera, fetchParticipant]);

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
	}, [scanning, startCamera, stopCamera]);

	const handleManualScan = (id: string) => {
		setScanResult(id);
		fetchParticipant(id);
	};

	const handleSearchSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (searchInput.trim()) {
			handleManualScan(searchInput.trim());
		}
	};

	const handlePrint = async () => {
		if (!participant) return;
		setPrinting(true);
		try {
			const supabase = await createClient();

			// Mark participant as attended
			const { error: updateError } = await supabase
				.from('participants')
				.update({ attended: true })
				.eq('id', participant.id);

			if (updateError) throw updateError;

			// Try to print the label
			try {
				// biome-ignore lint/suspicious/noExplicitAny: Printer service has dynamic typing
				await (printerService as any).printParticipantLabel(participant);
				alert('Label printed successfully!');
			} catch (printError) {
				console.error('Print error:', printError);
				alert(
					`Attendance marked successfully, but printing failed: ${printError instanceof Error ? printError.message : 'Unknown error'}. Please ensure the printer service is running and a printer is connected.`,
				);
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
			<main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
				<div className="px-4 py-6 sm:px-0">
					{/* Header */}
					<div className="mb-6 text-center">
						<h1 className="text-2xl font-bold text-gray-900">
							Scan Your QR Code
						</h1>
						<p className="mt-1 text-sm text-gray-500">
							Point your camera at the QR code to check in
						</p>
					</div>

					{/* Scanning Interface */}
					{!scanning && !scanResult && (
						<Card>
							<CardHeader>
								<CardTitle className="text-center">Start Scanning</CardTitle>
								<CardDescription className="text-center">
									Use your camera to scan a QR code or enter an ID manually
								</CardDescription>
							</CardHeader>
							<CardContent className="text-center space-y-4">
								<Button
									onClick={() => setScanning(true)}
									className="w-full sm:w-auto"
								>
									Start Camera Scanning
								</Button>

								<div className="space-y-2">
									<p className="text-sm text-gray-500">
										Demo mode: Enter a participant ID or staff ID
									</p>
									<form
										onSubmit={handleSearchSubmit}
										className="max-w-sm mx-auto"
									>
										<div className="flex gap-2">
											<Input
												type="text"
												placeholder="Enter participant ID or staff ID"
												value={searchInput}
												onChange={(e) => setSearchInput(e.target.value)}
												className="flex-1"
											/>
											<Button type="submit" variant="outline">
												Search
											</Button>
										</div>
									</form>
								</div>
							</CardContent>
						</Card>
					)}

					{scanning && (
						<Card>
							<CardHeader>
								<CardTitle className="text-center">Camera Scanning</CardTitle>
								<CardDescription className="text-center">
									Point your camera at a QR code
								</CardDescription>
							</CardHeader>
							<CardContent className="text-center space-y-4">
								<div className="relative">
									<video
										ref={videoRef}
										autoPlay
										playsInline
										muted
										className="w-full max-w-md mx-auto rounded-lg border border-gray-300"
									>
										<track kind="captions" label="QR scanning" />
									</video>
									<canvas ref={canvasRef} className="hidden" />

									<div className="absolute inset-0 flex items-center justify-center">
										<div className="border-4 border-white rounded-lg w-64 h-64 animate-pulse"></div>
									</div>
								</div>

								<Button
									onClick={() => {
										setScanning(false);
										stopCamera();
									}}
									variant="outline"
									type="button"
								>
									Stop Scanning
								</Button>
							</CardContent>
						</Card>
					)}

					{loading && (
						<Card>
							<CardContent className="text-center py-8">
								<Spinner size="lg" />
								<p className="mt-4 text-sm text-gray-500">
									Loading participant data...
								</p>
							</CardContent>
						</Card>
					)}

					{error && (
						<Card>
							<CardContent className="text-center py-8">
								<Alert variant="destructive">
									<AlertDescription>{error}</AlertDescription>
								</Alert>
								<Button
									onClick={resetScan}
									variant="outline"
									className="mt-4"
									type="button"
								>
									Try Again
								</Button>
							</CardContent>
						</Card>
					)}

					{participant && (
						<Card>
							<CardHeader>
								<CardTitle className="text-center">
									Participant Details
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
									<div className="space-y-4">
										<div className="space-y-2">
											<p className="text-sm font-medium text-gray-500">Name</p>
											<p className="text-sm text-gray-900">
												{participant.title} {participant.first_name}{' '}
												{participant.last_name}
											</p>
										</div>
										<div className="space-y-2">
											<p className="text-sm font-medium text-gray-500">
												Staff ID
											</p>
											<p className="text-sm text-gray-900">
												{participant.staff_id}
											</p>
										</div>
										<div className="space-y-2">
											<p className="text-sm font-medium text-gray-500">Email</p>
											<p className="text-sm text-gray-900">
												{participant.email || 'N/A'}
											</p>
										</div>
										<div className="space-y-2">
											<p className="text-sm font-medium text-gray-500">Post</p>
											<p className="text-sm text-gray-900">
												{participant.post || 'N/A'}
											</p>
										</div>
										<div className="space-y-2">
											<p className="text-sm font-medium text-gray-500">
												Department
											</p>
											<p className="text-sm text-gray-900">
												{participant.department || 'N/A'}
											</p>
										</div>
										<div className="space-y-2">
											<p className="text-sm font-medium text-gray-500">
												Attendance
											</p>
											<Badge
												variant={
													participant.attended ? 'default' : 'destructive'
												}
											>
												{participant.attended ? 'Attended' : 'Not Attended'}
											</Badge>
										</div>
									</div>

									<div className="flex flex-col items-center space-y-4">
										<div className="text-center">
											<QRCodeSVG
												value={participant.id}
												size={128}
												level="H"
												includeMargin={true}
											/>
											<p className="mt-2 text-sm text-gray-500">Your QR Code</p>
										</div>

										<div className="space-y-3 w-full">
											<Button
												onClick={handlePrint}
												disabled={printing}
												className="w-full"
												type="button"
											>
												{printing ? (
													<>
														<Spinner size="sm" />
														<span className="ml-2">Printing...</span>
													</>
												) : (
													'Print Label'
												)}
											</Button>

											<Button
												onClick={resetScan}
												variant="outline"
												className="w-full"
												type="button"
											>
												Scan Another Code
											</Button>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					)}
				</div>
			</main>
		</div>
	);
}
