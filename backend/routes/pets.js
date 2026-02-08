const express = require('express');
const ethers = require('ethers');
const Pet = require('../models/Pet');
const { generatePetImage } = require('../utils/generatePetImage');

const router = express.Router();

const provider = new ethers.providers.JsonRpcProvider(process.env.INFURA_KEY);
const petCoinAddress = process.env.PETCOIN_ADDRESS;
const treasury = process.env.TREASURY_ADDRESS;
const petCoinABI = [
  'function balanceOf(address) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

const animals = ['lion', 'dragon', 'penguin', 'fox', 'owl', 'dog', 'cat', 'bear', 'rabbit', 'monkey'];

router.get('/', async (req, res) => {
  try {
    const pets = await Pet.find();
    res.json(pets);
  } catch (err) {
    console.error('[GET ALL] Error:', err);
    res.status(500).json({ error: 'Failed to fetch pets' });
  }
});

router.get('/:owner', async (req, res) => {
  try {
    const pets = await Pet.find({ owner: req.params.owner });
    res.json(pets);
  } catch (err) {
    console.error('[GET OWNER] Error:', err);
    res.status(500).json({ error: 'Failed to fetch pets' });
  }
});

router.post('/create', async (req, res) => {
  const { owner } = req.body;

  console.log(`[CREATE] Create pet request from ${owner}`);

  try {
    const type = animals[Math.floor(Math.random() * animals.length)];
    const color = '#' + Math.floor(Math.random() * 16777215).toString(16);

    console.log(`[CREATE] Generated type: ${type}, color: ${color}`);

    const imageBase64 = await generatePetImage(type, type, type, color);

    console.log(`[CREATE] Received base64 with length: ${imageBase64.length} characters`);

    const pet = new Pet({
      upper: type,
      face: type,
      down: type,
      color,
      owner,
      image: `data:image/png;base64,${imageBase64}`,
      forSale: false,
      price: 0
    });

    await pet.save();

    console.log(`[CREATE] Pet successfully saved: ${pet._id}`);

    res.status(201).json(pet);
  } catch (err) {
    console.error('[CREATE] ERROR while creating pet:');
    console.error(err.message);
    console.error(err.stack?.substring(0, 800));
    res.status(500).json({ error: err.message });
  }
});

router.post('/merge', async (req, res) => {
  const { owner, petId1, petId2, txHash } = req.body;

  console.log('[MERGE] Merge request:');
  console.log('  owner:', owner);
  console.log('  petId1:', petId1);
  console.log('  petId2:', petId2);

  try {
    if (!petId1 || !petId2) {
      throw new Error('petId1 or petId2 is missing');
    }

    if (petId1 === petId2) {
      throw new Error('Cannot merge the same pet with itself');
    }

    const pet1 = await Pet.findById(petId1);
    const pet2 = await Pet.findById(petId2);

    if (!pet1 || !pet2) {
      throw new Error('One of the pets not found');
    }

    if (pet1.owner !== owner || pet2.owner !== owner) {
      throw new Error('One of the pets does not belong to this owner');
    }

    console.log('[MERGE] Found pets:', pet1._id, pet2._id);

    const parents = [pet1, pet2];

    let upper, face, down;
    let attempts = 0;
    const maxAttempts = 50;

    let fromPet1Count = 0;
    let fromPet2Count = 0;

    do {
      upper = parents[Math.floor(Math.random() * 2)].upper;
      face  = parents[Math.floor(Math.random() * 2)].face;
      down  = parents[Math.floor(Math.random() * 2)].down;

      fromPet1Count = 0;
      fromPet2Count = 0;

      if (upper === pet1.upper) fromPet1Count++; else fromPet2Count++;
      if (face === pet1.face) fromPet1Count++; else fromPet2Count++;
      if (down === pet1.down) fromPet1Count++; else fromPet2Count++;

      attempts++;

      if (attempts > maxAttempts) {
        throw new Error('Failed to generate a valid hybrid after many attempts');
      }
    } while (fromPet1Count === 3 || fromPet2Count === 3);

    console.log(`[MERGE] Generated hybrid after ${attempts} attempts:`);
    console.log(`  upper: ${upper} (${upper === pet1.upper ? 'from 1' : 'from 2'})`);
    console.log(`  face : ${face}  (${face === pet1.face ? 'from 1' : 'from 2'})`);
    console.log(`  down : ${down}  (${down === pet1.down ? 'from 1' : 'from 2'})`);

    function mixColors(color1, color2, ratio = 0.5) {
      color1 = color1.replace('#', '');
      color2 = color2.replace('#', '');

      const r1 = parseInt(color1.substr(0, 2), 16);
      const g1 = parseInt(color1.substr(2, 2), 16);
      const b1 = parseInt(color1.substr(4, 2), 16);

      const r2 = parseInt(color2.substr(0, 2), 16);
      const g2 = parseInt(color2.substr(2, 2), 16);
      const b2 = parseInt(color2.substr(4, 2), 16);

      const r = Math.round(r1 * ratio + r2 * (1 - ratio));
      const g = Math.round(g1 * ratio + g2 * (1 - ratio));
      const b = Math.round(b1 * ratio + b2 * (1 - ratio));

      return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }

    const color = mixColors(pet1.color, pet2.color, 0.5);
    console.log(`  color: ${color}`);

    const imageBase64 = await generatePetImage(upper, face, down, color);

    const newPet = new Pet({
      upper,
      face,
      down,
      color,
      owner,
      image: `data:image/png;base64,${imageBase64}`,
      forSale: false,
      price: 0
    });

    await newPet.save();

    console.log('[MERGE] New pet created:', newPet._id);

    await Pet.deleteMany({ _id: { $in: [petId1, petId2] } });
    console.log('[MERGE] Old pets deleted');

    res.json(newPet);
  } catch (err) {
    console.error('[MERGE] ERROR:');
    console.error(err.message);
    console.error(err.stack?.substring(0, 800) || 'no stack');
    res.status(500).json({ error: err.message });
  }
});

router.post('/delete', async (req, res) => {
  const { petId, owner } = req.body;

  console.log('[DELETE] Delete request:');
  console.log('  petId:', petId);
  console.log('  owner:', owner);

  try {
    if (!petId || !owner) {
      return res.status(400).json({ msg: 'Missing petId or owner' });
    }

    const pet = await Pet.findById(petId);
    if (!pet) return res.status(404).json({ msg: 'Pet not found' });

    if (pet.owner.toLowerCase() !== owner.toLowerCase()) {
      return res.status(403).json({ msg: 'Not your pet' });
    }

    await Pet.deleteOne({ _id: petId });

    console.log(`[DELETE] Pet ${petId} successfully deleted by owner ${owner}`);

    res.json({ success: true, message: 'Pet deleted' });
  } catch (err) {
    console.error('[DELETE] ERROR:');
    console.error(err.message);
    console.error(err.stack?.substring(0, 800) || 'no stack');
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;