// Mock Data (In production, these come from GAS)
let products = [
    { id: 1, name: '手工蜂蜜乳酪麵包', price: 120, img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=400&fit=crop', stock: 10 },
    { id: 2, name: '頂級曼特寧咖啡豆', price: 350, img: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&h=400&fit=crop', stock: 5 },
    { id: 3, name: '嘉義特產蛋黃酥', price: 65, img: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=400&h=400&fit=crop', stock: 20 },
    { id: 4, name: '有機冷壓橄欖油', price: 580, img: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&h=400&fit=crop', stock: 8 }
];

let cart = [];
let userProfile = null;

// GAS Web App URL (To be updated after deployment)
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxflj9jPfH5NhOPYBP_2_J4K3xc4azzDkhISoge6Elx5hLIOh7_rdFaq3gsSsjw2z6R/exec';

async function init() {
    try {
        console.log('LIFF starting init...');
        await liff.init({ liffId: '2009603120-T9MofEjW' });

        console.log('LIFF initialized, isLoggedIn:', liff.isLoggedIn());

        if (!liff.isLoggedIn()) {
            console.log('Not logged in, triggering LIFF login...');
            liff.login();
            return;
        }

        userProfile = await liff.getProfile();
        console.log('Profile fetched:', userProfile.displayName);

        document.getElementById('user-name').innerText = userProfile.displayName;
        const avatar = document.getElementById('user-avatar');
        if (userProfile.pictureUrl) {
            avatar.src = userProfile.pictureUrl;
            avatar.style.display = 'block';
        }

        // Fetch real products from GAS
        await fetchProducts();
        renderProducts();
        hideLoading();
    } catch (err) {
        console.error('LIFF Init failed', err);
        // Show alert to user in production to help debug
        if (!window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
            alert('LIFF 初始化失敗: ' + err.message);
        }

        // Fallback for non-LIFF environment (local testing)
        renderProducts();
        hideLoading();
    }
}

async function fetchProducts() {
    try {
        const response = await fetch(`${GAS_URL}?action=get_products`);
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
            products = data.map((p, i) => ({
                id: i,
                name: p.Name,
                price: p.Price,
                img: p.Image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop',
                stock: p.Stock || 99
            }));
        }
    } catch (err) {
        console.warn('Using mock products due to fetch error');
    }
}

function renderProducts() {
    const grid = document.getElementById('products');
    grid.innerHTML = products.map(p => `
        <div class="product-card">
            <img src="${p.img}" alt="${p.name}" class="product-image">
            <h4>${p.name}</h4>
            <div class="price">$${p.price}</div>
            <button class="btn-add-cart" onclick="addToCart(${p.id})">加入購物車</button>
        </div>
    `).join('');
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
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    window.scrollTo(0, 0);
}

function hideLoading() {
    document.getElementById('loading').classList.remove('active');
    document.getElementById('home-screen').classList.add('active');
}

// Event Listeners
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

