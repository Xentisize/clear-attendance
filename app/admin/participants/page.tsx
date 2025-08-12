'use client';

import { createClient } from '@/utils/supabase/client';
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

export default function ParticipantsPage() {
	const [user, setUser] = useState<{
		id: string;
		email: string;
		name?: string;
	} | null>(null);
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
	const fileInputRef = useRef<HTMLInputElement>(null);
	const router = useRouter();

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

			setUser({
				...session.user,
				...adminData,
			});

			await fetchParticipants();
			setLoading(false);
		};

		checkUser();
	}, [router]);

	const fetchParticipants = async () => {
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
	};

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

	const handleMarkAttended = async (participantId: string) => {
		try {
			const supabase = await createClient();
			const { data, error } = await supabase
				.from('participants')
				.update({ attended: true })
				.eq('id', participantId)
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
					p.id === participantId ? { ...p, attended: true } : p,
				),
			);

			// Refresh the participants list to ensure we have the latest data
			await fetchParticipants();

			// Show success message
			alert('Attendance marked successfully!');
		} catch (error: unknown) {
			console.error('Error updating attendance:', error);
			const errorMessage =
				error instanceof Error
					? error.message
					: 'An error occurred while updating attendance.';
			alert(errorMessage);
		}
	};

	const handleLogout = async () => {
		const supabase = await createClient();
		await supabase.auth.signOut();
		router.push('/admin/login');
		router.refresh();
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
			<nav className="bg-white shadow">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between h-16">
						<div className="flex">
							<div className="flex-shrink-0 flex items-center">
								<h1 className="text-xl font-bold">QR Attendance Admin</h1>
							</div>
							<div className="hidden sm:ml-6 sm:flex sm:space-x-8">
								<a
									href="/admin/dashboard"
									className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
								>
									Dashboard
								</a>
								<a
									href="/admin/participants"
									className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
								>
									Participants
								</a>
								<a
									href="/admin/printer"
									className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
								>
									Printer
								</a>
							</div>
						</div>
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<button
									onClick={handleLogout}
									className="relative inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
								>
									Logout
								</button>
							</div>
							<div className="ml-3 relative">
								<div className="text-sm text-gray-700">
									{user?.name || user?.email}
								</div>
							</div>
						</div>
					</div>
				</div>
			</nav>

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
								<label
									htmlFor="search"
									className="block text-sm font-medium text-gray-700 mb-2"
								>
									Search Participants
								</label>
								<input
									type="text"
									id="search"
									placeholder="Search by ID, staff ID, name, email, post, or department..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
								/>
							</div>
						</div>

						{/* Action Buttons */}
						<div className="mb-6">
							<button
								onClick={downloadAllQRs}
								className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 mr-3"
							>
								Export All QR Codes
							</button>
							<button
								onClick={() => {
									resetForm();
									setShowAddForm(!showAddForm);
									setShowUploadForm(false);
								}}
								className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-3"
							>
								{showAddForm ? 'Hide' : 'Add Participant'}
							</button>
							<button
								onClick={() => {
									setShowUploadForm(!showUploadForm);
									setShowAddForm(false);
									resetForm();
								}}
								className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
							>
								{showUploadForm ? 'Hide' : 'Upload CSV'}
							</button>
						</div>

						{/* Add/Edit Form */}
						{(showAddForm || editingParticipant) && (
							<div className="bg-white shadow sm:rounded-lg mb-6">
								<div className="px-4 py-5 sm:p-6">
									<h3 className="text-lg leading-6 font-medium text-gray-900">
										{editingParticipant
											? 'Edit Participant'
											: 'Add New Participant'}
									</h3>

									{formError && (
										<div className="mt-4 rounded-md bg-red-50 p-4">
											<div className="text-sm text-red-700">{formError}</div>
										</div>
									)}

									<form
										onSubmit={
											editingParticipant
												? handleUpdateParticipant
												: handleAddParticipant
										}
										className="mt-5 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6"
									>
										<div className="sm:col-span-2">
											<label
												htmlFor="staff_id"
												className="block text-sm font-medium text-gray-700"
											>
												Staff ID *
											</label>
											<div className="mt-1">
												<input
													type="text"
													name="staff_id"
													id="staff_id"
													value={formData.staff_id}
													onChange={handleFormChange}
													className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
												/>
											</div>
										</div>

										<div className="sm:col-span-1">
											<label
												htmlFor="title"
												className="block text-sm font-medium text-gray-700"
											>
												Title
											</label>
											<div className="mt-1">
												<input
													type="text"
													name="title"
													id="title"
													value={formData.title}
													onChange={handleFormChange}
													className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
												/>
											</div>
										</div>

										<div className="sm:col-span-2">
											<label
												htmlFor="first_name"
												className="block text-sm font-medium text-gray-700"
											>
												First Name *
											</label>
											<div className="mt-1">
												<input
													type="text"
													name="first_name"
													id="first_name"
													value={formData.first_name}
													onChange={handleFormChange}
													className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
												/>
											</div>
										</div>

										<div className="sm:col-span-2">
											<label
												htmlFor="last_name"
												className="block text-sm font-medium text-gray-700"
											>
												Last Name *
											</label>
											<div className="mt-1">
												<input
													type="text"
													name="last_name"
													id="last_name"
													value={formData.last_name}
													onChange={handleFormChange}
													className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
												/>
											</div>
										</div>

										<div className="sm:col-span-3">
											<label
												htmlFor="email"
												className="block text-sm font-medium text-gray-700"
											>
												Email
											</label>
											<div className="mt-1">
												<input
													type="email"
													name="email"
													id="email"
													value={formData.email}
													onChange={handleFormChange}
													className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
												/>
											</div>
										</div>

										<div className="sm:col-span-3">
											<label
												htmlFor="post"
												className="block text-sm font-medium text-gray-700"
											>
												Post
											</label>
											<div className="mt-1">
												<input
													type="text"
													name="post"
													id="post"
													value={formData.post}
													onChange={handleFormChange}
													className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
												/>
											</div>
										</div>

										<div className="sm:col-span-6">
											<label
												htmlFor="department"
												className="block text-sm font-medium text-gray-700"
											>
												Department
											</label>
											<div className="mt-1">
												<input
													type="text"
													name="department"
													id="department"
													value={formData.department}
													onChange={handleFormChange}
													className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
												/>
											</div>
										</div>

										<div className="sm:col-span-6 flex justify-end space-x-3">
											<button
												type="button"
												onClick={resetForm}
												className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
											>
												Cancel
											</button>
											<button
												type="submit"
												disabled={formLoading}
												className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
											>
												{formLoading
													? 'Saving...'
													: editingParticipant
														? 'Update'
														: 'Add'}
											</button>
										</div>
									</form>
								</div>
							</div>
						)}

						{/* Upload Section */}
						{showUploadForm && (
							<div className="bg-white shadow sm:rounded-lg mb-6">
								<div className="px-4 py-5 sm:p-6">
									<h3 className="text-lg leading-6 font-medium text-gray-900">
										Upload Participant List
									</h3>
									<div className="mt-2 max-w-xl text-sm text-gray-500">
										<p>
											Upload a CSV file with participant information. The file
											should include the following headers: staff id, title,
											first_name, last_name, email, post, department
										</p>
									</div>

									{uploadError && (
										<div className="mt-4 rounded-md bg-red-50 p-4">
											<div className="text-sm text-red-700">{uploadError}</div>
										</div>
									)}

									{uploadSuccess && (
										<div className="mt-4 rounded-md bg-green-50 p-4">
											<div className="text-sm text-green-700">
												{uploadSuccess}
											</div>
										</div>
									)}

									<div className="mt-5">
										<input
											ref={fileInputRef}
											type="file"
											accept=".csv"
											onChange={handleFileUpload}
											disabled={uploading}
											className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-md file:border-0
                        file:text-sm file:font-medium
                        file:bg-indigo-50 file:text-indigo-700
                        hover:file:bg-indigo-100"
										/>
										{uploading && (
											<div className="mt-2 flex items-center">
												<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
												<span className="text-sm text-gray-500">
													Uploading and processing...
												</span>
											</div>
										)}
									</div>
								</div>
							</div>
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
											>
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
																<span
																	className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${participant.attended ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
																>
																	{participant.attended ? 'Yes' : 'No'}
																</span>
															</td>
															<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
																<button
																	onClick={() => openQRModal(participant)}
																	className="text-indigo-600 hover:text-indigo-900"
																>
																	View QR
																</button>
															</td>
															<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
																<button
																	onClick={() => openEditForm(participant)}
																	className="text-indigo-600 hover:text-indigo-900 mr-3"
																>
																	Edit
																</button>
																{!participant.attended && (
																	<button
																		type="button"
																		onClick={() =>
																			handleMarkAttended(participant.id)
																		}
																		className="text-green-600 hover:text-green-900 mr-3"
																	>
																		Mark Attended
																	</button>
																)}
																<button
																	type="button"
																	onClick={() =>
																		handleDeleteParticipant(participant.id)
																	}
																	className="text-red-600 hover:text-red-900"
																>
																	Delete
																</button>
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
								<button
									onClick={() => downloadQRCode(showQRModal.participant)}
									type="button"
									className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
								>
									Download PNG
								</button>
								<button
									onClick={closeQRModal}
									type="button"
									className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
								>
									Close
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
