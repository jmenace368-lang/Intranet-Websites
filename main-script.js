const ARTICLE_LIMITS = Object.freeze({
    articles: 1000,
    bodyBlocks: 500,
    id: 120,
    title: 300,
    section: 80,
    type: 100,
    published: 80,
    author: 120,
    imageLabel: 80,
    summary: 2000,
    bodyText: 20000,
    caption: 1000,
    cite: 500
});

const ALLOWED_IMAGE_LABEL_STYLES = new Set([
    'default', 'breaking', 'local-news', 'city-news'
]);

function cleanString(value, maxLength) {
    if (typeof value !== 'string' && typeof value !== 'number') return '';
    return String(value).replace(/\u0000/g, '').trim().slice(0, maxLength);
}

function cleanId(value) {
    const id = cleanString(value, ARTICLE_LIMITS.id);
    return /^[A-Za-z0-9][A-Za-z0-9._~-]{0,119}$/.test(id) ? id : '';
}

function slugifyTitle(value) {
    const title = cleanString(value, ARTICLE_LIMITS.title);
    if (!title) return '';

    let slug = title
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-');

    slug = slug.slice(0, ARTICLE_LIMITS.id).replace(/-+$/g, '');
    return slug || 'article';
}

function cleanEnum(value, allowed, fallback) {
    return allowed.indexOf(value) !== -1 ? value : fallback;
}

function safeImageURL(value) {
    if (typeof value !== 'string' || !value.trim()) return '';

    try {
        const url = new URL(value.trim(), document.baseURI);
        const isSameOrigin = url.origin === location.origin;

        if (url.protocol === 'https:' || (url.protocol === 'http:' && isSameOrigin)) {
            return url.href;
        }

        return '';
    } catch (error) {
        return '';
    }
}

function safeImageDimension(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return '';

    const dimension = String(value).trim();
    return /^(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|%|em|rem|vw|vh))$/i.test(dimension)
        ? dimension
        : '';
}

function normalizeBodyBlock(block) {
    if (typeof block === 'string') {
        return cleanString(block, ARTICLE_LIMITS.bodyText);
    }

    if (!block || typeof block !== 'object' || Array.isArray(block)) return null;

    const align = cleanEnum(block.align, ['left', 'center', 'right'], '');

    switch (block.type) {
        case 'paragraph':
            return {
                type: 'paragraph',
                text: cleanString(block.text, ARTICLE_LIMITS.bodyText),
                align: align
            };

        case 'image': {
            const src = safeImageURL(block.src);
            if (!src) return null;

            return {
                type: 'image',
                src: src,
                caption: cleanString(block.caption, ARTICLE_LIMITS.caption),
                align: align,
                float: cleanEnum(block.float, ['left', 'right'], ''),
                width: safeImageDimension(block.width),
                height: safeImageDimension(block.height)
            };
        }

        case 'blockquote':
            return {
                type: 'blockquote',
                text: cleanString(block.text, ARTICLE_LIMITS.bodyText),
                cite: cleanString(block.cite, ARTICLE_LIMITS.cite),
                align: align
            };

        case 'aside':
            return {
                type: 'aside',
                text: cleanString(block.text, ARTICLE_LIMITS.bodyText),
                align: align
            };

        case 'hr':
            return { type: 'hr' };

        default:
            return null;
    }
}

function normalizeArticle(article) {
    if (!article || typeof article !== 'object' || Array.isArray(article)) return null;

    const title = cleanString(article.title, ARTICLE_LIMITS.title);
    const section = cleanString(article.section, ARTICLE_LIMITS.section);

    if (!title || !section) return null;

    const id = cleanId(article.id) || slugifyTitle(title);

    const body = Array.isArray(article.body)
        ? article.body
            .slice(0, ARTICLE_LIMITS.bodyBlocks)
            .map(normalizeBodyBlock)
            .filter(function (block) { return block !== null; })
        : [];

    const labelStyle = cleanString(article.imageLabelStyle, 40);

    return {
        id: id,
        title: title,
        section: section,
        type: cleanString(article.type, ARTICLE_LIMITS.type),
        published: cleanString(article.published, ARTICLE_LIMITS.published),
        author: cleanString(article.author, ARTICLE_LIMITS.author),
        pinned: article.pinned === true,
        recommended: article.recommended === true,
        opinion: article.opinion === true,
        image: safeImageURL(article.image),
        imageLabel: cleanString(article.imageLabel, ARTICLE_LIMITS.imageLabel),
        imageLabelStyle: ALLOWED_IMAGE_LABEL_STYLES.has(labelStyle) ? labelStyle : 'default',
        summary: cleanString(article.summary, ARTICLE_LIMITS.summary),
        body: body
    };
}

const RAW_ARTICLES = Array.isArray(window.ARTICLES) ? window.ARTICLES : [];

const ARTICLES = RAW_ARTICLES
    .slice(0, ARTICLE_LIMITS.articles)
    .map(normalizeArticle)
    .filter(function (article) { return article !== null; });

const tabTriggers = document.querySelectorAll('.navigation [data-tab]');
const tabPanels = document.querySelectorAll('.tab-panel[data-tab]');

const ARTICLE_MAP = (() => {
    const map = new Map();

    for (let i = 0; i < ARTICLES.length; i++) {
        const article = ARTICLES[i];
        let id = article.id;

        if (map.has(id)) {
            const baseId = article.id;
            let n = 2;
            let suffix = '-' + n;
            let newId = baseId.slice(0, ARTICLE_LIMITS.id - suffix.length).replace(/-+$/g, '') + suffix;

            while (map.has(newId)) {
                n += 1;
                suffix = '-' + n;
                newId = baseId.slice(0, ARTICLE_LIMITS.id - suffix.length).replace(/-+$/g, '') + suffix;
            }

            article.id = newId;
            id = newId;
        }

        map.set(id, article);
    }

    return map;
})();

const categoryTabs = {
    city: 'City 13',
    politics: 'Politics',
    announcements: 'Announcements',
    economy: 'Economy',
    society: 'Society',
    opinion: 'Opinion'
};

const CONFIG = {
    mainNewsLayout: 'grid',
    randomizeLayout: false
};

const LAYOUT_CONFIGS = {
    grid: { primaryCount: 2, secondaryCount: 2, secondaryFixedGrid: false },
    full: { primaryCount: 1, secondaryCount: 4, secondaryFixedGrid: true },
    cascade: { primaryCount: 1, secondaryCount: 3, secondaryFixedGrid: true }
};

var clickAudio;

(function preloadClickSound() {
    clickAudio = new Audio('https://raw.githubusercontent.com/jmenace368-lang/public-html/592cffd7b2d23c231584d9013cf2e0df63127595/universfield-computer-mouse-click-352734.mp3');
    clickAudio.volume = 0.6;
    clickAudio.preload = 'auto';
    clickAudio.load();
})();

function playClickSound() {
    if (clickAudio) {
        clickAudio.currentTime = 0;
        clickAudio.play().catch(function () { });
    }
}

function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c];
    });
}

function formatText(text) {
    if (!text) return '';

    let html = escapeHTML(text);
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    return html;
}

function formatMeta(article) {
    return article.published + ' \u00B7 ' + article.author;
}

function byNewest(a, b) {
    return new Date(b.published) - new Date(a.published);
}

function articleCard(article, options) {
    options = options || {};

    const isOpinion = article.opinion === true;
    const leadClass = options.lead ? ' lead ' : '';
    const opinionClass = isOpinion ? ' opinion-card' : '';
    const imageUrl = safeImageURL(article.image);

    const imageLabel = article.imageLabel
        ? '<div class="class-label ' + escapeHTML(article.imageLabelStyle || 'default') + '">' + escapeHTML(article.imageLabel) + '</div>'
        : '';

    const image = imageUrl
        ? '<div class="image-wrap"><div class="photo"><img src="' + escapeHTML(imageUrl) + '" title="' + escapeHTML(article.title) + '"></div>' + imageLabel + '</div>'
        : '';

    const typeKicker = article.type
        ? '<div class="kicker">' + escapeHTML(article.type) + '</div>'
        : '';

    return (
        '<article class="news-article' + leadClass + opinionClass + '"' +
        ' data-article="' + escapeHTML(article.id) + '"' +
        ' data-title="' + escapeHTML(article.title) + '"' +
        ' data-section="' + escapeHTML(article.section) + '"' +
        ' data-type="' + escapeHTML(article.type || '') + '">' +
        '<button type="button" data-article="' + escapeHTML(article.id) + '">' +
        image +
        typeKicker +
        '<h3>' + escapeHTML(article.title) + '</h3>' +
        '<div class="summary">' + escapeHTML(article.summary) + '</div>' +
        '<div class="date">' + escapeHTML(formatMeta(article)) + '</div>' +
        '</button>' +
        '</article>'
    );
}

function renderBodyBlock(block) {
    if (typeof block === 'string') {
        return '<p>' + formatText(block) + '</p>';
    }

    if (!block || typeof block !== 'object') return '';

    const alignClass = block.align === 'center' ? 'align-center'
        : block.align === 'right' ? 'align-right' : '';

    switch (block.type) {
        case 'paragraph':
            return '<p class="' + alignClass + '">' + formatText(block.text) + '</p>';

        case 'image': {
            const imageUrl = safeImageURL(block.src);
            if (!imageUrl) return '';

            const floatClass = block.float === 'left' ? 'float-left'
                : block.float === 'right' ? 'float-right' : '';

            const styleParts = [];
            const width = safeImageDimension(block.width);
            const height = safeImageDimension(block.height);

            if (width) styleParts.push('width:' + width);
            if (height) styleParts.push('height:' + height);

            const styleAttr = styleParts.length ? 'style="' + styleParts.join(';') + '"' : '';
            const caption = block.caption
                ? '<figcaption>' + formatText(block.caption) + '</figcaption>'
                : '';
            const heightAttr = height ? ' height="' + height + '"' : '';

            return (
                '<figure class="article-image ' + floatClass + ' ' + alignClass + '" ' + styleAttr + '>' +
                '<img src="' + escapeHTML(imageUrl) + '"' + heightAttr +
                ' title="' + escapeHTML(block.caption || '') + '">' +
                caption +
                '</figure>'
            );
        }

        case 'blockquote': {
            const cite = block.cite
                ? '<cite>\u2014 ' + formatText(block.cite) + '</cite>'
                : '';

            return (
                '<blockquote class="' + alignClass + '">' +
                '<p>' + formatText(block.text) + '</p>' +
                cite +
                '</blockquote>'
            );
        }

        case 'aside':
            return '<aside class="article-aside ' + alignClass + '">' + formatText(block.text) + '</aside>';

        case 'hr':
            return '<hr class="article-hr">';

        default:
            return '';
    }
}

function buildMainNews(selectedLayout, frontPage) {
    const config = LAYOUT_CONFIGS[selectedLayout];
    const primaryStories = frontPage.slice(0, config.primaryCount);
    const secondaryStories = frontPage.slice(config.primaryCount, config.primaryCount + config.secondaryCount);
    const moreStories = frontPage.slice(config.primaryCount + config.secondaryCount);

    const primaryHtml = primaryStories
        .map(function (article, index) {
            return articleCard(article, { lead: index === 0 });
        })
        .join('');

    const secondaryHtml = secondaryStories
        .map(function (article) {
            return articleCard(article);
        })
        .join('');

    return {
        primaryHtml: primaryHtml,
        secondaryHtml: secondaryHtml,
        moreStories: moreStories
    };
}

function renderHome() {
    const newestFirst = ARTICLES.slice().sort(byNewest);

    const pinned = newestFirst.filter(function (a) {
        return a.pinned;
    });

    const leadArticle = pinned[0] || newestFirst[0];

    const rest = newestFirst.filter(function (a) {
        return !leadArticle || a.id !== leadArticle.id;
    });

    const frontPage = leadArticle ? [leadArticle].concat(rest) : rest;

    const weighted = [
        CONFIG.mainNewsLayout,
        CONFIG.mainNewsLayout,
        CONFIG.mainNewsLayout
    ];

    ['grid', 'full', 'cascade'].forEach(function (layout) {
        if (layout !== CONFIG.mainNewsLayout) weighted.push(layout);
    });

    const selectedLayout = CONFIG.randomizeLayout
        ? weighted[Math.floor(Math.random() * weighted.length)]
        : CONFIG.mainNewsLayout;

    const layoutClass = 'layout-' + selectedLayout;
    const built = buildMainNews(selectedLayout, frontPage);
    const primaryHtml = built.primaryHtml;
    const secondaryHtml = built.secondaryHtml;
    const moreStories = built.moreStories;
    const visibleMore = moreStories.slice(0, 2);

    const moreHtml = visibleMore.length
        ? (
            '<div class="section-wrap">' +
            '<div class="kicker-wrap">' +
            '<div class="kicker">More Stories</div>' +
            '<h2 class="page-title">Recent Headlines</h2>' +
            '</div>' +
            '<div class="stories">' +
            visibleMore.map(function (a) { return articleCard(a); }).join('') +
            '</div>' +
            '</div>'
        )
        : '';

    const target = document.querySelector('#panel-home .main-column');
    if (!target) return;

    const mainNewsHtml = frontPage.length
        ? (
            '<div class="main-news ' + layoutClass + '">' +
            '<div class="primary-news">' + primaryHtml + '</div>' +
            '<div class="secondary-news">' + secondaryHtml + '</div>' +
            '</div>'
        )
        : '<div class="no-articles"><p>No articles available.</p></div>';

    target.innerHTML =
        '<div class="section-wrap">' +
        '<div class="home-intro">' +
        '<div class="kicker">Front Page</div>' +
        '<h1 class="page-title">Current News</h1>' +
        '</div>' +
        mainNewsHtml +
        '</div>' +
        moreHtml;
}

function renderCategories() {
    Object.keys(categoryTabs).forEach(function (tabName) {
        const sectionName = categoryTabs[tabName];
        const target = document.querySelector('#panel-' + tabName + ' .section-wrap[data-category]');
        if (!target) return;

        const stories = tabName === 'opinion'
            ? ARTICLES.filter(function (a) { return a.opinion === true; })
            : ARTICLES.filter(function (a) { return a.section === sectionName; });

        target.innerHTML =
            '<div class="kicker">Coverage</div>' +
            '<h1 class="page-title">' + escapeHTML(sectionName) + '</h1>' +
            '<div class="stories">' +
            (stories.length
                ? stories.map(function (a) { return articleCard(a); }).join('')
                : '<p>No articles available.</p>') +
            '</div>';
    });
}

function sidebarStory(article) {
    return (
        '<article>' +
        '<button type="button" data-article="' + escapeHTML(article.id) + '">' +
        '<span class="title">' + escapeHTML(article.title) + '</span>' +
        '<div class="meta">' +
        '<span class="author">' + escapeHTML(article.author) + '</span>' +
        '<span class="date">' + escapeHTML(article.published) + '</span>' +
        '</div>' +
        '</button>' +
        '</article>'
    );
}

function leftSidebarHTML() {
    return (
        '<div class="side-widget website">' +
        '<div class="side-widget-title"><h2>Websites</h2></div>' +
        '<article class="widget-content">' +
        '<p>Enjoyed the site? Check out these other websites:</p>' +
        '<ul>' +
        '<li class="click-sound"><a href="#" onclick="return false;">\u00BB www.labourcoop.net</a></li>' +
        '<li class="click-sound"><a href="#" onclick="return false;">\u00BB www.oldworldblues.net</a></li>' +
        '<li class="click-sound"><a href="#" onclick="return false;">\u00BB www.city13.gov/districts/7/</a></li>' +
        '</ul>' +
        '</article>' +
        '</div>' +
        '<div class="side-advert small">' +
        '<img src="placeholder.jpg" alt="Advertisement">' +
        '</div>' +
        '<div class="side-widget">' +
        '<div class="side-widget-title"><h2>Editors\' Pick</h2></div>' +
        '<div class="widget-content" data-editor-picks>' +
        '<p>No editor picks available.</p>' +
        '</div>' +
        '</div>'
    );
}

function rightSidebarHTML() {
    return (
        '<div class="side-widget">' +
        '<div class="side-widget-title"><h2>Latest News</h2></div>' +
        '<div class="widget-content" data-latest-news>' +
        '<p>No latest news available.</p>' +
        '</div>' +
        '</div>' +
        '<div class="side-widget contact">' +
        '<div class="side-widget-title contact-title">' +
        '<h2>Contact us</h2>' +
        '</div>' +
        '<div class="contact-content widget-content">' +
        '<span>Weekly news, politics, events, and city announcements</span>' +
        '<a class="fake-button" style="display: flex; justify-self: center;" ' +
        'href="https://willard.network/forums/direct-messages/add?to=Kamilisha+Haijulikani" ' +
        'target="_blank" rel="noopener">CLICK HERE</a>' +
        '</div>' +
        '</div>' +
        '<div class="side-advert">' +
        '<img src="placeholder.jpg" alt="Advertisement">' +
        '</div>'
    );
}

function renderSidebars() {
    document.querySelectorAll('.side-column[data-side="left"]').forEach(function (el) {
        el.innerHTML = leftSidebarHTML();
    });

    document.querySelectorAll('.side-column[data-side="right"]').forEach(function (el) {
        el.innerHTML = rightSidebarHTML();
    });

    const latest = ARTICLES.slice().sort(byNewest).slice(0, 3);

    document.querySelectorAll('[data-latest-news]').forEach(function (el) {
        if (!latest.length) {
            el.innerHTML = '<article><p>No latest news available.</p></article>';
            return;
        }

        el.innerHTML = latest.map(sidebarStory).join('');
    });

    const picks = ARTICLES
        .filter(function (a) { return a.recommended; })
        .sort(byNewest);

    const VISIBLE = 3;

    document.querySelectorAll('[data-editor-picks]').forEach(function (el) {
        if (!picks.length) {
            el.innerHTML = '<article><p>No editors\' picks available.</p></article>';
            return;
        }

        const visible = picks.slice(0, VISIBLE);
        const hidden = picks.slice(VISIBLE);
        let html = visible.map(sidebarStory).join('');

        if (hidden.length) {
            html += '<div class="collapsible-extra">' + hidden.map(sidebarStory).join('') + '</div>';

            const parent = el.closest('.side-widget');

            if (parent && !parent.querySelector('[data-collapsible-toggle]')) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'collapsible-toggle';
                btn.setAttribute('data-collapsible-toggle', '');
                btn.textContent = 'Show more';
                parent.appendChild(btn);
            }
        }

        el.innerHTML = html;
    });
}

function updateArticleFade(shell, scrollEl) {
    if (!shell || !scrollEl) return;

    const atBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight <= 2;
    shell.classList.toggle('at-bottom', atBottom);
}

function articlePermalink(articleId) {
    return location.origin + location.pathname + location.search + '#' + encodeURIComponent(articleId);
}

function setArticleHash(articleId) {
    const next = articleId ? '#' + encodeURIComponent(articleId) : '';

    if (location.hash === next) return;

    history.replaceState(
        null,
        '',
        next || (location.pathname + location.search)
    );
}

function openArticle(articleId, opts) {
    opts = opts || {};

    const article = ARTICLE_MAP.get(articleId);
    if (!article) return;

    const imageUrl = safeImageURL(article.image);
    const typeDisplay = article.type ? escapeHTML(article.type) + ' \u00B7 ' : '';
    const opinionClass = article.opinion === true ? ' opinion-card' : '';
    const linkSvg = '<span class="icon-hyperlink" aria-hidden="true"></span>';
    const target = document.getElementById('articleTarget');

    if (!target) return;

    target.innerHTML =
        '<article class="article-detail' + opinionClass + '">' +
        '<div class="article-detail-scroll">' +
        '<div class="article-toolbar">' +
        '<button class="back-button" type="button" data-tab="home">Back to front page</button>' +
        '<button class="permalink-button" type="button" data-permalink="' + escapeHTML(article.id) + '" title="Copy link to article">' +
        linkSvg +
        '</button>' +
        '</div>' +
        '<div class="kicker">' + typeDisplay + escapeHTML(article.section) + '</div>' +
        '<h1>' + escapeHTML(article.title) + '</h1>' +
        '<div class="article-deck">' + escapeHTML(article.summary) + '</div>' +
        '<div class="date">' + escapeHTML(formatMeta(article)) + '</div>' +
        (imageUrl ? '<img class="article-hero" src="' + escapeHTML(imageUrl) + '" alt="">' : '') +
        '<div class="article-body">' +
        (article.body || []).map(renderBodyBlock).join('') +
        '</div>' +
        '</div>' +
        '<div class="article-detail-fade" aria-hidden="true"></div>' +
        '</article>';

    const shell = document.querySelector('#articleTarget .article-detail');
    const scrollEl = shell ? shell.querySelector('.article-detail-scroll') : null;

    if (shell && scrollEl) {
        scrollEl.addEventListener('scroll', function () {
            updateArticleFade(shell, scrollEl);
        });

        requestAnimationFrame(function () {
            updateArticleFade(shell, scrollEl);
        });
    }

    if (!opts.skipHash) setArticleHash(articleId);

    activateTab('article');
    window.scrollTo(0, 0);
}

function openArticleFromHash() {
    const raw = location.hash.replace(/^#/, '');
    if (!raw) return false;

    let id;

    try {
        id = decodeURIComponent(raw);
    } catch (error) {
        return false;
    }

    if (!ARTICLE_MAP.has(id)) return false;

    openArticle(id, { skipHash: true });
    return true;
}

function activateTab(tabName) {
    tabTriggers.forEach(function (trigger) {
        const isActive = trigger.dataset.tab === tabName;
        trigger.classList.toggle('active', isActive);
        trigger.setAttribute('aria-selected', String(isActive));
        trigger.tabIndex = isActive ? 0 : -1;
    });

    tabPanels.forEach(function (panel) {
        const isActive = panel.dataset.tab === tabName;
        panel.hidden = !isActive;
        panel.classList.toggle('active', isActive);
    });

    if (tabName !== 'article' && location.hash) {
        setArticleHash('');
    }
}

tabTriggers.forEach(function (trigger, index) {
    trigger.addEventListener('click', function () {
        playClickSound();
        activateTab(trigger.dataset.tab);
    });

    trigger.addEventListener('keydown', function (event) {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '].indexOf(event.key) === -1) return;

        event.preventDefault();

        if (event.key === 'Enter' || event.key === ' ') {
            activateTab(trigger.dataset.tab);
            return;
        }

        const nextIndex = event.key === 'Home' ? 0
            : event.key === 'End' ? tabTriggers.length - 1
                : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabTriggers.length) % tabTriggers.length;

        tabTriggers[nextIndex].focus();
    });
});

document.addEventListener('click', function (event) {
    const homeLogo = event.target.closest('.masthead-home');

    if (homeLogo) {
        playClickSound();
        activateTab('home');
        window.scrollTo(0, 0);
        return;
    }

    const articleTrigger = event.target.closest('[data-article]');

    if (articleTrigger) {
        playClickSound();

        const titleEl = articleTrigger.querySelector('span.title');
        if (titleEl) titleEl.classList.add('visited');

        openArticle(articleTrigger.dataset.article);
        return;
    }

    const tabTrigger = event.target.closest('.back-button[data-tab]');

    if (tabTrigger) {
        playClickSound();
        activateTab(tabTrigger.dataset.tab);
        return;
    }

    const fakeButton = event.target.closest('.fake-button');
    if (fakeButton) playClickSound();

    const sfxEl = event.target.closest('.click-sound, [data-click-sound]');
    if (sfxEl) playClickSound();

    const collapsibleToggle = event.target.closest('[data-collapsible-toggle]');

    if (collapsibleToggle) {
        playClickSound();

        const parentWidget = collapsibleToggle.closest('.side-widget');
        const content = parentWidget ? parentWidget.querySelector('.collapsible-extra') : null;

        if (content) {
            const expanded = content.classList.toggle('expanded');
            collapsibleToggle.textContent = expanded ? 'Show less' : 'Show more';
        }
    }

    const permalinkBtn = event.target.closest('[data-permalink]');

    if (permalinkBtn) {
        playClickSound();

        const id = permalinkBtn.dataset.permalink;
        const url = articlePermalink(id);

        const done = function () {
            permalinkBtn.classList.add('copied');
            permalinkBtn.title = 'Link copied';

            setTimeout(function () {
                permalinkBtn.classList.remove('copied');
                permalinkBtn.title = 'Copy link to article';
            }, 1500);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(done).catch(function () {
                setArticleHash(id);
                done();
            });
        } else {
            setArticleHash(id);
            done();
        }
    }
});

const searchInput = document.getElementById('searchInput');
const searchResultsDropdown = document.getElementById('searchResultsDropdown');

function performSearch(query) {
    query = String(query == null ? '' : query).trim().toLowerCase();

    if (!query) {
        searchResultsDropdown.classList.remove('active');
        searchResultsDropdown.innerHTML = '';
        return;
    }

    const results = ARTICLES
        .filter(function (a) {
            return a.title.toLowerCase().indexOf(query) !== -1;
        })
        .slice(0, 10);

    if (results.length === 0) {
        searchResultsDropdown.innerHTML =
            '<div style="padding: 8px 10px; color: #999; font-size: 12px;">No results found</div>';
    } else {
        searchResultsDropdown.innerHTML = results.map(function (a) {
            const typeDisplay = a.type ? ' \u00B7 ' + escapeHTML(a.type) : '';

            return (
                '<div class="search-result-item" data-article="' + escapeHTML(a.id) + '">' +
                '<div class="result-title">' + escapeHTML(a.title) + '</div>' +
                '<div class="result-section">' + escapeHTML(a.section) + typeDisplay + '</div>' +
                '</div>'
            );
        }).join('');
    }

    searchResultsDropdown.classList.add('active');
}

if (searchInput && searchResultsDropdown) {
    searchInput.addEventListener('input', function (event) {
        performSearch(event.target.value);
    });

    searchInput.addEventListener('blur', function () {
        setTimeout(function () {
            searchResultsDropdown.classList.remove('active');
        }, 200);
    });
}

const searchButton = document.getElementById('searchButton');

if (searchButton) {
    searchButton.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        playClickSound();
        performSearch(searchInput ? searchInput.value : '');
    });
}

if (searchResultsDropdown) {
    searchResultsDropdown.addEventListener('click', function (event) {
        const item = event.target.closest('.search-result-item');
        if (!item) return;

        if (searchInput) searchInput.value = '';

        searchResultsDropdown.classList.remove('active');
        openArticle(item.dataset.article);
    });
}

renderHome();
renderCategories();
renderSidebars();

openArticleFromHash();

window.addEventListener('hashchange', function () {
    if (!openArticleFromHash() && location.hash === '') {
        activateTab('home');
    }
});