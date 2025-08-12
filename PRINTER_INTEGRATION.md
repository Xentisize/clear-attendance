# QR Attendance System - Printer Integration

This application now includes complete integration with the JC Printer SDK for printing participant labels.

## Printer Setup

### Prerequisites

1. **Install JC Printer Service**: Download and install the JC printer service application from the manufacturer.
2. **Connect Printer**: Connect your JC printer via USB or WiFi to your computer.
3. **Start Printer Service**: Launch the JC printer service application (it runs on port 37989).

### Supported Printers

The system supports the following JC printer models:
- B3S, B1, B203, B21 (Thermal mode, density 1-5)
- D11, D101, D110, B16 (Thermal mode, density 1-3)
- B32, Z401 (Thermal transfer mode, density 1-15)
- B50, B50W (Thermal transfer mode, density 1-15)
- B18 (Thermal transfer mode, density 1-3)
- K3, K3W (Thermal mode, density 1-5)
- M2 (Thermal transfer mode, density 1-5)

## How It Works

### Main Application (`app/page.tsx`)

When a participant scans their QR code or enters their ID/Staff ID:

1. **Participant Lookup**: The system searches for the participant in the database
2. **Print Label**: When the "Print Label" button is clicked:
   - Marks the participant as attended in the database
   - Attempts to connect to the printer service
   - Generates and prints a label with:
     - Participant's QR code (UUID)
     - Name, Staff ID, Department, and Position
   - Shows success/error messages

### Printer Service (`app/utils/printerService.ts`)

The printer service handles:
- **Connection Management**: Connects to the JC printer service via WebSocket
- **SDK Initialization**: Initializes the printer SDK
- **Auto-Printer Detection**: Automatically detects and connects to available USB printers
- **Label Generation**: Creates 50mm x 30mm labels with QR codes and text
- **Error Handling**: Graceful degradation if printer is not available

### Label Format

The printed labels are **50mm x 30mm** and include:
- **Left side**: QR code (26mm x 26mm) containing the participant's UUID
- **Right side**: Text information including:
  - Participant's full name with title
  - Staff ID
  - Department
  - Position

## Usage Instructions

### For End Users

1. **Scan QR Code**: Use the camera to scan a participant's QR code
2. **Manual Entry**: Alternatively, enter the participant ID or Staff ID manually
3. **View Details**: Review the participant information displayed
4. **Print Label**: Click "Print Label" to:
   - Mark attendance as "Attended"
   - Print a physical label (if printer is connected)

### For Administrators

1. **Access Admin Panel**: Navigate to `/admin/participants`
2. **Manage Participants**: Add, edit, or bulk upload participants
3. **Export QR Codes**: Download all participant QR codes as a ZIP file
4. **Mark Attendance**: Use the "Mark Attended" button for individual participants

## Error Handling

The system includes robust error handling:

- **Printer Not Available**: If the printer service is not running or no printer is connected, the system will still mark attendance but show a warning message
- **Database Errors**: Any database issues are displayed to the user with clear error messages
- **Invalid QR Codes**: The system validates QR codes and provides appropriate feedback

## Printer Settings

Default settings used:
- **Print Density**: 3 (adjustable based on printer model)
- **Paper Type**: Gap paper (间隙纸)
- **Print Mode**: Thermal mode (热敏模式)
- **Label Size**: 50mm x 30mm

## Troubleshooting

### Printer Not Connecting
1. Ensure the JC printer service is running
2. Check that the printer is properly connected (USB/WiFi)
3. Verify the printer is powered on
4. Try refreshing the page to reinitialize the connection

### Labels Not Printing
1. Check printer paper supply
2. Verify correct paper type is loaded
3. Ensure printer settings match your printer model
4. Check for any error messages in the browser console

### QR Code Scanning Issues
1. Ensure good lighting when scanning
2. Hold the QR code steady and at appropriate distance
3. Use manual entry as a fallback option

## Technical Details

### Printer SDK Integration
- Uses WebSocket connection to localhost:37989
- Implements the full JC Printer SDK API
- Supports both USB and WiFi printer connections
- Handles printer status callbacks and error conditions

### Database Integration
- Updates attendance status in real-time
- Maintains audit trail of attendance changes
- Supports UUID-based participant identification

### Security
- Admin panel protected by authentication middleware
- Database queries use Supabase RLS (Row Level Security)
- Input validation for all user entries

For more technical details, see the source code in `/app/utils/printerService.ts` and the DEMO folder for SDK examples.
