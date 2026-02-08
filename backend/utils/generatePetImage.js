const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

async function generatePetImage(upper, face, down, color) {
  const width = 200;
  const height = 200;

  const basePath   = path.join(__dirname, '../assets', 'BaseBody.png');
  const upperPath  = path.join(__dirname, '../assets', `${capitalize(upper)}UpperPart.png`);
  const facePath   = path.join(__dirname, '../assets', `${capitalize(face)}FacePart.png`);
  const downPath   = path.join(__dirname, '../assets', `${capitalize(down)}DownPart.png`);

  try {
    await Promise.all([
      fs.access(basePath),
      fs.access(upperPath),
      fs.access(facePath),
      fs.access(downPath)
    ]);

    const base = await sharp(basePath)
      .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    const downImg = await sharp(downPath)
      .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    const upperImg = await sharp(upperPath)
      .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    const faceImg = await sharp(facePath)
      .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    let image = sharp(base);

    image = await image.composite([{ input: downImg, gravity: 'center', blend: 'over' }]).toBuffer();
    image = await sharp(image).composite([{ input: upperImg, gravity: 'center', blend: 'over' }]).toBuffer();
    image = await sharp(image).composite([{ input: faceImg, gravity: 'center', blend: 'over' }]).toBuffer();

    image = await sharp(image).tint(color).toBuffer();

    return image.toString('base64');

  } catch (err) {
    console.error('Image generation error:', err.message);
    console.error(err.stack);

    const errorImage = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 255, b: 0, alpha: 1 }
      }
    }).png().toBuffer();

    return errorImage.toString('base64');
  }
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

module.exports = { generatePetImage };
