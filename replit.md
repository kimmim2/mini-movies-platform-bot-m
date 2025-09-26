# Overview

This is a mobile-ready, YouTube-style mini movies and web series streaming platform built with Node.js and Express. The application serves as a video streaming service that displays a grid of video thumbnails, supports video playback with advertising integration, and includes optional Telegram bot functionality for user engagement.

The platform focuses on delivering short-form content like mini movies, dramas, and web series with a responsive design optimized for mobile devices. It includes features like video categorization, thumbnail previews, and advertising management with pre-roll and mid-roll ads.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Single Page Application (SPA)**: Uses vanilla JavaScript with Tailwind CSS for responsive design
- **Video Player**: HTML5 video element with custom controls and overlay support
- **Grid Layout**: Responsive thumbnail grid that adapts to different screen sizes (mobile-first approach)
- **Category Filtering**: Client-side filtering system for organizing content by type (movies, drama, web series)
- **Local Storage**: Implements video resume functionality by storing playback positions locally

## Backend Architecture
- **Express.js Server**: RESTful API server handling video metadata and serving static content
- **In-Memory Data Storage**: Currently uses JavaScript arrays for video storage (designed to be replaced with database)
- **Static File Serving**: Serves frontend assets and handles CORS for cross-origin requests
- **Modular Design**: Separated concerns with dedicated modules for different functionalities

## Advertising System
- **Pre-roll Ads**: Mandatory ads before video playback with skip functionality after 25 seconds
- **Mid-roll Ads**: Timed interruptions at 10 and 15-minute marks during video playback
- **Banner/Popunder Support**: Infrastructure for additional advertising formats
- **Ad Overlay System**: Custom overlay implementation for seamless ad integration

## Content Management
- **Video Metadata Structure**: Standardized format including title, URL, thumbnail, description, views, and categories
- **Auto-Resume Feature**: Tracks and restores user playback positions across sessions
- **Sample Content**: Includes demo videos from Google's test video repository for development

## Integration Architecture
- **Telegram Bot Integration**: Optional bot functionality for user notifications and engagement
- **Environment Configuration**: Uses dotenv for secure configuration management
- **CORS Support**: Enables cross-origin requests for API flexibility

# External Dependencies

## Core Backend Dependencies
- **Express.js (v5.1.0)**: Web application framework for Node.js
- **CORS (v2.8.5)**: Cross-Origin Resource Sharing middleware
- **dotenv (v17.2.2)**: Environment variable management

## Bot Integration
- **node-telegram-bot-api (v0.66.0)**: Telegram Bot API wrapper for Node.js

## Frontend Dependencies
- **Tailwind CSS**: Utility-first CSS framework loaded via CDN
- **HTML5 Video API**: Native browser video playback capabilities

## External Services
- **Google Cloud Storage**: Demo video content hosted on Google's public CDN
- **Telegram Bot API**: Optional integration for user engagement and notifications

## Development Infrastructure
- **Node.js Runtime**: Server-side JavaScript execution environment
- **NPM Package Manager**: Dependency management and script execution

Note: The current implementation uses in-memory storage for video metadata, which is designed to be replaced with a proper database solution like PostgreSQL in production environments.