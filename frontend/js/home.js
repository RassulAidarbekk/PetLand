const API_BASE = 'http://localhost:5000/api';
const PETCOIN_ADDRESS = '0x38034f04b21dcc3C9c03ef0cFF00f22c840e0399';
const TREASURY = '0x54b67d650c8b31afC533b88b9daa1209a9D8d0F9';

let account;
let provider;
let signer;
let petCoin;

async function initWeb3() {
  if (!window.ethereum) {
    notify.warning('Please install Metamask!');
    return;
  }

  provider = new ethers.providers.Web3Provider(window.ethereum);
  const chainId = (await provider.getNetwork()).chainId;

  if (chainId !== 11155111) {
    notify.warning('Please switch to Sepolia network!');
    return;
  }

  await window.ethereum.request({ method: 'eth_requestAccounts' });
  account = (await provider.listAccounts())[0];
  signer = provider.getSigner();

  petCoin = new ethers.Contract(
    PETCOIN_ADDRESS,
    [
      'function balanceOf(address) view returns (uint256)',
      'function transfer(address to, uint256 amount) returns (bool)'
    ],
    signer
  );

  document.getElementById('connectWallet').textContent = 
    account.slice(0,6) + '...' + account.slice(-4);

  updateBalance();
  loadLastPet();
  checkPendingCreation();
}

async function updateBalance() {
  try {
    const bal = await petCoin.balanceOf(account);
    document.getElementById('balance').textContent = 
      `Balance: ${ethers.utils.formatEther(bal)} PetCoin`;
  } catch (err) {
    console.error('Balance error:', err);
    document.getElementById('balance').textContent = 'Balance: error';
  }
}

async function createPet() {
  if (!account) return notify.warning('Connect your wallet first');

  const loading = document.getElementById('loading');
  const createBtn = document.getElementById('createPet');

  if (loading) loading.style.display = 'block';
  if (createBtn) createBtn.disabled = true;

  try {
    const tx = await petCoin.transfer(TREASURY, ethers.utils.parseEther('10'));
    notify.info('Transaction sent. Waiting for confirmation...');

    await tx.wait();

    notify.success('Transaction confirmed! Creating pet...');

    const res = await fetch(`${API_BASE}/pets/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner: account, txHash: tx.hash })
    });

    const data = await res.json();

    if (res.ok) {
      notify.success('Pet created successfully!', 'Success');
      updateBalance();
      loadLastPet();
      localStorage.removeItem('pendingPetTx');
    } else {
      notify.error(data.error || data.msg || 'Failed to create pet');
    }
  } catch (err) {
    notify.error(err.message || 'Transaction or creation failed');
    if (tx && tx.hash) {
      localStorage.setItem('pendingPetTx', tx.hash);
      notify.info('Pet creation will finish when you return to this page');
    }
  } finally {
    if (loading) loading.style.display = 'none';
    if (createBtn) createBtn.disabled = false;
  }
}

async function checkPendingCreation() {
  const pendingTx = localStorage.getItem('pendingPetTx');
  if (!pendingTx || !account) return;

  notify.info('Finishing pending pet creation...');

  try {
    const res = await fetch(`${API_BASE}/pets/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner: account, txHash: pendingTx })
    });

    const data = await res.json();

    if (res.ok) {
      notify.success('Pending pet created!', 'Success');
      localStorage.removeItem('pendingPetTx');
      updateBalance();
      loadLastPet();
    } else {
      notify.error(data.error || 'Failed to complete pending creation');
    }
  } catch (err) {
    console.error('Pending creation failed:', err);
  }
}

async function loadLastPet() {
  const container = document.getElementById('lastPetCard');
  const noMsg = document.getElementById('noLastPet');

  if (!container) return;

  container.innerHTML = '';
  if (noMsg) noMsg.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/pets/${account}`);
    if (!res.ok) throw new Error('Failed to load pets');

    const pets = await res.json();

    if (pets.length === 0) {
      if (noMsg) noMsg.style.display = 'block';
      return;
    }

    const lastPet = pets[pets.length - 1];
    renderPetCard(lastPet, container);
  } catch (err) {
    console.error('Error loading last pet:', err);
    if (noMsg) noMsg.style.display = 'block';
  }
}

async function listForSale(petId, price) {
  if (!price || isNaN(price) || Number(price) <= 0) {
    notify.warning('Enter a valid price in PetCoin');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/market/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        petId: petId,
        price: Number(price),
        owner: account
      })
    });

    const data = await res.json();

    if (res.ok) {
      notify.success(`Pet listed for sale for ${price} PetCoin!`, 'Pet Listed');
      if (document.getElementById('petsContainer')) {
        getMyPets();
      } else if (document.getElementById('lastPetCard')) {
        loadLastPet();
      }
    } else {
      notify.error(data.error || data.msg || 'Failed to list pet for sale');
    }
  } catch (err) {
    notify.error('Error: ' + err.message);
  }
}

document.getElementById('connectWallet').onclick = initWeb3;
document.getElementById('createPet').onclick = createPet;

initWeb3();
