let ratingChart = null;
let sourceChart = null;

function initCharts(reviews) {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js is not loaded. Cannot render charts.');
        return;
    }

    renderRatingDistribution(reviews);
    renderSourceDistribution(reviews);
}

function renderRatingDistribution(reviews) {
    const ctx = document.getElementById('ratingDistributionChart').getContext('2d');
    
    // Count ratings (only non-null)
    const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => {
        if (r.rating !== null && r.rating !== undefined) {
            const rounded = Math.round(r.rating);
            if (ratingCounts[rounded] !== undefined) {
                ratingCounts[rounded]++;
            }
        }
    });

    const data = [ratingCounts[1], ratingCounts[2], ratingCounts[3], ratingCounts[4], ratingCounts[5]];
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? '#2d3748' : '#e2e8f0';

    if (ratingChart) {
        ratingChart.destroy();
    }

    ratingChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['1 ★', '2 ★', '3 ★', '4 ★', '5 ★'],
            datasets: [{
                label: 'Количество отзывов',
                data: data,
                backgroundColor: [
                    '#ef4444',
                    '#f59e0b',
                    '#3b82f6',
                    '#6366f1',
                    '#10b981'
                ],
                borderRadius: 4,
                borderWidth: 0
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        color: textColor,
                        stepSize: 1
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: textColor
                    }
                }
            }
        }
    });
}

function renderSourceDistribution(reviews) {
    const ctx = document.getElementById('sourceDistributionChart').getContext('2d');
    
    const sourceCounts = {
        'a2is.ru': 0,
        'crmindex.ru': 0,
        'productradar.ru': 0,
        'yandex.ru': 0,
        '2gis.ru': 0,
        'google.com': 0
    };

    reviews.forEach(r => {
        if (sourceCounts[r.source] !== undefined) {
            sourceCounts[r.source]++;
        }
    });

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#475569';

    if (sourceChart) {
        sourceChart.destroy();
    }

    sourceChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['a2is.ru', 'crmindex.ru', 'productradar.ru', 'Yandex Maps', '2GIS', 'Google Maps'],
            datasets: [{
                data: [
                    sourceCounts['a2is.ru'], 
                    sourceCounts['crmindex.ru'], 
                    sourceCounts['productradar.ru'],
                    sourceCounts['yandex.ru'],
                    sourceCounts['2gis.ru'],
                    sourceCounts['google.com']
                ],
                backgroundColor: [
                    '#3b82f6',
                    '#10b981',
                    '#8b5cf6',
                    '#fc3f1d',
                    '#2ca300',
                    '#4285f4'
                ],
                borderWidth: isDark ? 2 : 1,
                borderColor: isDark ? '#111827' : '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: textColor,
                        boxWidth: 12,
                        padding: 15,
                        font: {
                            family: 'Inter',
                            size: 11
                        }
                    }
                }
            },
            cutout: '70%'
        }
    });
}

// Update charts when theme changes
window.updateChartsTheme = function(reviews) {
    if (ratingChart && sourceChart) {
        renderRatingDistribution(reviews);
        renderSourceDistribution(reviews);
    }
};
