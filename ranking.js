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
let previousPageData = {}; // Track previous data for smart updates
let pendingPageRequests = {}; // Track in-flight requests

// LocalStorage for instant load
const CACHE_KEY = 'cryptoCache';
const CACHE_EXPIRY_KEY = 'cryptoCacheExpiry';
const CACHE_DURATION = 300000; // 5 minutes (was 60s) - reduces redundant API calls

function loadFromStorage() {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);
        if (cached && expiry && Date.now() < parseInt(expiry)) {
            cryptoPageCache = JSON.parse(cached);
            return true;
        }
    } catch (e) {
        console.warn('Storage load failed:', e);
    }
    return false;
}

function saveToStorage() {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cryptoPageCache));
        localStorage.setItem(CACHE_EXPIRY_KEY, Date.now() + CACHE_DURATION);
    } catch (e) {
        console.warn('Storage save failed:', e);
    }
}

// ---------- PAGINATION STATE ----------
const ITEMS_PER_PAGE = 50; // Reduced from 100 for faster initial load
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
    if (!cryptoPageCache[page] && !pendingPageRequests[page]) {
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
    const rows = tableBody.querySelectorAll('tr');
    
    // Smart update: Only update changed prices, reuse existing rows if possible
    if (rows.length === pageItems.length) {
        // Update existing rows with new data
        for (let i = 0; i < pageItems.length; i++) {
            const crypto = pageItems[i];
            const prevCrypto = previousPageData[i];
            
            // Only update if data changed
            if (!prevCrypto || 
                prevCrypto.current_price !== crypto.current_price ||
                prevCrypto.price_change_percentage_24h !== crypto.price_change_percentage_24h ||
                prevCrypto.market_cap !== crypto.market_cap) {
                
                const price = crypto.current_price ?? 0;
                const change = crypto.price_change_percentage_24h ?? 0;
                const marketCap = crypto.market_cap ?? 0;
                
                rows[i].cells[2].textContent = formatMarketCap(marketCap);
                rows[i].cells[3].textContent = formatPrice(price);
                
                const changeClass = change >= 0 ? 'green' : 'red';
                const changeText = formatChange(change);
                rows[i].cells[4].innerHTML = `<span class="${changeClass}">${changeText}</span>`;
            }
        }
        previousPageData = pageItems.map(c => ({...c}));
        return;
    }
    
    // Full re-render only if row count changed
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
        nameCell.innerHTML = `<img src="${imageUrl}" class="crypto-logo" alt="${name}" loading="lazy" onerror="this.src='https://cryptologos.cc/logos/bitcoin-btc-logo.png'"> ${name} (${symbol})`;

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
    previousPageData = pageItems.map(c => ({...c}));
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

    // Skip if already fetching this page (deduplication)
    if (pendingPageRequests[page]) return;

    const fetchId = ++currentMarketFetchId;
    pendingPageRequests[page] = true;
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch(
            `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${ITEMS_PER_PAGE}&page=${page}&sparkline=false&price_change_percentage=24h`,
            { 
                signal: controller.signal,
                headers: { 'Accept-Encoding': 'gzip, deflate' }
            }
        );
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const data = await response.json();

        if (fetchId !== currentMarketFetchId) return;

        if (data && Array.isArray(data) && data.length > 0) {
            cryptoPageCache[page] = data;
            saveToStorage();
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
    } finally {
        delete pendingPageRequests[page];
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

// ---------- LIVE REFRESH (OPTIMIZED: 5 SECONDS) ----------
let marketInterval = null;
let // Don't preload adjacent pages - only fetch on demand to reduce API calls
    if (marketInterval) clearInterval(marketInterval);
    if (trendingInterval) clearInterval(trendingInterval);

    loadPage(currentPage);
    fetchTrendingCrypto();

    // Reduced refresh rates: 15s for market (was 5s), 30s for trending (was 8s)
    marketInterval = setInterval(() => {
        fetchCryptoPage(currentPage);
    }, 15000);

    trendingInterval = setInterval(() => {
        fetchTrendingCrypto();
    }, 30
    trendingInterval = setInterval(() => {
        fetchTrendingCrypto();
    }, 8000);
}

function handleVisibilityChange() {
    if (document.hidden) {
        if (marketInterval) clearInterval(marketInterval);
        if (trendingInterval) clearInterval(trendingInterval);
    } else {
        if (marketInterval) clearInterval(marketInterval);
        if (trendingInterval) clearInterval(trendingInterval);15000);
        trendingInterval = setInterval(() => fetchTrendingCrypto(), 30e), 5000);
        trendingInterval = setInterval(() => fetchTrendingCrypto(), 8000);
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
if (prevBtn) prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        loadPage(currentPage - 1);
    }
});

if (nextBtn) nextBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
        loadPage(currentPage + 1);
    }
});

// Load cached data first for instant display
if (loadFromStorage()) {
    currentPageData = cryptoPageCache[1] || [];
    renderTable();
}

// ---------- START ----------
window.onload = () => {
    // Attach pagination event listener once on page load
    if (pageNumbersSpan) {
        pageNumbersSpan.addEventListener('click', (e) => {
            if (e.target.classList.contains('page-number')) {
                const pageNum = parseInt(e.target.dataset.page, 10);
                if (!isNaN(pageNum) && pageNum !== currentPage && pageNum >= 1 && pageNum <= totalPages) {
                    loadPage(pageNum);
                }
            }
        });
    }
    
    // Parallel preload: fetch pages 1-3 simultaneously for faster initial display
    if (!cryptoPageCache[1]) fetchCryptoPage(1);
    if (!cryptoPageCache[2]) fetchCryptoPage(2);
    if (!cryptoPageCache[3]) fetchCryptoPage(3);
    
    fetchTrendingCrypto();
    
    // Start regular updates after initial preload
    setTimeout(() => startLiveUpdates(), 1000);
};

// preload critical image
const preloadImages = ['https://cryptologos.cc/logos/bitcoin-btc-logo.png'];
preloadImages.forEach(src => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);
});
