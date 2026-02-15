const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const projectRoot = path.dirname(__dirname);
const svgPath = path.join(projectRoot, 'public', 'favicon.svg');
const outputPath = path.join(projectRoot, 'public', 'apple-touch-icon.png');

// Read the SVG file
const svgBuffer = fs.readFileSync(svgPath);

// Convert SVG to PNG at 180x180
sharp(svgBuffer)
  .resize(180, 180)
  .png()
  .toFile(outputPath)
  .then(() => {
    console.log('Apple touch icon created successfully at:', outputPath);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error creating apple touch icon:', err);
    process.exit(1);
  });
