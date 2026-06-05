const fs = require('fs');
const path = require('path');
const https = require('https');

// Target URLs to scrape
const URLS = {
    a2is: "https://a2is.ru/catalog/programmy-dlya-kurerskikh-sluzhb/flang-delivery?utm_from=search",
    crmindex: "https://crmindex.ru/products/flang/reviews",
    productradar: "https://productradar.ru/product/flang-delivery/#subscribe-telegram"
};

// Helper function to perform HTTP request
function getHTML(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        }, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP status ${res.statusCode}`));
                return;
            }
            res.setEncoding('utf8');
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => { resolve(data); });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

// Convert Russian date from CRMindex to YYYY-MM-DD
function parseCrmindexDate(dateStr) {
    try {
        const cleaned = dateStr.replace(/ г\./, '').trim();
        const parts = cleaned.split(/\s+/);
        if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const year = parts[2];
            const months = {
                'янв.': '01', 'февр.': '02', 'март.': '03', 'апр.': '04',
                'май': '05', 'июн.': '06', 'июл.': '07', 'авг.': '08',
                'сент.': '09', 'окт.': '10', 'нояб.': '11', 'дек.': '12',
                'янв': '01', 'фев': '02', 'мар': '03', 'июн': '06', 'июл': '07',
                'авг': '08', 'сен': '09', 'окт': '10', 'ноя': '11', 'дек': '12'
            };
            const monthStr = parts[1].toLowerCase().substring(0, 4);
            let month = '01';
            for (let m in months) {
                if (monthStr.startsWith(m)) {
                    month = months[m];
                    break;
                }
            }
            return `${year}-${month}-${day}`;
        }
    } catch (e) {
        console.warn('Ошибка парсинга даты CRMindex:', dateStr, e.message);
    }
    return new Date().toISOString().split('T')[0];
}

// Clean HTML tags and entities
function cleanHTML(str) {
    if (!str) return '';
    return str
        .replace(/<\/?[^>]+(>|$)/g, "")
        .replace(/&#8211;/g, "-")
        .replace(/&nbsp;/g, " ")
        .trim();
}

// Normalize name to handle homoglyphs and spacing differences
function normalizeName(s) {
    if (!s) return '';
    const map = {
        'a': 'а', 'b': 'в', 'c': 'с', 'e': 'е', 'h': 'н', 'k': 'к', 'm': 'м', 'o': 'о', 'p': 'р', 't': 'т', 'x': 'х', 'y': 'у'
    };
    return s.toLowerCase()
        .split('')
        .map(char => map[char] || char)
        .join('')
        .replace(/[^a-zа-я0-9]/g, '');
}

async function runScraper() {
    console.log('Запуск парсинга отзывов Flang Delivery...');
    
    const dbPath = path.join(__dirname, '../js/data.json');
    let existingReviews = [];
    
    // Load existing database to keep Google Maps ratings and fallback dates
    try {
        if (fs.existsSync(dbPath)) {
            existingReviews = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            console.log(`Загружена существующая база отзывов (${existingReviews.length} записей)`);
        }
    } catch (e) {
        console.error('Не удалось прочитать существующую базу отзывов:', e.message);
    }

    // Keep Google Maps ratings
    const googleRatings = existingReviews.filter(r => r.source === 'google.com');
    console.log(`Сохранено ${googleRatings.length} реальных оценок с Google Maps`);

    const newReviews = [];

    // 1. Parse a2is.ru
    try {
        console.log('Загрузка a2is.ru...');
        const html = await getHTML(URLS.a2is);
        console.log('-> a2is.ru успешно загружен. Выполняется парсинг...');

        // Restrict html content to only include the main reviews block
        const commentsSectionMatch = html.match(/(?:reviews_product|Flang Delivery Отзывы)[\s\S]*?Отзывы похожих программ/);
        const commentsHtml = commentsSectionMatch ? commentsSectionMatch[0] : html;

        const comments = [];
        const parts = commentsHtml.split('<div class="comment">');
        
        for (let i = 1; i < parts.length; i++) {
            const block = parts[i];
            
            const authorMatch = block.match(/<div class="name">([^<]+)<\/div>/);
            const author = authorMatch ? cleanHTML(authorMatch[1]) : '';
            
            const titleMatch = block.match(/<p class="quote">«?([^»]+)»?<\/p>/);
            const title = titleMatch ? cleanHTML(titleMatch[1]) : '';
            
            const prosMatch = block.match(/<p class="titl">Плюсы:<\/p>\s*<p>([\s\S]*?)<\/p>/);
            const pros = prosMatch ? cleanHTML(prosMatch[1]) : '';
            
            const consMatch = block.match(/<p class="titl">Минусы:<\/p>\s*<p>([\s\S]*?)<\/p>/);
            const cons = consMatch ? cleanHTML(consMatch[1]) : '';
            
            const textMatch = block.match(/<p class="titl">В целом:<\/p>\s*<p>([\s\S]*?)<\/p>/);
            const text = textMatch ? cleanHTML(textMatch[1]) : '';

            // Dynamic ratings
            const ratings = {};
            const rtBlRegex = /<div class="rt_bl">([\s\S]*?)<\/div>\s*<p>([^<]+)<\/p>\s*<\/div>/g;
            let rtMatch;
            while ((rtMatch = rtBlRegex.exec(block)) !== null) {
                const rtContent = rtMatch[1];
                const category = rtMatch[2].trim();
                const fullStars = (rtContent.match(/class=['"]full['"]/g) || []).length;
                ratings[category] = fullStars;
            }

            const overallMatch = block.match(/<div class="rating_num">(\d+)<\/div>/);
            const overallRating = overallMatch ? parseInt(overallMatch[1], 10) : 5;

            if (author) {
                comments.push({
                    author,
                    title,
                    pros,
                    cons,
                    text,
                    rating: overallRating,
                    convenience: ratings["Удобство"] || 5,
                    support: ratings["Служба поддержки"] || 5,
                    functions: ratings["Функции"] || 5,
                    source: "a2is.ru",
                    url: URLS.a2is
                });
            }
        }

        if (comments.length > 0) {
            const sourceExisting = existingReviews.filter(r => r.source === 'a2is.ru');
            comments.forEach((c, idx) => {
                c.id = `a2is-${idx + 1}`;
                
                const normAuthor = normalizeName(c.author);
                const existing = sourceExisting.find(r => normalizeName(r.author) === normAuthor);
                
                if (existing) {
                    c.title = c.title || existing.title;
                    c.pros = c.pros || existing.pros;
                    c.cons = c.cons || existing.cons;
                    c.text = c.text || existing.text;
                    c.date = existing.date;
                } else {
                    c.date = idx === 0 ? "2026-03-15" : "2026-02-10";
                }
                newReviews.push(c);
            });
            console.log(`-> a2is.ru: успешно спарсено ${comments.length} отзывов.`);
        } else {
            throw new Error("Не найдено отзывов в разметке A2IS");
        }
    } catch (e) {
        console.error('Ошибка при работе с a2is.ru:', e.message);
        const fallback = existingReviews.filter(r => r.source === 'a2is.ru');
        newReviews.push(...fallback);
        console.log(`-> a2is.ru: использован бэкап из ${fallback.length} отзывов.`);
    }

    // 2. Parse crmindex.ru
    try {
        console.log('Загрузка crmindex.ru...');
        const html = await getHTML(URLS.crmindex);
        console.log('-> crmindex.ru успешно загружен. Выполняется парсинг...');

        const comments = [];
        const parts = html.split('<div class="catalog-item-review-item"');
        
        for (let i = 1; i < parts.length; i++) {
            const block = parts[i];
            
            const authorMatch = block.match(/<div class="social-name"[^>]*>([^<]+)<\/div>/);
            const author = authorMatch ? cleanHTML(authorMatch[1]) : '';
            
            const titleMatch = block.match(/<div class="title"[^>]*>([\s\S]*?)<\/div>/);
            const title = titleMatch ? cleanHTML(titleMatch[1]) : '';
            
            const dateMatch = block.match(/<meta itemprop="datepublished" content="([^"]+)"\/>/) || block.match(/<meta itemprop="datepublished" content="([^"]+)"/);
            const date = dateMatch ? parseCrmindexDate(dateMatch[1]) : '';
            
            const prosMatch = block.match(/<div class="review-advantage">([\s\S]*?)<\/div>/);
            const pros = prosMatch ? cleanHTML(prosMatch[1]) : '';
            
            const consMatch = block.match(/<div class="review-disadvantage">([\s\S]*?)<\/div>/);
            const cons = consMatch ? cleanHTML(consMatch[1]) : '';
            
            const textMatch = block.match(/<div class="review-generally">([\s\S]*?)<\/div>/);
            const text = textMatch ? cleanHTML(textMatch[1]) : '';

            // Dynamic ratings
            const ratings = {};
            const ratingMatchRegex = /<div class="sub-title">\s*([^<]+?)\s*<\/div>[\s\S]*?<div class="gray text-center">\s*(\d)\s*\/\s*5\s*<\/div>/g;
            let ratingMatch;
            while ((ratingMatch = ratingMatchRegex.exec(block)) !== null) {
                const category = ratingMatch[1].trim();
                const score = parseInt(ratingMatch[2].trim(), 10);
                ratings[category] = score;
            }

            const overallRatingMatch = block.match(/Общий рейтинг<\/p>[\s\S]*?itemprop="ratingValue" content="(\d)"/);
            const overallRating = overallRatingMatch ? parseInt(overallRatingMatch[1], 10) : 5;

            if (author) {
                comments.push({
                    author,
                    title,
                    date,
                    rating: overallRating,
                    convenience: ratings["Удобство"] || 5,
                    support: ratings["Служба поддержки"] || 5,
                    functions: ratings["Функционал"] || 5,
                    price: ratings["Справедливость цены"] || 5,
                    pros,
                    cons,
                    text,
                    source: "crmindex.ru",
                    url: URLS.crmindex
                });
            }
        }

        if (comments.length > 0) {
            const sourceExisting = existingReviews.filter(r => r.source === 'crmindex.ru');
            comments.forEach((c, idx) => {
                c.id = `crmindex-${idx + 1}`;
                
                const normAuthor = normalizeName(c.author);
                const existing = sourceExisting.find(r => normalizeName(r.author) === normAuthor);
                
                if (existing) {
                    c.title = c.title || existing.title;
                    c.date = c.date || existing.date;
                    c.pros = c.pros || existing.pros;
                    c.cons = c.cons || existing.cons;
                    c.text = c.text || existing.text;
                }
                newReviews.push(c);
            });
            console.log(`-> crmindex.ru: успешно спарсено ${comments.length} отзывов.`);
        } else {
            throw new Error("Не найдено отзывов в разметке CRMindex");
        }
    } catch (e) {
        console.error('Ошибка при работе с crmindex.ru:', e.message);
        const fallback = existingReviews.filter(r => r.source === 'crmindex.ru');
        newReviews.push(...fallback);
        console.log(`-> crmindex.ru: использован бэкап из ${fallback.length} отзывов.`);
    }

    try {
        console.log('Загрузка productradar.ru...');
        const html = await getHTML(URLS.productradar);
        console.log('-> productradar.ru успешно загружен. Выполняется парсинг...');

        // Restrict html content to only include the comments block
        const commentsSectionMatch = html.match(/id=['"]wpdcom['"]([\s\S]*?)Получить значок/);
        const commentsHtml = commentsSectionMatch ? commentsSectionMatch[1] : html;

        const comments = [];
        const wrapRegex = /<div id=['"]wpd-comm-(\d+)(?:_\d+)?['"][^>]*>([\s\S]*?)<div class=['"]wpd-comment-footer['"]/g;
        let match;
        
        while ((match = wrapRegex.exec(commentsHtml)) !== null) {
            const commentId = match[1];
            const content = match[2];
            
            const authorMatch = content.match(/<a[^>]*class="[^"]*comment-author[^"]*"[^>]*>([\s\S]*?)<\/a>/) || 
                                content.match(/<div class="wpd-comment-author[^>]*>([\s\S]*?)<\/div>/);
            const author = authorMatch ? cleanHTML(authorMatch[1]) : '';
            
            const dateMatch = content.match(/<div class="wpd-comment-date" title="([^"]+)">/);
            let date = '';
            if (dateMatch) {
                const dateParts = dateMatch[1].split(' ')[0].split('.');
                if (dateParts.length === 3) {
                    date = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
                }
            }
            
            const textMatch = content.match(/<div class="wpd-comment-text">([\s\S]*?)<\/div>/);
            const text = textMatch ? cleanHTML(textMatch[1]) : '';
            
            const isFounder = content.includes('Основатель') || content.includes('Founder');

            if (author && text && !author.includes('Основатель')) {
                comments.push({
                    id: `productradar-${commentId}`,
                    author,
                    title: "",
                    date,
                    rating: null,
                    pros: "",
                    cons: "",
                    text,
                    source: "productradar.ru",
                    url: URLS.productradar,
                    isFounder: isFounder || author.includes('Юрий Куприянов') ? true : undefined
                });
            }
        }
        if (comments.length > 0) {
            const sourceExisting = existingReviews.filter(r => r.source === 'productradar.ru');
            comments.forEach((c) => {
                const normAuthor = normalizeName(c.author);
                const existing = sourceExisting.find(r => normalizeName(r.author) === normAuthor);
                
                if (existing) {
                    c.date = c.date || existing.date;
                    c.text = c.text || existing.text;
                }
                newReviews.push(c);
            });
            console.log(`-> productradar.ru: успешно спарсено ${comments.length} дискуссий.`);
        } else {
            throw new Error("Не найдено комментариев в разметке ProductRadar");
        }
    } catch (e) {
        console.error('Ошибка при работе с productradar.ru:', e.message);
        const fallback = existingReviews.filter(r => r.source === 'productradar.ru');
        newReviews.push(...fallback);
        console.log(`-> productradar.ru: использован бэкап из ${fallback.length} дискуссий.`);
    }

    // Merge catalog reviews with static Google Maps reviews
    const finalDatabase = [...newReviews, ...googleRatings];

    // Write final data.json
    try {
        console.log(`Обновление локальной базы данных отзывов: ${dbPath}`);
        fs.writeFileSync(dbPath, JSON.stringify(finalDatabase, null, 2), 'utf8');
        console.log('Парсинг успешно завершен! База данных отзывов актуализирована.');
    } catch (e) {
        console.error('Не удалось записать базу данных отзывов:', e.message);
    }
}

runScraper();
