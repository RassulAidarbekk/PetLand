function showPriceInputDialog(petId) {
    const notification = notify.info('Enter price in PetCoin', 'List for Sale', 0);
    
    notification.querySelector('.notification-progress').remove();
    notification.querySelector('.notification-close').remove();
    
    const inputContainer = document.createElement('div');
    inputContainer.className = 'notification-input';
    inputContainer.style.marginTop = '10px';
    
    inputContainer.innerHTML = `
        <input type="number" 
               min="0.1" 
               step="0.1" 
               placeholder="Enter price..." 
               class="price-input"
               style="width:100%; padding:10px; border:2px solid #e0e0e0; border-radius:8px; font-size:14px; margin-bottom:10px;">
        <div style="display:flex; gap:10px;">
            <button class="btn-price-submit" style="flex:1; background:#4a6fa5; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:600;">
                List for Sale
            </button>
            <button class="btn-price-cancel" style="flex:1; background:#f0f0f0; color:#333; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:600;">
                Cancel
            </button>
        </div>
    `;
    
    notification.querySelector('.notification-content').appendChild(inputContainer);
    
    const input = notification.querySelector('.price-input');
    input.focus();
    
    notification.querySelector('.btn-price-submit').onclick = () => {
        const price = input.value.trim();
        if (price && !isNaN(price) && Number(price) > 0) {
            notification.classList.add('hiding');
            listForSale(petId, price);
        } else {
            notify.warning('Please enter a valid price greater than 0', 'Invalid Price');
            input.focus();
        }
    };
    
    notification.querySelector('.btn-price-cancel').onclick = () => {
        notification.classList.add('hiding');
    };
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            notification.querySelector('.btn-price-submit').click();
        }
    });
}

function renderPetCard(pet, container, isMarket = false, onRemoveFromMarket = null, onDeletePet = null) {
  const card = document.createElement('div');
  card.className = 'pet-card';
  card.dataset.petId = pet._id;

  card.dataset.petData = JSON.stringify({
    _id: pet._id,
    image: pet.image,
    upper: pet.upper,
    face: pet.face,
    down: pet.down,
    color: pet.color,
    forSale: pet.forSale,
    price: pet.price,
    owner: pet.owner
  });

  if (pet.upper !== pet.face || pet.face !== pet.down) {
    card.classList.add('rare');
  }

  const img = document.createElement('img');
  img.src = pet.image;
  card.appendChild(img);

  const info = document.createElement('p');
  info.innerHTML = `
    <strong>ID:</strong> ${pet._id}<br>
    Type: ${pet.upper} - ${pet.face} - ${pet.down}<br>
    Color: ${pet.color}<br>
    ${pet.forSale ? `<strong>Price:</strong> ${pet.price} PetCoin<br>` : ''}
    ${isMarket ? `<strong>Seller:</strong> ${pet.owner.slice(0,6)}...${pet.owner.slice(-4)}` : ''}
  `;
  card.appendChild(info);

  if (!isMarket) {
    if (pet.forSale) {
      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove from Market';
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        if (onRemoveFromMarket) onRemoveFromMarket(pet._id);
        else notify.warning('Remove function not available', 'Action Unavailable');
      };
      card.appendChild(removeBtn);
    } else {
      const sellBtn = document.createElement('button');
      sellBtn.textContent = 'List for Sale';
      sellBtn.onclick = (e) => {
        e.stopPropagation();
        showPriceInputDialog(pet._id);
      };
      card.appendChild(sellBtn);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete Pet';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      if (onDeletePet) {
        onDeletePet(pet._id);
      } else {
        notify.warning('Delete function not available', 'Action Unavailable');
      }
    };
    card.appendChild(deleteBtn);
  } else if (pet.forSale) {
    const buyBtn = document.createElement('button');
    buyBtn.textContent = `Buy for ${pet.price} PetCoin`;
    buyBtn.onclick = (e) => {
      e.stopPropagation();
      if (window.buyPet) {
        buyPet(pet._id, pet.price, pet.owner);
      } else {
        notify.warning('Buy function not available', 'Action Unavailable');
      }
    };
    card.appendChild(buyBtn);
  }

  container.appendChild(card);
}

function getPetDataFromCard(card) {
    try {
        const petData = JSON.parse(card.dataset.petData);
        return petData;
    } catch (e) {
        console.error('Failed to parse pet data:', e);
        return null;
    }
}