'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import printerService from '@/utils/printerService';
import { createClient } from '@/utils/supabase/client';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';

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

interface ParticipantCardProps {
	participant: Participant;
	onAttendanceUpdate?: (participant: Participant) => void;
	onReset?: () => void;
	showActions?: boolean;
	showLabelPreview?: boolean;
	className?: string;
}

export default function ParticipantCard({
	participant,
	onAttendanceUpdate,
	onReset,
	showActions = true,
	showLabelPreview = true,
	className = '',
}: ParticipantCardProps) {
	const [printing, setPrinting] = useState(false);

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

			// Update the participant data locally if callback provided
			if (onAttendanceUpdate) {
				onAttendanceUpdate({ ...participant, attended: true });
			}
		} catch (err: unknown) {
			const errorMessage =
				err instanceof Error
					? err.message
					: 'An error occurred while processing the request.';
			alert(errorMessage);
		} finally {
			setPrinting(false);
		}
	};

	return (
		<div className={`space-y-6 ${className}`}>
			{/* Main Participant Card */}
			<Card className="overflow-hidden">
				<CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="text-2xl font-bold">
								{participant.title} {participant.first_name}{' '}
								{participant.last_name}
							</CardTitle>
							<CardDescription className="text-blue-100 text-lg">
								Staff ID: {participant.staff_id}
							</CardDescription>
						</div>
						<div className="flex items-center space-x-3">
							<Badge
								variant={participant.attended ? 'default' : 'destructive'}
								className="text-sm px-3 py-1"
							>
								{participant.attended ? 'Attended' : 'Not Attended'}
							</Badge>
							<Button
								onClick={() =>
									window.open(
										`/admin/participants/form?edit=${participant.id}`,
										'_blank',
									)
								}
								variant="outline"
								size="sm"
								className="bg-white/10 border-white/20 text-white hover:bg-white/20"
							>
								Edit Details
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent className="p-8">
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
						{/* Participant Information */}
						<div className="lg:col-span-1 space-y-6">
							<h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
								Personal Information
							</h3>
							<div className="space-y-4">
								<div>
									<span className="text-sm font-medium text-gray-500 uppercase tracking-wide">
										Email
									</span>
									<p className="text-base text-gray-900 mt-1">
										{participant.email || 'Not provided'}
									</p>
								</div>
								<div>
									<span className="text-sm font-medium text-gray-500 uppercase tracking-wide">
										Position
									</span>
									<p className="text-base text-gray-900 mt-1">
										{participant.post || 'Not specified'}
									</p>
								</div>
								<div>
									<span className="text-sm font-medium text-gray-500 uppercase tracking-wide">
										Department
									</span>
									<p className="text-base text-gray-900 mt-1">
										{participant.department || 'Not specified'}
									</p>
								</div>
							</div>
						</div>

						{/* QR Code Section */}
						<div className="lg:col-span-1 flex flex-col items-center justify-center text-center">
							<div className="bg-white p-6 rounded-xl shadow-lg border-2 border-gray-100">
								<QRCodeSVG
									value={participant.id}
									size={200}
									level="H"
									includeMargin={true}
									className="mx-auto"
								/>
							</div>
							<p className="mt-4 text-sm font-medium text-gray-600">
								Scan this code for check-in
							</p>
							<p className="text-xs text-gray-500">
								ID: {participant.id.slice(0, 8)}...
							</p>
						</div>

						{/* Actions */}
						{showActions && (
							<div className="lg:col-span-1 space-y-6">
								<h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
									Actions
								</h3>
								<div className="space-y-4">
									<Button
										onClick={handlePrint}
										disabled={printing}
										className="w-full h-12 text-base font-medium"
										size="lg"
									>
										{printing ? (
											<>
												<Spinner size="sm" />
												<span className="ml-2">Printing...</span>
											</>
										) : (
											<>
												<svg
													className="w-5 h-5 mr-2"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<title>Print icon</title>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a1 1 0 001-1v-4a1 1 0 00-1-1H9a1 1 0 00-1 1v4a1 1 0 001 1zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
													/>
												</svg>
												Print Name Tag
											</>
										)}
									</Button>

									{onReset && (
										<Button
											onClick={onReset}
											variant="outline"
											className="w-full h-12 text-base font-medium"
											size="lg"
										>
											<svg
												className="w-5 h-5 mr-2"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<title>Reset icon</title>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
												/>
											</svg>
											Scan Another Code
										</Button>
									)}
								</div>
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Label Preview Card */}
			{showLabelPreview && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center">
							<svg
								className="w-5 h-5 mr-2"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<title>Preview icon</title>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
								/>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
								/>
							</svg>
							Label Preview
						</CardTitle>
						<CardDescription>
							This is how your name tag will appear when printed
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex justify-center">
							<div className="bg-white border-2 border-gray-300 rounded-lg p-6 shadow-lg max-w-md w-full">
								{/* Label Content */}
								<div className="text-center space-y-4">
									{/* Header */}
									<div className="border-b-2 border-gray-200 pb-3">
										<h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide">
											Event Badge
										</h2>
									</div>

									{/* Name */}
									<div>
										<h1 className="text-xl font-bold text-gray-900">
											{participant.title} {participant.first_name}{' '}
											{participant.last_name}
										</h1>
										{participant.post && (
											<p className="text-sm text-gray-600 mt-1">
												{participant.post}
											</p>
										)}
										{participant.department && (
											<p className="text-xs text-gray-500">
												{participant.department}
											</p>
										)}
									</div>

									{/* QR Code */}
									<div className="flex justify-center">
										<div className="bg-gray-50 p-3 rounded">
											<QRCodeSVG
												value={participant.id}
												size={80}
												level="H"
												includeMargin={false}
											/>
										</div>
									</div>

									{/* Staff ID */}
									<div className="border-t border-gray-200 pt-3">
										<p className="text-xs font-mono text-gray-500">
											ID: {participant.staff_id}
										</p>
									</div>
								</div>
							</div>
						</div>
						<p className="text-center text-sm text-gray-500 mt-4">
							* Actual size may vary depending on printer settings
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
