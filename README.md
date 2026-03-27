# Sprite Autocutter Pro

[![Play Online](https://img.shields.io/badge/Use_Tool_Online-BitAutocutter-00e5ff?style=for-the-badge&logo=github)](https://aronpolanco.github.io/bitautocutter/)

A web-based, client-side tool designed for indie game developers and pixel artists. Sprite Autocutter Pro automatically detects, crops, and extracts individual sprites from a spritesheet or tilesheet, allowing you to export them as a ZIP file in seconds.

## Features

* Automatic Sprite Detection: Uses a Breadth-First Search (BFS) algorithm to isolate individual sprites based on background transparency.
* Batch Export to ZIP: Select or deselect specific sprites and download the final selection packaged in a ZIP file.
* Custom Naming Convention: Define a base name for your files, and the tool will automatically sequence them (e.g., car1.png, car2.png).
* Configurable Padding: Add safety margin pixels around your detected sprites to prevent tight cropping.
* Retro 8-Bit Interface: Arcade-inspired UI utilizing classic pixel typography and hard-shadow styling.
* Fully Responsive: Usable on both desktop monitors and mobile screens.
* 100% Client-Side: All image processing is done locally in your browser via the Canvas API. No images are uploaded to any server.

## Technologies Used

* HTML5
* CSS3 (CSS Grid, Flexbox, Media Queries)
* Vanilla JavaScript (Canvas API, ImageData manipulation)
* JSZip (for client-side ZIP generation)
* Google Fonts (Press Start 2P, VT323)

## How to Use

1. Open `index.html` in any modern web browser.
2. Upload your spritesheet image (PNG format with transparent background is highly recommended).
3. Set your preferred security padding (default is 5px).
4. Click the Auto-detect button to process the image.
5. Click on individual generated canvases to toggle their selection (selected sprites feature a neon border).
6. Enter a base name in the export section.
7. Click Download ZIP to get your files.

## Installation / Setup

No server setup or dependencies installation is required. 

1. Clone this repository.
2. Open the `index.html` file in your browser.

Alternatively, you can host this project effortlessly using GitHub Pages or any static hosting service.

## License

This project is open-source and available under the MIT License.
