# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 project bootstrapped with `create-next-app` that includes a printer SDK demo for JcPrinter devices. The project has two main parts:
1. A standard Next.js application in the `app/` directory
2. A printer SDK demo in the `DEMO/` directory with HTML/JS implementation

## Common Development Commands

### Development
```bash
npm run dev     # Start development server
bun dev         # Start development server with Bun
```

### Building
```bash
npm run build   # Build the Next.js application
npm run start   # Start production server
```

### Code Quality
```bash
npm run lint    # Run Next.js linting
```

## Codebase Structure

### Next.js Application (`app/`)
- Standard Next.js 15 App Router structure
- TypeScript with React Server Components
- Tailwind CSS for styling
- Uses Supabase client for backend services

### Printer SDK Demo (`DEMO/`)
- HTML/JavaScript implementation for JcPrinter SDK
- Contains printer functionality for various label types:
  - Text printing
  - Barcode generation
  - QR code generation
  - Line drawing
  - Graphics rendering
  - Image printing
- Supports both USB and WiFi printer connections
- Includes comprehensive print settings (density, label type, print mode)

### Key SDK Files
- `DEMO/js/iJcPrinterSdk_third.js` - Main SDK implementation
- `DEMO/js/api/jcPrinterSdk_api_third.js` - SDK API interface
- `DEMO/js/printData/*.js` - Sample print data for different label types
- `DEMO/drawParameter/*.js` - Drawing parameter configurations

## Architecture Notes

The project combines a modern Next.js frontend with a legacy printer SDK demo. The SDK uses a JavaScript API to communicate with printer hardware through browser plugins or extensions. The demo includes comprehensive examples for different printing scenarios.