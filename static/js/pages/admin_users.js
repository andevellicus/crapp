document.addEventListener('DOMContentLoaded', function() {
    // Check if user is authenticated and is admin
    if (!CRAPP.auth || !CRAPP.auth.isAuthenticated()) {
        CRAPP.auth.redirectToLogin();
        return;
    }
    
    // Verify user is admin
    const currentUser = CRAPP.auth.getCurrentUser();
    if (!currentUser || !currentUser.is_admin) {
        window.location.href = '/';
        return;
    }
    
    // Initialize users page
    initUsersPage();
});

// Search state
const searchState = {
    query: '',
    page: 1,
    limit: 20,
    total: 0
};

// Initialize users page
function initUsersPage() {
    // Setup search button
    document.getElementById('search-button').addEventListener('click', function() {
        searchState.query = document.getElementById('search-input').value;
        searchState.page = 1;
        searchUsers();
    });
    
    // Search input: Enter key
    document.getElementById('search-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchState.query = this.value;
            searchState.page = 1;
            searchUsers();
        }
    });
    
    // Pagination
    document.getElementById('prev-page').addEventListener('click', function() {
        if (searchState.page > 1) {
            searchState.page--;
            searchUsers();
        }
    });
    
    document.getElementById('next-page').addEventListener('click', function() {
        const totalPages = Math.ceil(searchState.total / searchState.limit);
        if (searchState.page < totalPages) {
            searchState.page++;
            searchUsers();
        }
    });
    
    // Initial search
    searchUsers();
}

// Search users
async function searchUsers() {
    const loadingEl = document.getElementById('loading');
    const noResultsEl = document.getElementById('no-results');
    const tableBodyEl = document.getElementById('users-table-body');
    
    // Show loading
    loadingEl.style.display = 'block';
    tableBodyEl.innerHTML = '';
    noResultsEl.style.display = 'none';
    
    try {
        // Calculate skip
        const skip = (searchState.page - 1) * searchState.limit;
        
        // Prepare URL
        let url = `/admin/api/users/search?skip=${skip}&limit=${searchState.limit}`;
        if (searchState.query) {
            url += `&q=${encodeURIComponent(searchState.query)}`;
        }
        
        // Use the API service instead of direct fetch
        const data = await CRAPP.api.get(url);
        
        // Update state
        searchState.total = data.total;
        
        // Update pagination
        updatePagination();
        
        // Hide loading
        loadingEl.style.display = 'none';
        
        // Show no results message if needed
        if (data.users.length === 0) {
            noResultsEl.style.display = 'block';
            return;
        }
        
        // Render users
        data.users.forEach(user => {
            const row = document.createElement('tr');
            
            // Email cell
            const emailCell = document.createElement('td');
            emailCell.textContent = user.email;
            row.appendChild(emailCell);
            
            // Name cell
            const nameCell = document.createElement('td');
            nameCell.textContent = `${user.first_name || ''} ${user.last_name || ''}`.trim() || '-';
            row.appendChild(nameCell);
            
            // Created date cell
            const createdCell = document.createElement('td');
            createdCell.textContent = CRAPP.utils.formatDate(user.created_at);
            row.appendChild(createdCell);
            
            // Last login cell
            const lastLoginCell = document.createElement('td');
            lastLoginCell.textContent = CRAPP.utils.formatDate(user.last_login);
            row.appendChild(lastLoginCell);
            
            // Actions cell
            const actionsCell = document.createElement('td');
            
            // View data button
            const viewButton = document.createElement('a');
            viewButton.href = `/admin/visualize?user_id=${encodeURIComponent(user.email)}`;
            viewButton.className = 'action-button';
            viewButton.textContent = 'View Data';
            actionsCell.appendChild(viewButton);
            
            row.appendChild(actionsCell);
            tableBodyEl.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error searching users:', error);
        CRAPP.utils.showMessage(`Error searching users: ${error.message}`, 'error');
        
        // Hide loading state
        loadingEl.style.display = 'none';
    }
}

function updatePagination() {
    const totalPages = Math.ceil(searchState.total / searchState.limit);
    document.getElementById('prev-page').disabled = searchState.page <= 1;
    document.getElementById('next-page').disabled = searchState.page >= totalPages;
    document.getElementById('page-info').textContent = `Page ${searchState.page} of ${totalPages || 1}`;
}