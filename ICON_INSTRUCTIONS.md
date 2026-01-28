# PWA Icon Instructions

The app needs PNG icons for full PWA support. I've created SVG placeholders, but you should convert them to PNG or create proper PNG icons.

## Quick Solution - Convert SVG to PNG:

### Using online converter:
1. Open https://cloudconvert.com/svg-to-png
2. Upload `icon-192.svg` and `icon-512.svg`
3. Convert and download as `icon-192.png` and `icon-512.png`
4. Replace the SVG files with PNG files

### Or use ImageMagick (if installed):
```bash
convert icon-192.svg icon-192.png
convert icon-512.svg icon-512.png
```

## Alternative - Create custom icons:
1. Use https://favicon.io/favicon-converter/
2. Upload any image/logo
3. Download generated pack
4. Use the 192x192 and 512x512 PNG files

The current SVG files will work for testing but PNG is better for Android compatibility.
