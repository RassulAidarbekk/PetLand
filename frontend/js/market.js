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

async function getMarketPets() {
  const container = document.getElementById('marketContainer');
  const loading = document.getElementById('loading');

  loading.style.display = 'block';
  container.innerHTML = '';

  try {
    const res = await fetch(`${API_BASE}/market`);
    if (!res.ok) throw new Error('Failed to load market');

    const pets = await res.json();

    const uniquePets = Array.from(
      new Map(pets.map(pet => [pet._id, pet])).values()
    );

    if (uniquePets.length === 0) {
      container.innerHTML = '<p>No pets on sale yet</p>';
    } else {
      uniquePets.forEach(pet => renderPetCard(pet, container, true));
    }

  } catch (err) {
    console.error('Market error:', err);
    container.innerHTML = '<p>Error loading market</p>';
  } finally {
    loading.style.display = 'none';
  }
}

async function buyPet(petId, price, seller) {
  if (!seller) {
    notify.warning('Seller address not found');
    return;
  }

  try {
    const tx = await petCoin.transfer(seller, ethers.utils.parseEther(price.toString()));
    await tx.wait();

    const res = await fetch(`${API_BASE}/market/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ petId, buyer: account, txHash: tx.hash })
    });

    if (res.ok) {
      notify.success('Pet bought successfully!', 'Purchase Complete');
      getMarketPets(); 
      updateBalance();
    } else {
      const err = await res.json();
      notify.error(err.error || 'Purchase failed');
    }
  } catch (err) {
    notify.error(err.message || 'Transaction error');
  }
}

function showLoading(show) {
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = show ? 'block' : 'none';
}

document.getElementById('connectWallet').onclick = initWeb3;
initWeb3().then(() => getMarketPets());
