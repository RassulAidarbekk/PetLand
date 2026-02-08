const express = require('express');
const ethers = require('ethers');
const Pet = require('../models/Pet');

const router = express.Router();

const provider = new ethers.providers.JsonRpcProvider(process.env.INFURA_KEY);
const petCoinAddress = process.env.PETCOIN_ADDRESS;

provider.getNetwork()
  .then(net => console.log(`[INIT] Connected to network: ${net.name} (chainId ${net.chainId})`))
  .catch(err => console.error('[INIT] RPC connection error:', err.message));

const transferABI = ['event Transfer(address indexed from, address indexed to, uint256 value)'];

router.get('/', async (req, res) => {
  try {
    const pets = await Pet.find({ forSale: true });
    res.json(pets);
  } catch (err) {
    console.error('[MARKET GET] Error:', err);
    res.status(500).json({ error: 'Failed to load market' });
  }
});

router.post('/list', async (req, res) => {
  const { petId, price, owner } = req.body;

  try {
    if (!petId || !price || !owner) {
      return res.status(400).json({ msg: 'Missing required fields' });
    }

    const pet = await Pet.findById(petId);
    if (!pet) return res.status(404).json({ msg: 'Pet not found' });
    if (pet.owner !== owner) return res.status(403).json({ msg: 'Not your pet' });

    pet.forSale = true;
    pet.price = Number(price);
    await pet.save();

    res.json(pet);
  } catch (err) {
    console.error('[LIST] Error:', err);
    res.status(500).json({ msg: 'Failed to list pet' });
  }
});

router.post('/buy', async (req, res) => {
  const { petId, buyer, txHash } = req.body;

  console.log('[BUY] Purchase request:');
  console.log('  petId:', petId);
  console.log('  buyer:', buyer);
  console.log('  txHash:', txHash);

  try {
    if (!petId || !buyer || !txHash) {
      throw new Error('Missing required fields: petId, buyer or txHash');
    }

    const pet = await Pet.findById(petId);
    if (!pet) throw new Error('Pet not found');

    console.log('[BUY] Pet found:', {
      id: pet._id,
      owner: pet.owner,
      price: pet.price,
      forSale: pet.forSale
    });

    if (!pet.forSale) throw new Error('Pet is not for sale anymore');

    if (buyer.toLowerCase() === pet.owner.toLowerCase()) {
      throw new Error('You cannot buy your own pet');
    }

    const buyProvider = new ethers.providers.JsonRpcProvider(process.env.INFURA_KEY);

    const net = await buyProvider.getNetwork();
    console.log('[BUY] Provider connected:', net.name, net.chainId);

    const tx = await buyProvider.getTransaction(txHash);
    if (!tx) throw new Error('Transaction not found');

    console.log('[BUY] Transaction found');

    const receipt = await buyProvider.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error('Transaction receipt not found (transaction may not be confirmed yet)');
    }

    console.log('[BUY] Receipt received:', {
      status: receipt.status,
      blockNumber: receipt.blockNumber,
      logsCount: receipt.logs?.length || 0
    });

    if (receipt.status === 0) {
      throw new Error('Transaction failed (reverted)');
    }

    const iface = new ethers.utils.Interface(transferABI);

    const logs = receipt.logs || [];
    const petCoinLogs = logs.filter(log =>
      log.address && log.address.toLowerCase() === petCoinAddress.toLowerCase()
    );

    const transferred = petCoinLogs.some(log => {
      try {
        const decoded = iface.parseLog(log);
        return (
          decoded.name === 'Transfer' &&
          decoded.args.from.toLowerCase() === buyer.toLowerCase() &&
          decoded.args.to.toLowerCase() === pet.owner.toLowerCase() &&
          decoded.args.value.gte(ethers.utils.parseEther(pet.price.toString()))
        );
      } catch (e) {
        return false;
      }
    });

    if (!transferred) {
      throw new Error('Payment not verified or incorrect amount');
    }

    pet.owner = buyer;
    pet.forSale = false;
    pet.price = 0;
    await pet.save();

    console.log('[BUY] Purchase successful! New owner:', buyer);

    res.json({ success: true, pet });
  } catch (err) {
    console.error('[BUY] ERROR:');
    console.error('Message:', err.message);
    console.error('Code:', err.code || 'no code');
    console.error('Stack:', err.stack?.substring(0, 800) || 'no stack');
    res.status(500).json({ error: err.message });
  }
});

router.post('/remove', async (req, res) => {
  const { petId, owner } = req.body;

  try {
    if (!petId || !owner) {
      return res.status(400).json({ msg: 'Missing petId or owner' });
    }

    const pet = await Pet.findById(petId);
    if (!pet) return res.status(404).json({ msg: 'Pet not found' });

    if (pet.owner !== owner) {
      return res.status(403).json({ msg: 'Not your pet' });
    }

    if (!pet.forSale) {
      return res.status(400).json({ msg: 'Pet is not on sale' });
    }

    pet.forSale = false;
    pet.price = 0;
    await pet.save();

    res.json({ success: true, pet });
  } catch (err) {
    console.error('[REMOVE] Error:', err);
    res.status(500).json({ msg: 'Failed to remove from market' });
  }
});

module.exports = router;