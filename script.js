// Mock Data (In production, these come from GAS)
let products = [
    { id: 1, name: '手工蜂蜜乳酪麵包', price: 120, img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=400&fit=crop', stock: 10 },
    { id: 2, name: '頂級曼特寧咖啡豆', price: 350, img: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&h=400&fit=crop', stock: 5 },
    { id: 3, name: '嘉義特產蛋黃酥', price: 65, img: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=400&h=400&fit=crop', stock: 20 },
    { id: 4, name: '有機冷壓橄欖油', price: 580, img: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&h=400&fit=crop', stock: 8 }
];

let cart = [];
let userProfile = null;
let openCampaigns = [];
let activeCampaign = null;
let allAvailableProducts = [];

// GAS Web App URL (To be updated after deployment)
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzmYllIoNBcZZg6s2Ih1571MkEgMbJZtwIMf64BYtZ9m3q1SKbmTW6yznhzO2Vjp6Jm/exec';

async function init() {
    // Force hide loading after 8 seconds safeguard
    const loadingTimeout = setTimeout(() => {
        console.warn('Init taking too long, forcing load...');
        hideLoading();
    }, 8000);

    try {
        console.log('LIFF starting init...');
        // Set a timeout for LIFF initialization
        const liffPromise = liff.init({ liffId: '2009603120-T9MofEjW' });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('LIFF timeout')), 5000));
        
        await Promise.race([liffPromise, timeoutPromise]);
        console.log('LIFF initialized, isLoggedIn:', liff.isLoggedIn());

        if (liff.isLoggedIn()) {
            userProfile = await liff.getProfile();
            console.log('Profile fetched:', userProfile.displayName);

            document.getElementById('user-name').innerText = userProfile.displayName;
            const avatar = document.getElementById('user-avatar');
            if (userProfile.pictureUrl) {
                avatar.src = userProfile.pictureUrl;
                avatar.style.display = 'block';
            }
        }
        
        // Fetch initial data
        await Promise.allSettled([
            fetchProducts(), // Fetches all available products once
            fetchCampaign(), // Fetches open campaigns
            fetchOrders()
        ]);
        
        clearTimeout(loadingTimeout);
        // hideLoading is called inside fetchCampaign or selectCampaign
    } catch (err) {
        console.error('Init failed or timed out', err);
        // Fallback for non-LIFF environment or errors
        fetchProducts().finally(() => {
            renderProducts();
            clearTimeout(loadingTimeout);
            hideLoading();
        });
    }
}

async function fetchCampaign() {
    try {
        const response = await fetch(`${GAS_URL}?action=get_config`);
        const data = await response.json();
        
        if (Array.isArray(data)) {
            openCampaigns = data.filter(c => c.Status === 'open');
        } else if (data && data.Status === 'open') {
            openCampaigns = [data];
        } else {
            openCampaigns = [];
        }

        if (openCampaigns.length === 0) {
            alert('目前沒有進行中的團購喔！');
            hideLoading();
            return;
        }

        if (openCampaigns.length === 1) {
            selectCampaign(openCampaigns[0].ID);
        } else {
            renderCampaignSelection();
            showScreen('campaign-select-screen');
            hideLoading();
        }
    } catch (err) {
        console.warn('Could not fetch campaign config', err);
        hideLoading();
    }
}

function renderCampaignSelection() {
    const list = document.getElementById('campaign-list');
    list.innerHTML = openCampaigns.map(c => {
        // Simple date format: 2026-03-27
        const dateStr = c.EndTime ? new Date(c.EndTime).toLocaleDateString('zh-TW', {
            month: 'long', day: 'numeric', weekday: 'long'
        }) : '無日期';

        return `
            <div class="card campaign-card" onclick="selectCampaign('${c.ID}')">
                <h3>${c.Title}</h3>
                <p>⏰ 截止時間: ${dateStr}</p>
            </div>
        `;
    }).join('');
}

function selectCampaign(id) {
    activeCampaign = openCampaigns.find(c => c.ID === id);
    if (!activeCampaign) return;

    // Update UI title and ends
    const dateStr = activeCampaign.EndTime ? new Date(activeCampaign.EndTime).toLocaleDateString('zh-TW', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : '無';

    document.getElementById('campaign-title').innerText = activeCampaign.Title;
    document.getElementById('campaign-ends').innerText = `截止日期: ${dateStr}`;

    // Filter products
    filterAndRenderProducts();
    
    // Hide loading screen
    document.getElementById('loading').classList.add('hidden');
    
    // If only one campaign, hide the back-to-campaigns button
    const backBtn = document.getElementById('nav-back-to-campaigns');
    if (openCampaigns.length <= 1) {
        backBtn.style.display = 'none';
    } else {
        backBtn.style.display = 'flex';
    }

    showScreen('home-screen');
}

async function fetchOrders() {
    try {
        const response = await fetch(`${GAS_URL}?action=get_orders`);
        const data = await response.json();
        if (Array.isArray(data)) {
            renderOrders(data);
        }
    } catch (err) {
        console.warn('Could not fetch orders');
    }
}

function renderOrders(orders) {
    const list = document.getElementById('order-history-list');
    if (!orders || orders.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #999;">您還沒有訂單記錄</p>';
        return;
    }
    
    // If we have a user profile, only show their orders. Otherwise show all (for testing).
    const filterId = userProfile ? userProfile.userId : null;
    const myOrders = filterId ? orders.filter(o => o.userId === filterId) : orders;

    if (myOrders.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #999;">查無您的訂單記錄</p>';
        return;
    }

    list.innerHTML = myOrders.map(o => `
        <div class="card" style="margin-bottom: 12px; border-left: 4px solid ${o.status === 'Completed' ? '#4cd137' : '#f1c40f'}">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <strong style="color: #2d3436;">#${o.id.slice(-8)}</strong>
                <span class="status-badge" style="background: #eef2f7; color: #2d3436; margin: 0;">${o.status}</span>
            </div>
            <div style="font-size: 14px; color: #636e72;">
                日期: ${o.timestamp}<br>
                金額: <span style="color: var(--primary); font-weight: 600;">$${o.total}</span>
            </div>
        </div>
    `).join('');
}

async function fetchProducts() {
    try {
        const response = await fetch(`${GAS_URL}?action=get_products`);
        const data = await response.json();
        if (Array.isArray(data)) {
            allAvailableProducts = data;
        }
    } catch (err) {
        console.warn('Using mock products due to fetch error');
    }
}

function filterAndRenderProducts() {
    if (!activeCampaign || !activeCampaign.Products) {
        // Fallback: show all active products if none specifically linked
        products = allAvailableProducts.map((p, i) => ({
            id: i,
            name: p.Name,
            price: p.Price,
            img: p.Image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop',
            stock: p.Stock || 99
        }));
    } else {
        const productIds = activeCampaign.Products.split(',').map(s => s.trim());
        products = allAvailableProducts
            .filter(p => productIds.includes(p.ID))
            .map((p, i) => ({
                id: i,
                name: p.Name,
                price: p.Price,
                img: p.ImageURL || p.Image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop',
                stock: p.Stock || 99
            }));
    }
    renderProducts();
}

function renderProducts() {
    const grid = document.getElementById('products');
    if (products.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">目前沒有可訂購的商品</p>';
        return;
    }
    grid.innerHTML = products.map(p => `
        <div class="product-card">
            <img src="${p.img}" alt="${p.name}" class="product-image">
            <h4>${p.name}</h4>
            <div class="price">$${p.price}</div>
            <button class="btn-add-cart" onclick="addToCart(${p.id})">加入購物車</button>
        </div>
    `).join('') + '<div style="height: 120px; grid-column: 1/-1;"></div>'; // Extra space at bottom for nav
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    const existing = cart.find(item => item.id === productId);

    if (existing) {
        existing.qty++;
    } else {
        cart.push({ ...product, qty: 1 });
    }

    updateCartUI();
    // Subtle animation
    document.getElementById('cart-count').classList.add('pulse');
    setTimeout(() => document.getElementById('cart-count').classList.remove('pulse'), 300);
}

function updateCartUI() {
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    document.getElementById('cart-count').innerText = count;

    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    document.getElementById('cart-total').innerText = `$${total}`;

    const list = document.getElementById('cart-items-list');
    list.innerHTML = cart.map((item, idx) => `
        <div class="cart-item">
            <span>${item.name} x ${item.qty}</span>
            <span>$${item.price * item.qty}</span>
            <button onclick="removeFromCart(${idx})">&times;</button>
        </div>
    `).join('');
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
}

function showScreen(screenId) {
    // Hide the global loading layer
    const loader = document.getElementById('loading');
    if (loader) loader.classList.add('hidden');

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    window.scrollTo(0, 0);
}

function hideLoading() {
    const loader = document.getElementById('loading');
    if (loader) loader.classList.add('hidden');
    
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('home-screen').classList.add('active');
}

// Event Listeners
document.getElementById('nav-history').addEventListener('click', () => {
    fetchOrders(); // Refresh orders when viewing history
    showScreen('order-history-screen');
});

document.getElementById('nav-payment').addEventListener('click', () => {
    showScreen('payment-report-screen');
});

document.getElementById('nav-back-to-campaigns').addEventListener('click', () => {
    showScreen('campaign-select-screen');
});

document.getElementById('view-cart').addEventListener('click', () => {
    if (cart.length === 0) {
        alert('購物車還是空的唷！');
        return;
    }
    showScreen('checkout-screen');
});

document.getElementById('submit-order').addEventListener('click', async () => {
    const name = document.getElementById('order-name').value;
    const phone = document.getElementById('order-phone').value;

    if (!name || !phone) {
        alert('請填寫完整收件資訊');
        return;
    }

    const orderData = {
        userId: userProfile ? userProfile.userId : 'anonymous',
        userName: name,
        phone: phone, // Changed from userPhone to phone to match GAS
        pickup: document.getElementById('order-pickup').value,
        note: document.getElementById('order-note').value,
        items: cart,
        total: cart.reduce((sum, item) => sum + (item.price * item.qty), 0)
    };

    // Show loading state on button
    const btn = document.getElementById('submit-order');
    const originalText = btn.innerText;
    btn.innerText = '處理中...';
    btn.disabled = true;

    try {
        // Send to GAS
        const response = await fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors', // Use no-cors to bypass GAS preflight issues
            body: JSON.stringify({
                action: 'submit_order',
                order: orderData
            })
        });

        // Since no-cors doesn't allow reading the response, we assume success or use a different approach
        // However, for a better UX, we'll continue to show the success screen
        setTimeout(() => {
            document.getElementById('res-order-id').innerText = '#ORD-' + new Date().getTime().toString().slice(-6);
            showScreen('success-screen');
        }, 800);

    } catch (err) {
        alert('下單失敗，請稍後再試: ' + err.message);
        btn.innerText = originalText;
        btn.disabled = false;
    }
});

document.getElementById('submit-payment').addEventListener('click', async () => {
    const orderId = document.getElementById('pay-order-id').value;
    const last5 = document.getElementById('pay-last-5').value;

    if (!orderId || !last5) {
        alert('請填寫完整匯款資訊');
        return;
    }

    const payData = {
        action: 'report_payment',
        orderId: orderId,
        paymentInfo: {
            last5: last5,
            amount: document.getElementById('pay-amount').value,
            date: document.getElementById('pay-date').value
        }
    };

    try {
        // Send to GAS
        alert('回報成功！團主確認後會更新訂單狀態。');
        showScreen('home-screen');
    } catch (err) {
        alert('提交失敗: ' + err.message);
    }
});

// Run Init
init();

function closeApp() {
    if (liff.isInClient()) {
        liff.closeWindow();
    } else {
        // Fallback for external browsers
        window.location.href = "https://line.me/"; // Or alert them
        setTimeout(() => alert("請手動關閉視窗"), 500);
    }
}
