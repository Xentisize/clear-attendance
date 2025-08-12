# Printer Management Admin Page

This document describes the new printer management functionality added to the QR Attendance Admin Panel.

## Overview

The printer management page allows administrators to:
- Monitor printer service connection status
- Initialize the printer SDK
- Discover and select available printers
- Test print functionality with sample labels
- Manage printer settings

## Accessing the Printer Management Page

1. Log in to the admin panel (`/admin/login`)
2. Navigate to the dashboard (`/admin/dashboard`)
3. Click on "Printer" in the navigation menu or use the "Manage Printer" button
4. The printer management page is located at `/admin/printer`

## Features

### 1. Printer Status Dashboard
- **Service Connection**: Shows if the browser plugin is connected
- **SDK Status**: Indicates if the printer SDK is initialized
- **Selected Printer**: Displays the currently selected printer

### 2. Control Panel
- **Initialize Printer Service**: Connects to the printer service and initializes the SDK
- **Refresh Printers**: Scans for available printers
- **Test Print**: Prints a sample attendance label
- **Refresh Status**: Updates the current status display

### 3. Available Printers List
- Shows all discovered printers with their names and ports
- Allows selection of a specific printer
- Highlights the currently selected printer

## Usage Instructions

### Initial Setup
1. Ensure the JcPrinter browser plugin is installed and running
2. Visit the printer management page
3. Click "Initialize Printer Service" to establish connection
4. Click "Refresh Printers" to discover available printers
5. Select a printer from the list

### Testing
1. After selecting a printer, click "Test Print" to verify functionality
2. The test will print a sample attendance label with test data
3. Check the message display for success or error information

### Integration with Participant Management
Once a printer is selected and working:
1. Visit the participants page
2. Use the printing functionality when managing participant labels
3. The selected printer will be used automatically

## Troubleshooting

### Common Issues

**"Printer service not available" error:**
- Ensure the JcPrinter browser plugin is installed
- Check if the plugin is running and active
- Verify browser permissions for the plugin

**"No printers found":**
- Check printer connections and power status
- Ensure printer drivers are installed
- Try refreshing the printer list

**"Failed to print test label":**
- Verify printer is properly selected
- Check printer status and paper/ribbon levels
- Ensure printer is not in use by another application

### Error Messages
The page displays color-coded messages:
- **Green**: Success messages
- **Red**: Error messages  
- **Blue**: Information messages

## Technical Notes

- The printer management uses the existing `printerService.ts` utility
- All printer operations are asynchronous and provide feedback
- The page maintains connection state across navigation
- Status information is updated in real-time

## Navigation

The printer management page is integrated into the admin navigation:
- Dashboard → Overview and quick access
- Participants → Manage participant data and labels  
- Printer → Monitor and configure printing functionality

All admin pages include consistent navigation with the printer link for easy access.
