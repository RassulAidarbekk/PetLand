const API_BASE = 'http://localhost:5000/api';
const PETCOIN_ADDRESS = '0x38034f04b21dcc3C9c03ef0cFF00f22c840e0399';
const TREASURY = '0x54b67d650c8b31afC533b88b9daa1209a9D8d0F9';

let account;
let provider;
let signer;
let petCoin;

let selectedPets = [];

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

  petCoin = petCoin.connect(signer);

  document.getElementById('connectWallet').textContent =
    account.slice(0,6) + '...' + account.slice(-4);

  updateBalance();
  getMyPets();
}

async function showConfirm(message) {
  return new Promise((resolve) => {
    const notification = notify.warning(message, 'Confirm Action', 0);
    
    notification.querySelector('.notification-progress').remove();
    notification.querySelector('.notification-close').remove();
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'notification-buttons';
    buttonContainer.style.marginTop = '10px';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    
    buttonContainer.innerHTML = `
      <button class="btn-confirm-yes" style="flex:1; background:#4a6fa5; color:white; border:none; padding:8px; border-radius:6px; cursor:pointer;">
        Yes
      </button>
      <button class="btn-confirm-no" style="flex:1; background:#f0f0f0; color:#333; border:none; padding:8px; border-radius:6px; cursor:pointer;">
        No
      </button>
    `;
    
    notification.querySelector('.notification-content').appendChild(buttonContainer);
    
    notification.querySelector('.btn-confirm-yes').onclick = () => {
      notification.classList.add('hiding');
      resolve(true);
    };
    
    notification.querySelector('.btn-confirm-no').onclick = () => {
      notification.classList.add('hiding');
      resolve(false);
    };
  });
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

async function getMyPets() {
  const loading = document.getElementById('loading');
  const noPets = document.getElementById('noPets');
  const container = document.getElementById('petsContainer');

  loading.style.display = 'block';
  noPets.style.display = 'none';
  container.innerHTML = '';

  try {
    const res = await fetch(`${API_BASE}/pets/${account}`);
    if (!res.ok) throw new Error('Failed to load pets');

    const pets = await res.json();

    if (pets.length === 0) {
      noPets.style.display = 'block';
    } else {
      pets.forEach(pet => {
        renderPetCard(
          pet,
          container,
          false,
          (petId) => removeFromMarket(petId),
          (petId) => deletePet(petId)
        );
      });
    }
  } catch (err) {
    console.error(err);
    notify.error('Failed to load your pets');
  } finally {
    loading.style.display = 'none';
  }
}

function openMergeModal() {
  if (!account) {
    notify.warning('Connect your wallet first');
    return;
  }

  selectedPets = [];
  const modal = document.getElementById('mergeModal');
  const list = document.getElementById('mergePetsList');
  const confirmBtn = document.getElementById('mergeConfirmBtn');

  if (!modal || !list || !confirmBtn) {
    notify.error('Merge modal not found');
    return;
  }

  modal.style.display = 'flex';
  list.innerHTML = '<p>Loading your pets...</p>';
  confirmBtn.disabled = true;
  confirmBtn.onclick = null;

  fetch(`${API_BASE}/pets/${account}`)
    .then(res => res.json())
    .then(pets => {
      list.innerHTML = '';

      if (pets.length < 2) {
        list.innerHTML = '<p>You need at least 2 pets to merge</p>';
        return;
      }

      pets.forEach(pet => {
        const card = document.createElement('div');
        card.className = 'merge-pet-card';
        card.dataset.petId = pet._id;

        card.innerHTML = `
          <img src="${pet.image}" alt="Pet" style="width:100%; height:160px; object-fit:contain;">
          <p><strong>ID:</strong> ${pet._id.slice(0,8)}...</p>
          <p>${pet.upper} - ${pet.face} - ${pet.down}</p>
          ${pet.forSale ? '<small>(On sale)</small>' : ''}
        `;

        card.onclick = () => togglePetSelection(card, pet._id);
        list.appendChild(card);
      });
    })
    .catch(err => {
      console.error('Failed to load pets for merge:', err);
      list.innerHTML = '<p>Failed to load pets</p>';
      notify.error('Failed to load pets for merge');
    });
}

function togglePetSelection(card, petId) {
  if (selectedPets.includes(petId)) {
    selectedPets = selectedPets.filter(id => id !== petId);
    card.classList.remove('selected');
  } else {
    if (selectedPets.length >= 2) {
      notify.warning('You can select only two pets');
      return;
    }
    selectedPets.push(petId);
    card.classList.add('selected');
  }

  const confirmBtn = document.getElementById('mergeConfirmBtn');
  confirmBtn.disabled = selectedPets.length !== 2;

  if (selectedPets.length === 2) {
    confirmBtn.onclick = () => performMerge(selectedPets[0], selectedPets[1]);
  }
}

function closeMergeModal() {
  document.getElementById('mergeModal').style.display = 'none';
  selectedPets = [];
}

async function performMerge(petId1, petId2) {
  closeMergeModal();

  try {
    const tx = await petCoin.transfer(TREASURY, ethers.utils.parseEther('20'));
    await tx.wait();

    const res = await fetch(`${API_BASE}/pets/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner: account, petId1, petId2, txHash: tx.hash })
    });

    if (res.ok) {
      notify.success('Pets merged successfully!', 'Success');
      getMyPets();
      updateBalance();
    } else {
      const err = await res.json();
      notify.error(err.error || 'Merge failed');
    }
  } catch (err) {
    notify.error(err.message || 'Transaction error');
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
      getMyPets();
    } else {
      notify.error(data.error || data.msg || 'Failed to list pet for sale');
    }
  } catch (err) {
    notify.error('Error: ' + err.message);
  }
}

async function removeFromMarket(petId) {
  const confirmRemove = await showConfirm('Are you sure you want to remove this pet from the market?');
  if (!confirmRemove) return;

  try {
    const res = await fetch(`${API_BASE}/market/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ petId, owner: account })
    });

    const data = await res.json();

    if (res.ok) {
      notify.success('Pet removed from market!', 'Pet Removed');
      getMyPets();
    } else {
      notify.error(data.error || data.msg || 'Failed to remove from market');
    }
  } catch (err) {
    notify.error('Error: ' + err.message);
  }
}

async function deletePet(petId) {
  const confirmDelete = await showConfirm('Are you sure you want to delete this pet? This action cannot be undone.');
  if (!confirmDelete) return;

  try {
    const res = await fetch(`${API_BASE}/pets/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ petId, owner: account })
    });

    const data = await res.json();

    if (res.ok) {
      notify.success('Pet deleted successfully!', 'Pet Deleted');
      getMyPets();
    } else {
      notify.error(data.error || data.msg || 'Failed to delete pet');
    }
  } catch (err) {
    notify.error('Error: ' + err.message);
  }
}

document.getElementById('mergePets').onclick = openMergeModal;
document.getElementById('connectWallet').onclick = initWeb3;

initWeb3();
