// ranking.js
// Top 1000 cryptocurrency ranking and live refresh logic

// Format market cap with K/M/B/T suffixes (clean & original style)
function formatMarketCap(value) {
    if (value === undefined || value === null) return '$0';
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toLocaleString()}`;
}

// Format price with appropriate decimals (clean)
function formatPrice(price) {
    if (price === undefined || price === null) return '$0.00';
    if (price < 0.000001) return `$${price.toFixed(10)}`;
    if (price < 0.0001) return `$${price.toFixed(8)}`;
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    if (price < 1000) return `$${price.toFixed(2)}`;
    return `$${price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

// Format change percentage with + sign
function formatChange(change) {
    if (change === undefined || change === null) return '0.00%';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
}

// DOM elements
const trendingContainer = document.getElementById('trendingContainer');
const tableBody = document.getElementById('cryptoTableBody');
const paginationBar = document.getElementById('paginationBar');
const pageNumbersSpan = document.getElementById('pageNumbers');
const pageInfoSpan = document.getElementById('pageInfo');
const prevBtn = document.getElementById('prevPage');
const nextBtn = document.getElementById('nextPage');

// Cache for current page data and render state
let currentPageData = [];
let cryptoPageCache = {};
let currentTrendingData = null;
let renderScheduled = false;
let trendingRenderScheduled = false;

// ---------- PAGINATION STATE ----------
const ITEMS_PER_PAGE = 100;
const TOTAL_CRYPTO_COUNT = 1000;
const TOTAL_PAGES = TOTAL_CRYPTO_COUNT / ITEMS_PER_PAGE;
let currentPage = 1;
let totalPages = TOTAL_PAGES;

function loadPage(page) {
    if (page < 1) page = 1;
    if (page > TOTAL_PAGES) page = TOTAL_PAGES;
    currentPage = page;
    currentPageData = cryptoPageCache[page] || [];
    renderTable();
    if (!cryptoPageCache[page]) {
        fetchCryptoPage(page);
    }
}

// ---------- RENDER TABLE (with pagination) ----------
function renderTable() {
    if (!tableBody) return;
    const pageItems = currentPageData || [];
    if (!pageItems.length) {
        tableBody.innerHTML = `<tr><td colspan="5" class="loading-state">Loading top ${TOTAL_CRYPTO_COUNT} cryptocurrencies...</td></tr>`;
        updatePaginationUI();
        return;
    }

    totalPages = TOTAL_PAGES;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < pageItems.length; i++) {
        const crypto = pageItems[i];
        const globalRank = startIndex + i + 1;
        const name = crypto.name || 'Unknown';
        const symbol = (crypto.symbol || '').toUpperCase();
        const imageUrl = crypto.image || 'https://cryptologos.cc/logos/bitcoin-btc-logo.png';
        const marketCap = crypto.market_cap ?? 0;
        const price = crypto.current_price ?? 0;
        const change = crypto.price_change_percentage_24h ?? 0;

        const changeClass = change >= 0 ? 'green' : 'red';
        const changeText = formatChange(change);

        const row = document.createElement('tr');

        const rankCell = document.createElement('td');
        rankCell.textContent = globalRank;
        rankCell.style.fontWeight = '500';

        const nameCell = document.createElement('td');
        nameCell.innerHTML = `<img src="${imageUrl}" class="crypto-logo" alt="${name}" onerror="this.src='https://cryptologos.cc/logos/bitcoin-btc-logo.png'"> ${name} (${symbol})`;

        const marketCell = document.createElement('td');
        marketCell.textContent = formatMarketCap(marketCap);

        const priceCell = document.createElement('td');
        priceCell.textContent = formatPrice(price);

        const changeCell = document.createElement('td');
        changeCell.innerHTML = `<span class="${changeClass}">${changeText}</span>`;

        row.appendChild(rankCell);
        row.appendChild(nameCell);
        row.appendChild(marketCell);
        row.appendChild(priceCell);
        row.appendChild(changeCell);

        fragment.appendChild(row);
    }

    tableBody.innerHTML = '';
    tableBody.appendChild(fragment);
    updatePaginationUI();
}

// ---------- PAGINATION UI ----------
function updatePaginationUI() {
    if (!paginationBar) return;
    const total = totalPages || 1;
    const page = currentPage;

    prevBtn.disabled = (page <= 1);
    nextBtn.disabled = (page >= total);

    let html = '';
    const maxVisible = 7;
    let startPage = 1;
    let endPage = total;

    if (total > maxVisible) {
        const half = Math.floor(maxVisible / 2);
        if (page <= half + 1) {
            startPage = 1;
            endPage = maxVisible;
        } else if (page >= total - half) {
            startPage = total - maxVisible + 1;
            endPage = total;
        } else {
            startPage = page - half;
            endPage = page + half;
        }
        if (startPage < 1) startPage = 1;
        if (endPage > total) endPage = total;
    }

    if (startPage > 1) {
        html += `<button class="page-number" data-page="1">1</button>`;
        if (startPage > 2) html += `<span class="page-info" style="margin:0 2px;">…</span>`;
    }

    for (let p = startPage; p <= endPage; p++) {
        const active = (p === page) ? 'active' : '';
        html += `<button class="page-number ${active}" data-page="${p}">${p}</button>`;
    }

    if (endPage < total) {
        if (endPage < total - 1) html += `<span class="page-info" style="margin:0 2px;">…</span>`;
        html += `<button class="page-number" data-page="${total}">${total}</button>`;
    }

    pageNumbersSpan.innerHTML = html;

    document.querySelectorAll('.page-number').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const pageNum = parseInt(e.target.dataset.page, 10);
            if (!isNaN(pageNum) && pageNum !== currentPage && pageNum >= 1 && pageNum <= totalPages) {
                loadPage(pageNum);
            }
        });
    });

    const start = (page - 1) * ITEMS_PER_PAGE + 1;
    const end = Math.min(page * ITEMS_PER_PAGE, TOTAL_CRYPTO_COUNT);
    pageInfoSpan.textContent = `Showing ${start}–${end} of ${TOTAL_CRYPTO_COUNT}`;
}

// ---------- TRENDING RENDER (unchanged) ----------
function renderTrending() {
    if (!trendingContainer) return;
    if (!currentTrendingData || !currentTrendingData.coins || currentTrendingData.coins.length === 0) {
        trendingContainer.innerHTML = '<div class="trending-item">No trending data available</div>';
        return;
    }

    const fragment = document.createDocumentFragment();
    const trendingCoins = currentTrendingData.coins.slice(0, 12);

    for (let coin of trendingCoins) {
        const item = coin.item;
        const priceChange = item.data?.price_change_percentage_24h?.usd ?? 0;
        const currentPrice = item.data?.price;
        const priceFormatted = currentPrice ? (currentPrice < 0.01 ? currentPrice.toFixed(6) : currentPrice.toFixed(4)) : '?';
        const changeClass = priceChange >= 0 ? 'green' : 'red';
        const changeSymbol = priceChange >= 0 ? '▲' : '▼';
        const thumbSrc = item.thumb || (item.large ? item.large : 'https://cryptologos.cc/logos/bitcoin-btc-logo.png');

        const trendItem = document.createElement('div');
        trendItem.className = 'trending-item';
        trendItem.innerHTML = `
            <img src="${thumbSrc}" alt="${item.name}">
            ${item.name} (${item.symbol?.toUpperCase() || ''}) - $${priceFormatted} /
            <span class="${changeClass}">${changeSymbol} ${Math.abs(priceChange).toFixed(2)}%</span>
        `;
        fragment.appendChild(trendItem);
    }

    trendingContainer.innerHTML = '';
    trendingContainer.appendChild(fragment);
}

function scheduleTableRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
        renderTable();
        renderScheduled = false;
    });
}

function scheduleTrendingRender() {
    if (trendingRenderScheduled) return;
    trendingRenderScheduled = true;
    requestAnimationFrame(() => {
        renderTrending();
        trendingRenderScheduled = false;
    });
}

// ---------- API FETCHING (unchanged) ----------
let currentMarketFetchId = 0;
let currentTrendingFetchId = 0;

async function fetchCryptoPage(page) {
    if (page < 1) page = 1;
    if (page > TOTAL_PAGES) page = TOTAL_PAGES;

    const fetchId = ++currentMarketFetchId;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(
            `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${ITEMS_PER_PAGE}&page=${page}&sparkline=false&price_change_percentage=24h`,
            { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const data = await response.json();

        if (fetchId !== currentMarketFetchId) return;

        if (data && Array.isArray(data) && data.length > 0) {
            cryptoPageCache[page] = data;
            if (page === currentPage) {
                currentPageData = data;
                scheduleTableRender();
            }
        } else if (!currentPageData.length) {
            tableBody.innerHTML = '<tr><td colspan="5" class="loading-state">⚠️ Failed to load data. Retrying...</td></tr>';
        }
    } catch (error) {
        if (error.name !== 'AbortError' && fetchId === currentMarketFetchId) {
            console.error('Market fetch error:', error);
            if (!currentPageData.length) {
                tableBody.innerHTML = '<tr><td colspan="5" class="loading-state">⚠️ Network error. Reconnecting...</td></tr>';
            }
        }
    }
}

async function fetchTrendingCrypto() {
    const fetchId = ++currentTrendingFetchId;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const response = await fetch('https://api.coingecko.com/api/v3/search/trending', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`Trending API error: ${response.status}`);
        const data = await response.json();

        if (fetchId !== currentTrendingFetchId) return;

        if (data && data.coins) {
            currentTrendingData = data;
            scheduleTrendingRender();
        }
    } catch (error) {
        if (error.name !== 'AbortError' && fetchId === currentTrendingFetchId) {
            console.error('Trending fetch error:', error);
        }
    }
}

// ---------- LIVE REFRESH EVERY 1 SECOND ----------
let marketInterval = null;
let trendingInterval = null;

function startLiveUpdates() {
    if (marketInterval) clearInterval(marketInterval);
    if (trendingInterval) clearInterval(trendingInterval);

    loadPage(currentPage);
    fetchTrendingCrypto();

    marketInterval = setInterval(() => {
        fetchCryptoPage(currentPage);
    }, 1000);

    trendingInterval = setInterval(() => {
        fetchTrendingCrypto();
    }, 1000);
}

function handleVisibilityChange() {
    if (document.hidden) {
        if (marketInterval) clearInterval(marketInterval);
        if (trendingInterval) clearInterval(trendingInterval);
    } else {
        if (marketInterval) clearInterval(marketInterval);
        if (trendingInterval) clearInterval(trendingInterval);
        marketInterval = setInterval(() => fetchCryptoPage(currentPage), 1000);
        trendingInterval = setInterval(() => fetchTrendingCrypto(), 1000);
        fetchCryptoPage(currentPage);
        fetchTrendingCrypto();
    }
}

document.addEventListener('visibilitychange', handleVisibilityChange);

window.addEventListener('beforeunload', () => {
    if (marketInterval) clearInterval(marketInterval);
    if (trendingInterval) clearInterval(trendingInterval);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
});

// ---------- PAGINATION EVENT LISTENERS (prev/next) ----------
prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        loadPage(currentPage - 1);
    }
});
nextBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
        loadPage(currentPage + 1);
    }
});

// ---------- START ----------
window.onload = () => {
    startLiveUpdates();
};

// preload image
const preloadImages = ['https://cryptologos.cc/logos/bitcoin-btc-logo.png'];
preloadImages.forEach(src => {
    const img = new Image();
    img.src = src;
});
