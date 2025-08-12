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
import { Label } from '@/components/ui/label';
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
	const [searchQuery, setSearchQuery] = useState('');
	const [uploading, setUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
	const [showAddForm, setShowAddForm] = useState(false);
	const [showUploadForm, setShowUploadForm] = useState(false);
	const [editingParticipant, setEditingParticipant] =
		useState<Participant | null>(null);
	const [formData, setFormData] = useState<
		Omit<Participant, 'id' | 'attended' | 'created_at'>
	>({
		staff_id: '',
		title: '',
		first_name: '',
		last_name: '',
		email: '',
		post: '',
		department: '',
	});
	const [formError, setFormError] = useState<string | null>(null);
	const [formLoading, setFormLoading] = useState(false);
	const [showQRModal, setShowQRModal] = useState<{
		participant: Participant;
		show: boolean;
	} | null>(null);
	const [showAttendanceModal, setShowAttendanceModal] = useState<{
		participant: Participant;
		show: boolean;
		newStatus: boolean;
	} | null>(null);
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

	// Search functionality
	useEffect(() => {
		if (!searchQuery.trim()) {
			setFilteredParticipants(participants);
			return;
		}

		const query = searchQuery.toLowerCase();
		const filtered = participants.filter(
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
		setFilteredParticipants(filtered);
	}, [participants, searchQuery]);

	const handleAttendanceChange = (
		participant: Participant,
		newStatus: boolean,
	) => {
		setShowAttendanceModal({
			participant,
			show: true,
			newStatus,
		});
	};

	const confirmAttendanceChange = async () => {
		if (!showAttendanceModal) return;

		try {
			const supabase = await createClient();
			const { data, error } = await supabase
				.from('participants')
				.update({ attended: showAttendanceModal.newStatus })
				.eq('id', showAttendanceModal.participant.id)
				.select();

			if (error) {
				console.error('Database error:', error);
				throw error;
			}

			if (!data || data.length === 0) {
				throw new Error('No participant was updated. Please try again.');
			}

			// Update local state
			setParticipants((prev) =>
				prev.map((p) =>
					p.id === showAttendanceModal.participant.id
						? { ...p, attended: showAttendanceModal.newStatus }
						: p,
				),
			);

			// Refresh the participants list to ensure we have the latest data
			await fetchParticipants();

			setShowAttendanceModal(null);
		} catch (error: unknown) {
			console.error('Error updating attendance:', error);
			const errorMessage =
				error instanceof Error
					? error.message
					: 'An error occurred while updating attendance.';
			alert(errorMessage);
		}
	};

	const closeAttendanceModal = () => {
		setShowAttendanceModal(null);
	};

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

	const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const validateForm = () => {
		if (!formData.staff_id.trim()) {
			return 'Staff ID is required';
		}
		if (!formData.first_name.trim()) {
			return 'First name is required';
		}
		if (!formData.last_name.trim()) {
			return 'Last name is required';
		}
		return null;
	};

	const handleAddParticipant = async (e: React.FormEvent) => {
		e.preventDefault();
		setFormError(null);

		const error = validateForm();
		if (error) {
			setFormError(error);
			return;
		}

		setFormLoading(true);

		try {
			const supabase = await createClient();
			const { error: insertError } = await supabase
				.from('participants')
				.insert([formData]);

			if (insertError) throw insertError;

			await fetchParticipants();
			setShowAddForm(false);
			setFormData({
				staff_id: '',
				title: '',
				first_name: '',
				last_name: '',
				email: '',
				post: '',
				department: '',
			});
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error
					? error.message
					: 'An error occurred while adding the participant.';
			setFormError(errorMessage);
		} finally {
			setFormLoading(false);
		}
	};

	const handleUpdateParticipant = async (e: React.FormEvent) => {
		e.preventDefault();
		setFormError(null);

		if (!editingParticipant) return;

		const error = validateForm();
		if (error) {
			setFormError(error);
			return;
		}

		setFormLoading(true);

		try {
			const supabase = await createClient();
			const { error: updateError } = await supabase
				.from('participants')
				.update(formData)
				.eq('id', editingParticipant.id);

			if (updateError) throw updateError;

			await fetchParticipants();
			setEditingParticipant(null);
			setFormData({
				staff_id: '',
				title: '',
				first_name: '',
				last_name: '',
				email: '',
				post: '',
				department: '',
			});
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error
					? error.message
					: 'An error occurred while updating the participant.';
			setFormError(errorMessage);
		} finally {
			setFormLoading(false);
		}
	};

	const handleDeleteParticipant = async (id: string) => {
		if (!confirm('Are you sure you want to delete this participant?')) return;

		try {
			const supabase = await createClient();
			const { error } = await supabase
				.from('participants')
				.delete()
				.eq('id', id);

			if (error) throw error;

			await fetchParticipants();
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error
					? error.message
					: 'An error occurred while deleting the participant.';
			alert(errorMessage);
		}
	};

	const openEditForm = (participant: Participant) => {
		setEditingParticipant(participant);
		setFormData({
			staff_id: participant.staff_id,
			title: participant.title,
			first_name: participant.first_name,
			last_name: participant.last_name,
			email: participant.email,
			post: participant.post,
			department: participant.department,
		});
	};

	const resetForm = () => {
		setShowAddForm(false);
		setEditingParticipant(null);
		setFormData({
			staff_id: '',
			title: '',
			first_name: '',
			last_name: '',
			email: '',
			post: '',
			department: '',
		});
		setFormError(null);
	};

	const openQRModal = (participant: Participant) => {
		setShowQRModal({ participant, show: true });
	};

	const closeQRModal = () => {
		setShowQRModal(null);
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

						{/* Search Bar */}
						<div className="mb-6">
							<div className="max-w-md">
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
						</div>

						{/* Action Buttons */}
						<div className="mb-6 flex flex-wrap gap-3">
							<Button
								onClick={downloadAllQRs}
								variant="secondary"
								className="bg-green-600 hover:bg-green-700 text-white"
							>
								Export All QR Codes
							</Button>
							<Button
								onClick={() => {
									resetForm();
									setShowAddForm(!showAddForm);
									setShowUploadForm(false);
								}}
							>
								{showAddForm ? 'Hide' : 'Add Participant'}
							</Button>
							<Button
								onClick={() => {
									setShowUploadForm(!showUploadForm);
									setShowAddForm(false);
									resetForm();
								}}
								variant="secondary"
							>
								{showUploadForm ? 'Hide' : 'Upload CSV'}
							</Button>
						</div>

						{/* Add/Edit Form */}
						{(showAddForm || editingParticipant) && (
							<Card className="mb-6">
								<CardHeader>
									<CardTitle>
										{editingParticipant
											? 'Edit Participant'
											: 'Add New Participant'}
									</CardTitle>
								</CardHeader>
								<CardContent>
									{formError && (
										<Alert variant="destructive" className="mb-4">
											<AlertDescription>{formError}</AlertDescription>
										</Alert>
									)}

									<form
										onSubmit={
											editingParticipant
												? handleUpdateParticipant
												: handleAddParticipant
										}
										className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6"
									>
										<div className="sm:col-span-2">
											<Label htmlFor="staff_id">Staff ID *</Label>
											<Input
												type="text"
												name="staff_id"
												id="staff_id"
												value={formData.staff_id}
												onChange={handleFormChange}
												className="mt-1"
											/>
										</div>

										<div className="sm:col-span-1">
											<Label htmlFor="title">Title</Label>
											<Input
												type="text"
												name="title"
												id="title"
												value={formData.title}
												onChange={handleFormChange}
												className="mt-1"
											/>
										</div>

										<div className="sm:col-span-2">
											<Label htmlFor="first_name">First Name *</Label>
											<Input
												type="text"
												name="first_name"
												id="first_name"
												value={formData.first_name}
												onChange={handleFormChange}
												className="mt-1"
											/>
										</div>

										<div className="sm:col-span-2">
											<Label htmlFor="last_name">Last Name *</Label>
											<Input
												type="text"
												name="last_name"
												id="last_name"
												value={formData.last_name}
												onChange={handleFormChange}
												className="mt-1"
											/>
										</div>

										<div className="sm:col-span-3">
											<Label htmlFor="email">Email</Label>
											<Input
												type="email"
												name="email"
												id="email"
												value={formData.email}
												onChange={handleFormChange}
												className="mt-1"
											/>
										</div>

										<div className="sm:col-span-3">
											<Label htmlFor="post">Post</Label>
											<Input
												type="text"
												name="post"
												id="post"
												value={formData.post}
												onChange={handleFormChange}
												className="mt-1"
											/>
										</div>

										<div className="sm:col-span-6">
											<Label htmlFor="department">Department</Label>
											<Input
												type="text"
												name="department"
												id="department"
												value={formData.department}
												onChange={handleFormChange}
												className="mt-1"
											/>
										</div>

										<div className="sm:col-span-6 flex justify-end space-x-3">
											<Button
												type="button"
												variant="outline"
												onClick={resetForm}
											>
												Cancel
											</Button>
											<Button type="submit" disabled={formLoading}>
												{formLoading
													? 'Saving...'
													: editingParticipant
														? 'Update'
														: 'Add'}
											</Button>
										</div>
									</form>
								</CardContent>
							</Card>
						)}

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
									{searchQuery ? `of ${participants.length}` : 'total'})
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
															QR Code
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
													{filteredParticipants.map((participant) => (
														<tr key={participant.id}>
															<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
																{participant.staff_id}
															</td>
															<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
																{participant.title} {participant.first_name}{' '}
																{participant.last_name}
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
																<div className="flex items-center space-x-2">
																	<Badge
																		variant={
																			participant.attended
																				? 'default'
																				: 'destructive'
																		}
																	>
																		{participant.attended ? 'Yes' : 'No'}
																	</Badge>
																	<Button
																		variant="ghost"
																		size="sm"
																		onClick={() =>
																			handleAttendanceChange(
																				participant,
																				!participant.attended,
																			)
																		}
																		className="text-blue-600 hover:text-blue-900 h-auto p-1"
																		title={`Mark as ${participant.attended ? 'not attended' : 'attended'}`}
																	>
																		Toggle
																	</Button>
																</div>
															</td>
															<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
																<Button
																	variant="ghost"
																	size="sm"
																	onClick={() => openQRModal(participant)}
																	className="text-indigo-600 hover:text-indigo-900 h-auto p-1"
																>
																	View QR
																</Button>
															</td>
															<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
																<Button
																	variant="ghost"
																	size="sm"
																	onClick={() => openEditForm(participant)}
																	className="text-indigo-600 hover:text-indigo-900 h-auto p-1 mr-2"
																>
																	Edit
																</Button>
																<Button
																	variant="ghost"
																	size="sm"
																	onClick={() =>
																		handleDeleteParticipant(participant.id)
																	}
																	className="text-red-600 hover:text-red-900 h-auto p-1"
																>
																	Delete
																</Button>
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									)}
								</div>
							</div>
						</div>
					</div>
				</div>
			</main>

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

			{/* Attendance Change Confirmation Modal */}
			{showAttendanceModal?.show && (
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
									<div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
										<svg
											className="h-6 w-6 text-yellow-600"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											aria-hidden="true"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth="2"
												d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
											/>
										</svg>
									</div>
									<div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
										<h3 className="text-lg leading-6 font-medium text-gray-900">
											Change Attendance Status
										</h3>
										<div className="mt-2">
											<p className="text-sm text-gray-500">
												Are you sure you want to mark{' '}
												<strong>
													{showAttendanceModal.participant.first_name}{' '}
													{showAttendanceModal.participant.last_name}
												</strong>{' '}
												as{' '}
												<strong>
													{showAttendanceModal.newStatus
														? 'attended'
														: 'not attended'}
												</strong>
												?
											</p>
										</div>
									</div>
								</div>
							</div>
							<div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
								<Button
									onClick={confirmAttendanceChange}
									variant="destructive"
									className="sm:ml-3"
								>
									Confirm
								</Button>
								<Button
									onClick={closeAttendanceModal}
									variant="outline"
									className="mt-3 sm:mt-0"
								>
									Cancel
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
