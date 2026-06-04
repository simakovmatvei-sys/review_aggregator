document.addEventListener('DOMContentLoaded', () => {
    let allReviews = [];
    let filteredReviews = [];

    // Elements
    const searchInput = document.getElementById('search-input');
    const filterSource = document.getElementById('filter-source');
    const filterRating = document.getElementById('filter-rating');
    const btnReset = document.getElementById('btn-reset');
    const reviewsFeed = document.getElementById('reviews-feed');
    const themeBtn = document.getElementById('theme-btn');
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');

    // Metrics Elements
    const totalCountEl = document.getElementById('metric-total-count');
    const avgRatingEl = document.getElementById('metric-avg-rating');
    const sourceBreakdownEl = document.getElementById('metric-source-breakdown');

    // Initialize theme from local storage
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeUI(currentTheme);

    // Theme switch logic
    themeBtn.addEventListener('click', () => {
        const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        updateThemeUI(theme);
        if (typeof updateChartsTheme === 'function') {
            updateChartsTheme(filteredReviews);
        }
    });

    function updateThemeUI(theme) {
        if (theme === 'dark') {
            themeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M16.242 16.242a6 6 0 11-8.485-8.485 6 6 0 018.485 8.485z" />`;
            themeText.textContent = 'Светлая тема';
        } else {
            themeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />`;
            themeText.textContent = 'Темная тема';
        }
    }

    // Fetch review data
    fetch('js/data.json')
        .then(response => response.json())
        .then(data => {
            allReviews = data;
            filteredReviews = [...allReviews];
            updateDashboard();
        })
        .catch(err => {
            console.error('Ошибка загрузки базы отзывов:', err);
            reviewsFeed.innerHTML = `<div class="error-msg" style="padding: 2rem; text-align: center; color: var(--danger);">Не удалось загрузить базу данных отзывов.</div>`;
        });

    // Filtering logic
    function applyFilters() {
        const searchVal = searchInput.value.toLowerCase().trim();
        const sourceVal = filterSource.value;
        const ratingVal = filterRating.value;

        filteredReviews = allReviews.filter(review => {
            // Search text filter
            const matchesSearch = !searchVal || 
                review.author.toLowerCase().includes(searchVal) ||
                (review.title && review.title.toLowerCase().includes(searchVal)) ||
                review.text.toLowerCase().includes(searchVal) ||
                (review.pros && review.pros.toLowerCase().includes(searchVal)) ||
                (review.cons && review.cons.toLowerCase().includes(searchVal));

            // Source filter
            const matchesSource = !sourceVal || review.source === sourceVal;

            // Rating filter
            let matchesRating = true;
            if (ratingVal) {
                if (review.rating === null) {
                    matchesRating = false; // Discussions have null rating
                } else if (ratingVal === 'positive') {
                    matchesRating = review.rating >= 4;
                } else if (ratingVal === 'neutral') {
                    matchesRating = review.rating === 3;
                } else if (ratingVal === 'negative') {
                    matchesRating = review.rating <= 2;
                }
            }

            return matchesSearch && matchesSource && matchesRating;
        });

        updateDashboard(false); // Update list and metrics, do not fetch again
    }

    // Event listeners for filters
    searchInput.addEventListener('input', applyFilters);
    filterSource.addEventListener('change', applyFilters);
    filterRating.addEventListener('change', applyFilters);

    btnReset.addEventListener('click', () => {
        searchInput.value = '';
        filterSource.value = '';
        filterRating.value = '';
        filteredReviews = [...allReviews];
        updateDashboard();
    });

    // Update everything on dashboard
    function updateDashboard(updateCharts = true) {
        renderReviews();
        calculateMetrics();
        if (updateCharts && typeof initCharts === 'function') {
            initCharts(filteredReviews);
        } else if (typeof updateChartsTheme === 'function') {
            updateChartsTheme(filteredReviews);
        }
    }

    function calculateMetrics() {
        totalCountEl.textContent = filteredReviews.length;

        // Calculate average rating (excluding null ratings like discussions)
        const reviewsWithRating = filteredReviews.filter(r => r.rating !== null && r.rating !== undefined);
        if (reviewsWithRating.length > 0) {
            const sum = reviewsWithRating.reduce((acc, r) => acc + r.rating, 0);
            const avg = (sum / reviewsWithRating.length).toFixed(1);
            
            // Build stars string
            let stars = '';
            const fullStars = Math.floor(avg);
            for (let i = 0; i < 5; i++) {
                stars += i < fullStars ? '★' : '☆';
            }
            
            avgRatingEl.innerHTML = `${avg} <span class="rating-stars" style="font-size: 1.15rem; margin-left: 0.25rem;">${stars}</span>`;
        } else {
            avgRatingEl.textContent = '—';
        }

        // Source count labels
        const sourceCounts = { 'a2is.ru': 0, 'crmindex.ru': 0, 'productradar.ru': 0, 'yandex.ru': 0, '2gis.ru': 0, 'google.com': 0 };
        filteredReviews.forEach(r => {
            if (sourceCounts[r.source] !== undefined) {
                sourceCounts[r.source]++;
            }
        });

        sourceBreakdownEl.innerHTML = `
            <div class="source-breakdown-item">
                <span class="source-breakdown-name" style="color: var(--source-a2is);">a2is</span>
                <span class="source-breakdown-val">${sourceCounts['a2is.ru']}</span>
            </div>
            <div class="source-breakdown-item">
                <span class="source-breakdown-name" style="color: var(--source-crmindex);">crm</span>
                <span class="source-breakdown-val">${sourceCounts['crmindex.ru']}</span>
            </div>
            <div class="source-breakdown-item">
                <span class="source-breakdown-name" style="color: var(--source-productradar);">radar</span>
                <span class="source-breakdown-val">${sourceCounts['productradar.ru']}</span>
            </div>
            <div class="source-breakdown-item">
                <span class="source-breakdown-name" style="color: var(--source-yandex);">yandex</span>
                <span class="source-breakdown-val">${sourceCounts['yandex.ru']}</span>
            </div>
            <div class="source-breakdown-item">
                <span class="source-breakdown-name" style="color: var(--source-2gis);">2gis</span>
                <span class="source-breakdown-val">${sourceCounts['2gis.ru']}</span>
            </div>
            <div class="source-breakdown-item">
                <span class="source-breakdown-name" style="color: var(--source-google);">google</span>
                <span class="source-breakdown-val">${sourceCounts['google.com']}</span>
            </div>
        `;
    }

    function renderReviews() {
        if (filteredReviews.length === 0) {
            reviewsFeed.innerHTML = `
                <div style="background-color: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 3rem; text-align: center; color: var(--text-secondary); box-shadow: var(--shadow-sm);">
                    <svg style="width: 48px; height: 48px; color: var(--text-muted); margin-bottom: 1rem;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3>Отзывы не найдены</h3>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem;">Попробуйте изменить параметры фильтрации или поисковый запрос</p>
                </div>
            `;
            return;
        }

        reviewsFeed.innerHTML = filteredReviews.map(review => {
            // Build star visualization for overall review rating
            let ratingHTML = '';
            if (review.rating !== null && review.rating !== undefined) {
                let stars = '';
                for (let i = 1; i <= 5; i++) {
                    stars += i <= review.rating ? '★' : '☆';
                }
                ratingHTML = `<span class="rating-stars">${stars}</span>`;
            } else if (review.isFounder) {
                ratingHTML = `<span class="founder-badge">Основатель</span>`;
            } else {
                ratingHTML = `<span class="founder-badge" style="background-color: var(--bg-tertiary); color: var(--text-secondary);">Обсуждение</span>`;
            }

            // Sub aspects (only if any score is available)
            const hasAspects = review.convenience || review.support || review.functions || review.price;
            let aspectsHTML = '';
            if (hasAspects) {
                aspectsHTML = `<div class="review-aspects">`;
                if (review.convenience) {
                    aspectsHTML += `
                        <div class="aspect-item">
                            <span class="aspect-label">Удобство:</span>
                            <span class="aspect-value">${review.convenience} ★</span>
                        </div>
                    `;
                }
                if (review.support) {
                    aspectsHTML += `
                        <div class="aspect-item">
                            <span class="aspect-label">Поддержка:</span>
                            <span class="aspect-value">${review.support} ★</span>
                        </div>
                    `;
                }
                if (review.functions) {
                    aspectsHTML += `
                        <div class="aspect-item">
                            <span class="aspect-label">Функции:</span>
                            <span class="aspect-value">${review.functions} ★</span>
                        </div>
                    `;
                }
                if (review.price) {
                    aspectsHTML += `
                        <div class="aspect-item">
                            <span class="aspect-label">Цена:</span>
                            <span class="aspect-value">${review.price} ★</span>
                        </div>
                    `;
                }
                aspectsHTML += `</div>`;
            }

            // Pros and Cons section
            let prosConsHTML = '';
            if (review.pros || review.cons) {
                prosConsHTML = `
                    <div class="pros-cons">
                        ${review.pros ? `
                            <div class="pro-box">
                                <h5>
                                    <svg style="width:16px;height:16px;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
                                    Плюсы
                                </h5>
                                <p>${review.pros}</p>
                            </div>
                        ` : ''}
                        ${review.cons ? `
                            <div class="con-box">
                                <h5>
                                    <svg style="width:16px;height:16px;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                    Минусы
                                </h5>
                                <p>${review.cons}</p>
                            </div>
                        ` : ''}
                    </div>
                `;
            }

            // Badge color helper
            let sourceClass = 'badge-a2is';
            let tagClass = 'tag-a2is';
            if (review.source === 'crmindex.ru') {
                sourceClass = 'badge-crmindex';
                tagClass = 'tag-crmindex';
            } else if (review.source === 'productradar.ru') {
                sourceClass = 'badge-productradar';
                tagClass = 'tag-productradar';
            } else if (review.source === 'yandex.ru') {
                sourceClass = 'badge-yandex';
                tagClass = 'tag-yandex';
            } else if (review.source === '2gis.ru') {
                sourceClass = 'badge-2gis';
                tagClass = 'tag-2gis';
            } else if (review.source === 'google.com') {
                sourceClass = 'badge-google';
                tagClass = 'tag-google';
            }

            // Format date nicely
            let formattedDate = review.date;
            try {
                if (review.date.includes('-')) {
                    const parts = review.date.split('-');
                    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
                    formattedDate = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
                }
            } catch (e) {
                console.warn(e);
            }

            return `
                <div class="review-card">
                    <div class="review-badge ${sourceClass}"></div>
                    <div class="review-header">
                        <div class="author-info">
                            <div class="author-avatar">${review.author[0].toUpperCase()}</div>
                            <div class="author-meta">
                                <h4>${review.author}</h4>
                                <a href="${review.url}" class="source-link" target="_blank">
                                    <span class="source-tag ${tagClass}">${review.source}</span>
                                </a>
                            </div>
                        </div>
                        <div class="review-rating-date">
                            ${ratingHTML}
                            <span class="review-date">${formattedDate}</span>
                        </div>
                    </div>
                    
                    <div class="review-body">
                        ${review.title ? `<div class="review-title">«${review.title}»</div>` : ''}
                        <p class="review-text">${review.text}</p>
                    </div>

                    ${aspectsHTML}
                    ${prosConsHTML}
                </div>
            `;
        }).join('');
    }
});
