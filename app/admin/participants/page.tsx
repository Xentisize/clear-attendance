'use client';

import ParticipantCard from '@/components/ParticipantCard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from '@/components/ui/pagination';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
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
	created_at: string;
};

export default function ParticipantsPage() {
	const [loading, setLoading] = useState(true);
	const [participants, setParticipants] = useState<Participant[]>([]);
	const [filteredParticipants, setFilteredParticipants] = useState<
		Participant[]
	>([]);
	const [paginatedParticipants, setPaginatedParticipants] = useState<
		Participant[]
	>([]);
	const [searchQuery, setSearchQuery] = useState('');
	const [uploading, setUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
	const [showUploadForm, setShowUploadForm] = useState(false);
	const [showQRModal, setShowQRModal] = useState<{
		participant: Participant;
		show: boolean;
	} | null>(null);
	const [selectedParticipant, setSelectedParticipant] =
		useState<Participant | null>(null);
	const [attendanceFilter, setAttendanceFilter] = useState<
		'all' | 'attended' | 'not-attended'
	>('all');
	const [currentPage, setCurrentPage] = useState(1);
	const [itemsPerPage] = useState(10);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const router = useRouter();

	const fetchParticipants = useCallback(async () => {
		const supabase = await createClient();
		const { data, error } = await supabase
			.from('participants')
			.select('*')
			.order('created_at', { ascending: false });

		if (error) {
			console.error('Error fetching participants:', error);
			return;
		}

		setParticipants(data || []);
		setFilteredParticipants(data || []);
	}, []);

	useEffect(() => {
		const checkUser = async () => {
			const supabase = await createClient();
			const {
				data: { session },
			} = await supabase.auth.getSession();

			if (!session) {
				router.push('/admin/login');
				return;
			}

			// Check if user is admin
			const { data: adminData, error: adminError } = await supabase
				.from('admins')
				.select('id, email, name')
				.eq('email', session.user.email)
				.single();

			if (adminError || !adminData) {
				// Sign out if not admin
				await supabase.auth.signOut();
				router.push('/admin/login');
				return;
			}

			await fetchParticipants();
			setLoading(false);
		};

		checkUser();
	}, [router, fetchParticipants]);

	// Search, filter, and pagination functionality
	useEffect(() => {
		let filtered = participants;

		// Apply search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(participant) =>
					participant.id.toLowerCase().includes(query) ||
					participant.staff_id.toLowerCase().includes(query) ||
					participant.first_name.toLowerCase().includes(query) ||
					participant.last_name.toLowerCase().includes(query) ||
					participant.title.toLowerCase().includes(query) ||
					participant.email.toLowerCase().includes(query) ||
					participant.post.toLowerCase().includes(query) ||
					participant.department.toLowerCase().includes(query),
			);
		}

		// Apply attendance filter
		if (attendanceFilter !== 'all') {
			filtered = filtered.filter((participant) => {
				if (attendanceFilter === 'attended') {
					return participant.attended;
				}
				return !participant.attended;
			});
		}

		setFilteredParticipants(filtered);

		// Reset to first page when filters change
		setCurrentPage(1);

		// Apply pagination
		const startIndex = 0; // First page
		const endIndex = Math.min(itemsPerPage, filtered.length);
		setPaginatedParticipants(filtered.slice(startIndex, endIndex));
	}, [participants, searchQuery, attendanceFilter, itemsPerPage]);

	// Update paginated participants when page changes
	useEffect(() => {
		const startIndex = (currentPage - 1) * itemsPerPage;
		const endIndex = startIndex + itemsPerPage;
		setPaginatedParticipants(filteredParticipants.slice(startIndex, endIndex));
	}, [currentPage, filteredParticipants, itemsPerPage]);

	// Calculate pagination info
	const totalPages = Math.ceil(filteredParticipants.length / itemsPerPage);
	const startItem = (currentPage - 1) * itemsPerPage + 1;
	const endItem = Math.min(
		currentPage * itemsPerPage,
		filteredParticipants.length,
	);

	const handleFileUpload = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		if (!file) return;

		if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
			setUploadError('Please upload a CSV file.');
			return;
		}

		setUploading(true);
		setUploadError(null);
		setUploadSuccess(null);

		try {
			const text = await file.text();
			const lines = text.split('\n').filter((line) => line.trim() !== '');

			if (lines.length < 2) {
				throw new Error(
					'CSV file must contain headers and at least one row of data.',
				);
			}

			// Parse headers
			const headers = lines[0]
				.split(',')
				.map((header) => header.trim().toLowerCase());
			const requiredHeaders = [
				'staff id',
				'title',
				'first_name',
				'last_name',
				'email',
				'post',
				'department',
			];

			// Check if all required headers are present
			const missingHeaders = requiredHeaders.filter(
				(header) => !headers.includes(header),
			);
			if (missingHeaders.length > 0) {
				throw new Error(
					`Missing required headers: ${missingHeaders.join(', ')}`,
				);
			}

			// Parse data rows
			const participantsData = [];
			for (let i = 1; i < lines.length; i++) {
				const values = lines[i].split(',').map((value) => value.trim());
				if (values.length !== headers.length) continue;

				const participant: Record<string, string> = {};
				headers.forEach((header, index) => {
					// Convert header names to match database column names
					const dbHeader = header === 'staff id' ? 'staff_id' : header;
					participant[dbHeader] = values[index] || '';
				});

				participantsData.push(participant);
			}

			if (participantsData.length === 0) {
				throw new Error('No valid participant data found in CSV.');
			}

			// Insert participants into database
			const supabase = await createClient();
			const { error: insertError } = await supabase
				.from('participants')
				.insert(participantsData);

			if (insertError) throw insertError;

			setUploadSuccess(
				`Successfully uploaded ${participantsData.length} participants.`,
			);
			await fetchParticipants(); // Refresh the participant list

			// Clear the file input
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		} catch (error: unknown) {
			console.error('Upload error:', error);
			const errorMessage =
				error instanceof Error
					? error.message
					: 'An error occurred while uploading the file.';
			setUploadError(errorMessage);
		} finally {
			setUploading(false);
		}
	};

	const handleDeleteParticipant = async (id: string) => {
		console.log('Delete function called with id:', id);

		if (!confirm('Are you sure you want to delete this participant?')) {
			console.log('Delete cancelled by user');
			return;
		}

		console.log('Proceeding with delete...');
		try {
			const supabase = await createClient();

			// First check if the participant exists
			const { data: participant, error: fetchError } = await supabase
				.from('participants')
				.select('*')
				.eq('id', id)
				.single();

			if (fetchError || !participant) {
				throw new Error('Participant not found');
			}

			// Delete the participant
			const { error } = await supabase
				.from('participants')
				.delete()
				.eq('id', id);

			if (error) throw error;

			// Refresh the participant list
			await fetchParticipants();

			// Close participant details modal if this participant was selected
			if (selectedParticipant?.id === id) {
				setSelectedParticipant(null);
			}

			alert('Participant deleted successfully!');
		} catch (error: unknown) {
			console.error('Delete error:', error);
			const errorMessage =
				error instanceof Error
					? error.message
					: 'An error occurred while deleting the participant.';
			alert(`Failed to delete participant: ${errorMessage}`);
		}
	};

	const openQRModal = (participant: Participant) => {
		setShowQRModal({ participant, show: true });
	};

	const closeQRModal = () => {
		setShowQRModal(null);
	};

	const viewParticipantDetails = (participant: Participant) => {
		setSelectedParticipant(participant);
	};

	const closeParticipantDetails = () => {
		setSelectedParticipant(null);
	};

	const handleParticipantUpdate = (updatedParticipant: Participant) => {
		setSelectedParticipant(updatedParticipant);
		// Also update the participant in the main list
		setParticipants((prev) =>
			prev.map((p) =>
				p.id === updatedParticipant.id ? updatedParticipant : p,
			),
		);
	};

	const downloadQRCode = (participant: Participant) => {
		const svg = document.getElementById(
			`qr-code-${participant.id}`,
		) as unknown as SVGElement;
		if (svg) {
			// Get the SVG data
			const svgData = new XMLSerializer().serializeToString(svg);
			const svgBlob = new Blob([svgData], {
				type: 'image/svg+xml;charset=utf-8',
			});

			// Create a canvas to convert SVG to PNG
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			const img = new Image();

			img.onload = () => {
				canvas.width = img.width;
				canvas.height = img.height;
				ctx?.drawImage(img, 0, 0);

				// Convert to PNG and download
				const url = canvas.toDataURL('image/png');
				const link = document.createElement('a');
				link.href = url;
				link.download = `qr-code-${participant.staff_id}.png`;
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
			};

			// Convert SVG to data URL for the image
			const svgUrl = URL.createObjectURL(svgBlob);
			img.src = svgUrl;
		}
	};

	const downloadAllQRs = async () => {
		if (participants.length === 0) {
			alert('No participants found to generate QR codes for.');
			return;
		}

		try {
			const QRCode = (await import('qrcode')).default;
			let downloadCount = 0;

			for (const participant of participants) {
				try {
					// Generate QR code as data URL
					const qrDataURL = await QRCode.toDataURL(participant.id, {
						width: 256,
						margin: 2,
						color: {
							dark: '#000000',
							light: '#FFFFFF',
						},
					});

					// Create download link
					const link = document.createElement('a');
					link.href = qrDataURL;
					link.download = `qr-${participant.staff_id}-${participant.first_name}_${participant.last_name}.png`;
					document.body.appendChild(link);
					link.click();
					document.body.removeChild(link);

					downloadCount++;

					// Add small delay between downloads to avoid overwhelming the browser
					await new Promise((resolve) => setTimeout(resolve, 200));
				} catch (error) {
					console.error(
						`Error generating QR code for ${participant.staff_id}:`,
						error,
					);
				}
			}

			alert(
				`Successfully downloaded ${downloadCount} out of ${participants.length} QR codes!`,
			);
		} catch (error) {
			console.error('Error in downloadAllQRs:', error);
			alert(
				'Error generating QR codes. Please try downloading individual QR codes instead.',
			);
		}
	};

	const exportParticipantsToCSV = () => {
		if (filteredParticipants.length === 0) {
			alert('No participants found to export.');
			return;
		}

		try {
			// Define CSV headers
			const headers = [
				'Staff ID',
				'Title',
				'First Name',
				'Last Name',
				'Email',
				'Post',
				'Department',
				'Attended',
				'Created At',
			];

			// Convert participants data to CSV format
			const csvData = filteredParticipants.map((participant) => [
				participant.staff_id,
				participant.title,
				participant.first_name,
				participant.last_name,
				participant.email,
				participant.post,
				participant.department,
				participant.attended ? 'Yes' : 'No',
				new Date(participant.created_at).toLocaleDateString(),
			]);

			// Combine headers and data
			const csvContent = [headers, ...csvData]
				.map((row) => row.map((field) => `"${field}"`).join(','))
				.join('\n');

			// Create and download the file
			const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
			const link = document.createElement('a');
			const url = URL.createObjectURL(blob);
			link.setAttribute('href', url);

			// Generate filename with current date and filter info
			const now = new Date();
			const dateStr = now.toISOString().split('T')[0];
			let filterSuffix = '';
			if (searchQuery) {
				filterSuffix += `_search-${searchQuery.replace(/[^a-zA-Z0-9]/g, '')}`;
			}
			if (attendanceFilter !== 'all') {
				filterSuffix += `_${attendanceFilter}`;
			}

			link.setAttribute(
				'download',
				`participants_${dateStr}${filterSuffix}.csv`,
			);
			link.style.visibility = 'hidden';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);

			alert(
				`Successfully exported ${filteredParticipants.length} participants to CSV!`,
			);
		} catch (error) {
			console.error('Error exporting CSV:', error);
			alert('Error exporting participants to CSV. Please try again.');
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<main>
				<div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
					<div className="px-4 py-6 sm:px-0">
						<div className="mb-6">
							<h1 className="text-2xl font-bold text-gray-900">
								Participants Management
							</h1>
							<p className="mt-1 text-sm text-gray-500">
								Upload participant lists and manage attendees
							</p>
						</div>

						{/* Search Bar and Filters */}
						<div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<Label htmlFor="search" className="mb-2">
									Search Participants
								</Label>
								<Input
									type="text"
									id="search"
									placeholder="Search by ID, staff ID, name, email, post, or department..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
								/>
							</div>
							<div>
								<Label htmlFor="attendanceFilter" className="mb-2">
									Filter by Attendance
								</Label>
								<select
									id="attendanceFilter"
									value={attendanceFilter}
									onChange={(e) =>
										setAttendanceFilter(
											e.target.value as 'all' | 'attended' | 'not-attended',
										)
									}
									className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								>
									<option value="all">All Participants</option>
									<option value="attended">Attended Only</option>
									<option value="not-attended">Not Attended Only</option>
								</select>
							</div>
						</div>

						{/* Action Buttons */}
						<div className="mb-6 flex flex-wrap gap-3">
							<Button
								onClick={exportParticipantsToCSV}
								variant="secondary"
								className="bg-blue-600 hover:bg-blue-700 text-white"
							>
								Export Filtered Data (CSV)
							</Button>
							<Button
								onClick={downloadAllQRs}
								variant="secondary"
								className="bg-green-600 hover:bg-green-700 text-white"
							>
								Export All QR Codes
							</Button>
							<Button onClick={() => router.push('/admin/participants/form')}>
								Add Participant
							</Button>
							<Button
								onClick={() => {
									setShowUploadForm(!showUploadForm);
								}}
								variant="secondary"
							>
								{showUploadForm ? 'Hide' : 'Upload CSV'}
							</Button>
						</div>

						{/* Upload Section */}
						{showUploadForm && (
							<Card className="mb-6">
								<CardHeader>
									<CardTitle>Upload Participant List</CardTitle>
									<CardDescription>
										Upload a CSV file with participant information. The file
										should include the following headers: staff id, title,
										first_name, last_name, email, post, department
									</CardDescription>
								</CardHeader>
								<CardContent>
									{uploadError && (
										<Alert variant="destructive" className="mb-4">
											<AlertDescription>{uploadError}</AlertDescription>
										</Alert>
									)}

									{uploadSuccess && (
										<Alert className="mb-4">
											<AlertDescription>{uploadSuccess}</AlertDescription>
										</Alert>
									)}

									<div>
										<Input
											ref={fileInputRef}
											type="file"
											accept=".csv"
											onChange={handleFileUpload}
											disabled={uploading}
											className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
										/>
										{uploading && (
											<div className="mt-2 flex items-center">
												<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
												<span className="text-sm text-muted-foreground">
													Uploading and processing...
												</span>
											</div>
										)}
									</div>
								</CardContent>
							</Card>
						)}

						{/* Participants List */}
						<div className="bg-white shadow sm:rounded-lg">
							<div className="px-4 py-5 sm:p-6">
								<h3 className="text-lg leading-6 font-medium text-gray-900">
									Participants ({filteredParticipants.length}{' '}
									{searchQuery || attendanceFilter !== 'all'
										? `of ${participants.length}`
										: 'total'}
									)
									{filteredParticipants.length > itemsPerPage && (
										<span className="text-sm font-normal text-gray-500 ml-2">
											(Showing {startItem}-{endItem} of{' '}
											{filteredParticipants.length})
										</span>
									)}
								</h3>
								<div className="mt-4">
									{filteredParticipants.length === 0 ? (
										<div className="text-center py-12">
											<svg
												className="mx-auto h-12 w-12 text-gray-400"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												aria-hidden="true"
											>
												<title>No participants found</title>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 515.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 616 0zm6 3a2 2 0 11-4 0 2 2 0 414 0zM7 10a2 2 0 11-4 0 2 2 0 414 0z"
												/>
											</svg>
											<h3 className="mt-2 text-sm font-medium text-gray-900">
												{searchQuery
													? 'No participants found'
													: 'No participants'}
											</h3>
											<p className="mt-1 text-sm text-gray-500">
												{searchQuery
													? 'Try adjusting your search terms.'
													: 'Get started by uploading a CSV file with participant data.'}
											</p>
										</div>
									) : (
										<div className="overflow-x-auto">
											<table className="min-w-full divide-y divide-gray-200">
												<thead className="bg-gray-50">
													<tr>
														<th
															scope="col"
															className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
														>
															Staff ID
														</th>
														<th
															scope="col"
															className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
														>
															Name
														</th>
														<th
															scope="col"
															className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
														>
															Email
														</th>
														<th
															scope="col"
															className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
														>
															Post
														</th>
														<th
															scope="col"
															className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
														>
															Department
														</th>
														<th
															scope="col"
															className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
														>
															Attended
														</th>
														<th
															scope="col"
															className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
														>
															Actions
														</th>
													</tr>
												</thead>
												<tbody className="bg-white divide-y divide-gray-200">
													{paginatedParticipants.map((participant) => (
														<tr
															key={participant.id}
															className={
																participant.attended ? 'bg-purple-50' : ''
															}
														>
															<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
																{participant.staff_id}
															</td>
															<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
																<button
																	onClick={() =>
																		viewParticipantDetails(participant)
																	}
																	className="text-blue-600 hover:text-blue-900 underline cursor-pointer"
																	type="button"
																>
																	{participant.title} {participant.first_name}{' '}
																	{participant.last_name}
																</button>
															</td>
															<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
																{participant.email}
															</td>
															<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
																{participant.post}
															</td>
															<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
																{participant.department}
															</td>
															<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
																<span
																	className={`font-medium ${participant.attended ? 'text-green-600' : 'text-red-600'}`}
																>
																	{participant.attended ? 'Yes' : 'No'}
																</span>
															</td>
															<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
																<div className="flex items-center space-x-2">
																	<Button
																		variant="ghost"
																		size="sm"
																		onClick={(e) => {
																			e.preventDefault();
																			e.stopPropagation();
																			openQRModal(participant);
																		}}
																		className="text-indigo-600 hover:text-indigo-900 h-auto p-1"
																		title="View QR Code"
																		type="button"
																	>
																		<svg
																			className="w-4 h-4"
																			fill="none"
																			stroke="currentColor"
																			viewBox="0 0 24 24"
																		>
																			<title>QR Code</title>
																			<path
																				strokeLinecap="round"
																				strokeLinejoin="round"
																				strokeWidth={2}
																				d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 16h4.01M12 16h.01m0 0h4.01M12 20h4.01M12 8h.01M8 12h.01M8 8h.01m0 12h4.01M4 12h4.01M4 8h.01m0 8h.01M4 20h4.01"
																			/>
																		</svg>
																	</Button>
																	<Button
																		variant="ghost"
																		size="sm"
																		onClick={(e) => {
																			e.preventDefault();
																			e.stopPropagation();
																			router.push(
																				`/admin/participants/form?edit=${participant.id}`,
																			);
																		}}
																		className="text-indigo-600 hover:text-indigo-900 h-auto p-1"
																		title="Edit Participant"
																		type="button"
																	>
																		<svg
																			className="w-4 h-4"
																			fill="none"
																			stroke="currentColor"
																			viewBox="0 0 24 24"
																		>
																			<title>Edit</title>
																			<path
																				strokeLinecap="round"
																				strokeLinejoin="round"
																				strokeWidth={2}
																				d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
																			/>
																		</svg>
																	</Button>
																	<Button
																		variant="ghost"
																		size="sm"
																		onClick={(e) => {
																			e.preventDefault();
																			e.stopPropagation();
																			handleDeleteParticipant(participant.id);
																		}}
																		className="text-red-600 hover:text-red-900 h-auto p-1"
																		title="Delete Participant"
																		type="button"
																	>
																		<svg
																			className="w-4 h-4"
																			fill="none"
																			stroke="currentColor"
																			viewBox="0 0 24 24"
																		>
																			<title>Delete</title>
																			<path
																				strokeLinecap="round"
																				strokeLinejoin="round"
																				strokeWidth={2}
																				d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
																			/>
																		</svg>
																	</Button>
																</div>
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									)}

									{/* Pagination */}
									{filteredParticipants.length > itemsPerPage && (
										<div className="mt-6 flex justify-center">
											<Pagination>
												<PaginationContent>
													<PaginationItem>
														<PaginationPrevious
															onClick={() =>
																setCurrentPage(Math.max(1, currentPage - 1))
															}
															className={
																currentPage === 1
																	? 'pointer-events-none opacity-50'
																	: 'cursor-pointer'
															}
														/>
													</PaginationItem>

													{/* Page numbers */}
													{Array.from(
														{ length: Math.min(totalPages, 5) },
														(_, i) => {
															let pageNum: number;
															if (totalPages <= 5) {
																pageNum = i + 1;
															} else if (currentPage <= 3) {
																pageNum = i + 1;
															} else if (currentPage >= totalPages - 2) {
																pageNum = totalPages - 4 + i;
															} else {
																pageNum = currentPage - 2 + i;
															}

															return (
																<PaginationItem key={pageNum}>
																	<PaginationLink
																		onClick={() => setCurrentPage(pageNum)}
																		isActive={currentPage === pageNum}
																		className="cursor-pointer"
																	>
																		{pageNum}
																	</PaginationLink>
																</PaginationItem>
															);
														},
													)}

													{totalPages > 5 && currentPage < totalPages - 2 && (
														<PaginationItem>
															<PaginationEllipsis />
														</PaginationItem>
													)}

													<PaginationItem>
														<PaginationNext
															onClick={() =>
																setCurrentPage(
																	Math.min(totalPages, currentPage + 1),
																)
															}
															className={
																currentPage === totalPages
																	? 'pointer-events-none opacity-50'
																	: 'cursor-pointer'
															}
														/>
													</PaginationItem>
												</PaginationContent>
											</Pagination>
										</div>
									)}
								</div>
							</div>
						</div>
					</div>
				</div>
			</main>

			{/* Participant Details Modal */}
			{selectedParticipant && (
				<div className="fixed z-50 inset-0 overflow-y-auto">
					<div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
						<div
							className="fixed inset-0 transition-opacity"
							aria-hidden="true"
							onClick={closeParticipantDetails}
						>
							<div className="absolute inset-0 bg-gray-500 opacity-75"></div>
						</div>

						<span
							className="hidden sm:inline-block sm:align-middle sm:h-screen"
							aria-hidden="true"
						>
							&#8203;
						</span>

						<div className="inline-block align-bottom bg-gray-50 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full relative z-50 max-h-[90vh] overflow-y-auto">
							<div className="bg-gray-50 px-6 pt-6">
								<div className="flex justify-between items-center mb-4">
									<h2 className="text-xl font-semibold text-gray-900">
										Participant Details
									</h2>
									<Button
										onClick={closeParticipantDetails}
										variant="outline"
										size="sm"
									>
										Close
									</Button>
								</div>
								<ParticipantCard
									participant={selectedParticipant}
									onAttendanceUpdate={handleParticipantUpdate}
									showActions={true}
									showLabelPreview={true}
									className="pb-6"
								/>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* QR Code Modal */}
			{showQRModal?.show && (
				<div className="fixed z-50 inset-0 overflow-y-auto">
					<div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
						<div
							className="fixed inset-0 transition-opacity"
							aria-hidden="true"
						>
							<div className="absolute inset-0 bg-gray-500 opacity-75"></div>
						</div>

						<span
							className="hidden sm:inline-block sm:align-middle sm:h-screen"
							aria-hidden="true"
						>
							&#8203;
						</span>

						<div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full relative z-50">
							<div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
								<div className="sm:flex sm:items-start">
									<div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
										<h3 className="text-lg leading-6 font-medium text-gray-900">
											QR Code for {showQRModal.participant.first_name}{' '}
											{showQRModal.participant.last_name}
										</h3>
										<div className="mt-4 flex flex-col items-center">
											<QRCodeSVG
												id={`qr-code-${showQRModal.participant.id}`}
												value={showQRModal.participant.id}
												size={256}
												level="H"
												includeMargin={true}
											/>
											<p className="mt-2 text-sm text-gray-500">
												Staff ID: {showQRModal.participant.staff_id}
											</p>
										</div>
									</div>
								</div>
							</div>
							<div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
								<Button
									onClick={() => downloadQRCode(showQRModal.participant)}
									className="bg-green-600 hover:bg-green-700 sm:ml-3"
								>
									Download PNG
								</Button>
								<Button
									onClick={closeQRModal}
									variant="outline"
									className="mt-3 sm:mt-0"
								>
									Close
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
