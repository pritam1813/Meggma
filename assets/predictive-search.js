/**
 * Predictive Search JavaScript
 * Handles search overlay interactions and Shopify Predictive Search API
 */

(function () {
  // DOM Elements
  const openBtn = document.getElementById('open-search-btn');
  const closeBtn = document.getElementById('close-search-btn');
  const searchOverlay = document.getElementById('search-overlay');
  const searchInput = document.getElementById('predictive-search-input');
  const resultsContainer = document.getElementById('search-results-container');
  const backdrop = document.getElementById('search-backdrop');
  const loadingSpinner = document.getElementById('search-loading');
  const resultsCount = document.getElementById('search-results-count');
  const notFoundState = document.getElementById('search-not-found');
  const searchFooter = document.getElementById('search-footer');
  const viewAllLink = document.getElementById('view-all-results');

  // Sections
  const productsSection = document.getElementById('search-products-section');
  const productsGrid = document.getElementById('search-products-grid');
  const collectionsSection = document.getElementById('search-collections-section');
  const collectionsGrid = document.getElementById('search-collections-grid');
  const articlesSection = document.getElementById('search-articles-section');
  const articlesGrid = document.getElementById('search-articles-grid');

  // Config
  const config = window.shopifyPredictiveSearch || {};
  const predictiveSearchUrl = config.url || '/search/suggest';
  const searchUrl = config.searchUrl || '/search';
  const moneyFormat = config.moneyFormat || '${{amount}}';

  // State
  let debounceTimer = null;
  let abortController = null;

  // --- UTILITY FUNCTIONS ---

  function formatMoney(cents) {
    if (typeof cents === 'string') {
      cents = parseInt(cents.replace(/[^0-9]/g, ''), 10);
    }
    const amount = (cents / 100).toFixed(2);
    return moneyFormat.replace('{{amount}}', amount).replace('{{amount_no_decimals}}', Math.floor(cents / 100));
  }

  function debounce(func, wait) {
    return function executedFunction(...args) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // --- SEARCH FUNCTIONS ---

  function openSearch() {
    if (!searchOverlay) return;

    // Show Search Bar
    searchOverlay.classList.remove('-translate-y-full', 'opacity-0', 'invisible');
    searchOverlay.classList.add('translate-y-0', 'opacity-100', 'visible');

    // Show Backdrop
    backdrop.classList.remove('opacity-0', 'pointer-events-none');
    backdrop.classList.add('opacity-100', 'pointer-events-auto');

    // Prevent body scroll
    document.body.classList.add('overflow-hidden');

    // Focus Input
    setTimeout(() => searchInput?.focus(), 100);
  }

  function closeSearch() {
    if (!searchOverlay) return;

    // Hide Search Bar
    searchOverlay.classList.remove('translate-y-0', 'opacity-100', 'visible');
    searchOverlay.classList.add('-translate-y-full', 'opacity-0', 'invisible');

    // Hide Results
    closeResults();

    // Hide Backdrop
    backdrop.classList.remove('opacity-100', 'pointer-events-auto');
    backdrop.classList.add('opacity-0', 'pointer-events-none');

    // Re-enable body scroll
    document.body.classList.remove('overflow-hidden');

    // Reset Input
    if (searchInput) searchInput.value = '';

    // Abort any pending requests
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  }

  function openResults() {
    if (!resultsContainer) return;
    resultsContainer.classList.remove('max-h-0', 'opacity-0');
    resultsContainer.classList.add('max-h-[70vh]', 'opacity-100');
  }

  function closeResults() {
    if (!resultsContainer) return;
    resultsContainer.classList.remove('max-h-[70vh]', 'opacity-100');
    resultsContainer.classList.add('max-h-0', 'opacity-0');
  }

  function showLoading(show) {
    if (loadingSpinner) {
      loadingSpinner.classList.toggle('hidden', !show);
    }
  }

  function clearResults() {
    if (productsGrid) productsGrid.innerHTML = '';
    if (collectionsGrid) collectionsGrid.innerHTML = '';
    if (articlesGrid) articlesGrid.innerHTML = '';

    productsSection?.classList.add('hidden');
    collectionsSection?.classList.add('hidden');
    articlesSection?.classList.add('hidden');
    notFoundState?.classList.add('hidden');
    resultsCount?.classList.add('hidden');
    searchFooter?.classList.add('hidden');
  }

  // --- RENDER FUNCTIONS ---

  function renderProductCard(product) {
    const image = product.image || product.featured_image?.url || '';
    const imageAlt = product.featured_image?.alt || product.title;
    const price = formatMoney(product.price);
    const comparePrice = product.compare_at_price_min > product.price ? formatMoney(product.compare_at_price_min) : '';

    return `
      <a href="${product.url}" class="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group">
        <div class="w-16 h-16 rounded-md overflow-hidden border border-gray-200 flex-shrink-0 bg-gray-100">
          ${image ? `<img src="${image}" alt="${imageAlt}" class="w-full h-full object-contain" loading="lazy">` : `<div class="w-full h-full flex items-center justify-center text-gray-300"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>`}
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-medium text-gray-900 group-hover:text-black transition-colors truncate">${product.title}</h4>
          <p class="text-sm text-gray-500 truncate">${product.type || ''}</p>
          <div class="flex items-center gap-2">
            <span class="text-black font-bold text-sm">${price}</span>
            ${comparePrice ? `<span class="text-gray-400 line-through text-xs">${comparePrice}</span>` : ''}
          </div>
        </div>
      </a>
    `;
  }

  function renderCollectionCard(collection) {
    const image = collection.featured_image?.url || '';

    return `
      <a href="${collection.url}" class="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group">
        <div class="w-16 h-16 rounded-md overflow-hidden border border-gray-200 flex-shrink-0 bg-gray-100">
          ${image ? `<img src="${image}" alt="${collection.title}" class="w-full h-full object-contain" loading="lazy">` : `<div class="w-full h-full flex items-center justify-center text-gray-300"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg></div>`}
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-medium text-gray-900 group-hover:text-black transition-colors truncate">${collection.title}</h4>
        </div>
      </a>
    `;
  }

  function renderArticleCard(article) {
    const image = article.image || article.featured_image?.url || '';

    return `
      <a href="${article.url}" class="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group">
        <div class="w-16 h-16 rounded-md overflow-hidden border border-gray-200 flex-shrink-0 bg-gray-100">
          ${image ? `<img src="${image}" alt="${article.title}" class="w-full h-full object-contain" loading="lazy">` : `<div class="w-full h-full flex items-center justify-center text-gray-300"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg></div>`}
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-medium text-gray-900 group-hover:text-black transition-colors truncate">${article.title}</h4>
          <p class="text-sm text-gray-500 truncate">${article.author || ''}</p>
        </div>
      </a>
    `;
  }

  function renderResults(data) {
    clearResults();

    const resources = data.resources?.results || {};
    const products = resources.products || [];
    const collections = resources.collections || [];
    const articles = resources.articles || [];

    const totalResults = products.length + collections.length + articles.length;

    if (totalResults === 0) {
      notFoundState?.classList.remove('hidden');
      openResults();
      return;
    }

    // Update results count
    if (resultsCount) {
      resultsCount.textContent = `${totalResults} result${totalResults !== 1 ? 's' : ''} found`;
      resultsCount.classList.remove('hidden');
    }

    // Render Products
    if (products.length > 0 && productsGrid && productsSection) {
      productsGrid.innerHTML = products.map(renderProductCard).join('');
      productsSection.classList.remove('hidden');
    }

    // Render Collections
    if (collections.length > 0 && collectionsGrid && collectionsSection) {
      collectionsGrid.innerHTML = collections.map(renderCollectionCard).join('');
      collectionsSection.classList.remove('hidden');
    }

    // Render Articles
    if (articles.length > 0 && articlesGrid && articlesSection) {
      articlesGrid.innerHTML = articles.map(renderArticleCard).join('');
      articlesSection.classList.remove('hidden');
    }

    // Show footer
    searchFooter?.classList.remove('hidden');

    // Update view all link
    if (viewAllLink && searchInput) {
      viewAllLink.href = `${searchUrl}?q=${encodeURIComponent(searchInput.value)}`;
    }

    openResults();
  }

  // --- API CALL ---

  async function fetchPredictiveSearch(query) {
    // Abort previous request
    if (abortController) {
      abortController.abort();
    }

    abortController = new AbortController();
    showLoading(true);

    try {
      const url = `${predictiveSearchUrl}?q=${encodeURIComponent(query)}&resources[type]=product,collection,article&resources[limit]=6&resources[options][unavailable_products]=hide`;

      const response = await fetch(url, {
        signal: abortController.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      renderResults(data);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Predictive search error:', error);
        clearResults();
        notFoundState?.classList.remove('hidden');
        openResults();
      }
    } finally {
      showLoading(false);
    }
  }

  const debouncedSearch = debounce((query) => {
    if (query.length >= 2) {
      fetchPredictiveSearch(query);
    }
  }, 300);

  // --- EVENT LISTENERS ---

  // Open Search
  openBtn?.addEventListener('click', openSearch);

  // Close Search
  closeBtn?.addEventListener('click', closeSearch);
  backdrop?.addEventListener('click', closeSearch);

  // Search Input
  searchInput?.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    if (query.length === 0) {
      clearResults();
      closeResults();
      return;
    }

    if (query.length < 2) {
      return;
    }

    debouncedSearch(query);
  });

  // Form submission (Enter key)
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = e.target.value.trim();
      if (query.length > 0) {
        window.location.href = `${searchUrl}?q=${encodeURIComponent(query)}`;
      }
    }
  });

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // ESC to close
    if (e.key === 'Escape') {
      closeSearch();
    }

    // Ctrl/Cmd + K to open search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (searchOverlay?.classList.contains('invisible')) {
        openSearch();
      } else {
        closeSearch();
      }
    }
  });
})();
