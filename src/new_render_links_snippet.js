renderLinks() {
    const linksContainer = document.getElementById('links');

    let linksToFilter = this.links;

    // 1. Fuzzy Search Filter (if query exists)
    if (this.searchQuery) {
        const options = {
            keys: [
                { name: 'title', weight: 0.7 },
                { name: 'category', weight: 0.2 },
                { name: 'url', weight: 0.1 }
            ],
            threshold: 0.4,
            ignoreLocation: true
        };

        if (window.Fuse) {
            const fuse = new Fuse(linksToFilter, options);
            const results = fuse.search(this.searchQuery);
            linksToFilter = results.map(result => result.item);
        } else {
            const query = this.searchQuery;
            linksToFilter = linksToFilter.filter(link =>
                (link.title || '').toLowerCase().includes(query) ||
                (link.url || '').toLowerCase().includes(query)
            );
        }
    }

    // 2. Tab & Category Filter
    const filteredLinks = linksToFilter.filter(link => {
        // Tab Filter
        let tabMatch = false;
        if (this.currentTab === 'read') {
            tabMatch = link.isRead === 1;
        } else if (this.currentTab === 'favorites') {
            tabMatch = link.isFavorite === 1;
        } else {
            tabMatch = !link.isRead || link.isRead === 0;
        }
        if (!tabMatch) return false;

        // Category Filter
        if (this.categoryFilter !== 'all') {
            const cat = (link.category || 'general').toLowerCase();
            if (cat !== this.categoryFilter.toLowerCase()) {
                return false;
            }
        }

        return true;
    });

    // Toggle Empty State Visibility
    const emptyState = document.querySelector('.empty-state');

    // If simply no links at all (and strict check?)
    // Actually, let's just render content.

    if (filteredLinks.length === 0) {
        let emptyMessage = 'No links found';
        if (this.currentTab === 'read') emptyMessage = 'No read links';
        else if (this.currentTab === 'favorites') emptyMessage = 'No favorites yet';
        else if (this.currentTab === 'unread') emptyMessage = 'All caught up!';

        linksContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon-placeholder">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                    </div>
                    <div class="empty-title">${emptyMessage}</div>
                    <div class="empty-description">Save a link to get started</div>
                </div>
             `;
        return;
    }

    const sortedLinks = filteredLinks.sort((a, b) => new Date(b.timestamp || b.dateAdded) - new Date(a.timestamp || a.dateAdded));

    linksContainer.innerHTML = sortedLinks.map(link => {
        const domain = this.extractDomainFromUrl(link.url);
        const isRead = link.isRead === 1;
        const category = link.category || 'Other';

        return `
            <div class="link-card" data-id="${link.id}">
                <div class="card-top">
                    <span class="card-badge badge-${category}">${category}</span>
                    <button class="star-btn ${link.isFavorite ? 'active' : ''}" 
                            onclick="app.toggleFavorite('${link.id}', ${!link.isFavorite})"
                            title="${link.isFavorite ? 'Remove from favorites' : 'Favorite'}">
                        ${link.isFavorite ? '★' : '☆'}
                    </button>
                </div>
                
                <div class="card-main">
                    <h3 class="card-title">
                        <a href="${link.url}" target="_blank" rel="noopener noreferrer">${link.title || domain}</a>
                        ${link.isPending ? '<span class="pending-indicator">...</span>' : ''}
                    </h3>
                    <div class="card-domain">${domain}</div>
                </div>
                
                <div class="card-footer">
                    ${!isRead
                ? `<button class="mark-read-btn" onclick="app.markAsRead('${link.id}', true)">
                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px"><polyline points="20 6 9 17 4 12"></polyline></svg>
                             Mark read
                           </button>`
                : `<button class="mark-read-btn is-read" onclick="app.markAsRead('${link.id}', false)">
                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px"><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                             Read
                           </button>`
            }
                    
                    <div class="card-actions">
                        <button class="icon-btn" onclick="app.copyLink('${link.url}')" title="Copy">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                        <button class="icon-btn" onclick="app.deleteLink('${link.id}')" title="Delete">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
            `;
    }).join('');
}
