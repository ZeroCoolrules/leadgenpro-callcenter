// LeadGen Pro - Authentication Middleware
// Add this at the beginning of your app

const AUTH_CONFIG = {
    API_BASE_URL: 'https://yourdomain.com/api', // CHANGE THIS!
    DEMO_MODE: false, // SET TO FALSE TO GO LIVE!
    REQUIRE_AUTH: true // SET TO TRUE TO REQUIRE LOGIN
};

// Check authentication on page load
(function() {
    // Skip auth check for login/register pages
    if (window.location.pathname.includes('login') || 
        window.location.pathname.includes('register')) {
        return;
    }

    if (AUTH_CONFIG.REQUIRE_AUTH && !localStorage.getItem('isLoggedIn')) {
        window.location.href = 'login.html';
        return;
    }
})();

// API client with auth
class APIClient {
    constructor() {
        this.baseURL = AUTH_CONFIG.API_BASE_URL;
        this.apiKey = localStorage.getItem('api_key');
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}/${endpoint}`;

        const config = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                ...options.headers
            },
            ...options
        };

        if (options.body && typeof options.body === 'object') {
            config.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, config);

            if (response.status === 401) {
                // Token expired or invalid
                localStorage.removeItem('api_key');
                localStorage.removeItem('isLoggedIn');
                window.location.href = 'login.html';
                return;
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Leads API
    async getLeads(filters = {}) {
        if (AUTH_CONFIG.DEMO_MODE) {
            return this.getDemoLeads();
        }
        const params = new URLSearchParams(filters);
        return this.request(`leads.php?${params}`);
    }

    async createLead(leadData) {
        if (AUTH_CONFIG.DEMO_MODE) {
            return this.createDemoLead(leadData);
        }
        return this.request('leads.php', {
            method: 'POST',
            body: leadData
        });
    }

    async updateLead(id, updates) {
        if (AUTH_CONFIG.DEMO_MODE) {
            return this.updateDemoLead(id, updates);
        }
        return this.request('leads.php', {
            method: 'PUT',
            body: { id, ...updates }
        });
    }

    async deleteLead(id) {
        if (AUTH_CONFIG.DEMO_MODE) {
            return this.deleteDemoLead(id);
        }
        return this.request(`leads.php?id=${id}`, {
            method: 'DELETE'
        });
    }

    // AI Calling API
    async startAICall(phone, script, options = {}) {
        if (AUTH_CONFIG.DEMO_MODE) {
            return this.simulateAICall(phone, script);
        }

        return this.request('ai-call.php', {
            method: 'POST',
            body: {
                phone,
                script,
                lead_id: options.leadId,
                campaign_id: options.campaignId,
                voice: options.voice || 'maya'
            }
        });
    }

    // Demo data methods
    getDemoLeads() {
        const demoLeads = [
            {
                id: 1,
                first_name: 'John',
                last_name: 'Smith',
                email: 'john@techcorp.com',
                phone: '+1234567890',
                company_name: 'TechCorp',
                job_title: 'CEO',
                source: 'web_scraper',
                quality: 'hot',
                status: 'new',
                created_at: new Date().toISOString()
            },
            {
                id: 2,
                first_name: 'Sarah',
                last_name: 'Johnson',
                email: 'sarah@startupxyz.com',
                phone: '+1234567891',
                company_name: 'StartupXYZ',
                job_title: 'Marketing Director',
                source: 'email_hunter',
                quality: 'warm',
                status: 'contacted',
                created_at: new Date(Date.now() - 86400000).toISOString()
            }
        ];

        return Promise.resolve({
            success: true,
            data: demoLeads,
            pagination: { total: 2, page: 1, pages: 1 }
        });
    }

    createDemoLead(data) {
        const newLead = {
            id: Date.now(),
            ...data,
            created_at: new Date().toISOString()
        };

        // Store in localStorage for demo persistence
        const existing = JSON.parse(localStorage.getItem('demo_leads') || '[]');
        existing.push(newLead);
        localStorage.setItem('demo_leads', JSON.stringify(existing));

        return Promise.resolve({
            success: true,
            message: 'Lead created (DEMO MODE)',
            data: { id: newLead.id }
        });
    }

    updateDemoLead(id, updates) {
        const existing = JSON.parse(localStorage.getItem('demo_leads') || '[]');
        const index = existing.findIndex(l => l.id == id);
        if (index !== -1) {
            existing[index] = { ...existing[index], ...updates };
            localStorage.setItem('demo_leads', JSON.stringify(existing));
        }
        return Promise.resolve({ success: true });
    }

    deleteDemoLead(id) {
        const existing = JSON.parse(localStorage.getItem('demo_leads') || '[]');
        const filtered = existing.filter(l => l.id != id);
        localStorage.setItem('demo_leads', JSON.stringify(filtered));
        return Promise.resolve({ success: true });
    }

    simulateAICall(phone, script) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    message: 'Call initiated (DEMO MODE)',
                    data: {
                        call_id: 'demo_' + Date.now(),
                        status: 'dialing',
                        simulation: true
                    }
                });
            }, 1000);
        });
    }
}

// Initialize API client
const api = new APIClient();

// User session management
const Auth = {
    getCurrentUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    },

    isLoggedIn() {
        return !!localStorage.getItem('isLoggedIn');
    },

    logout() {
        localStorage.removeItem('api_key');
        localStorage.removeItem('user');
        localStorage.removeItem('isLoggedIn');
        window.location.href = 'login.html';
    },

    updateUI() {
        const user = this.getCurrentUser();
        if (user) {
            // Update UI with user info
            const userNameElements = document.querySelectorAll('.user-name');
            userNameElements.forEach(el => el.textContent = user.first_name);

            const userEmailElements = document.querySelectorAll('.user-email');
            userEmailElements.forEach(el => el.textContent = user.email);
        }
    }
};

// Check auth status periodically
setInterval(() => {
    if (AUTH_CONFIG.REQUIRE_AUTH && !Auth.isLoggedIn()) {
        window.location.href = 'login.html';
    }
}, 60000); // Check every minute

// Export for use in other scripts
window.APIClient = APIClient;
window.api = api;
window.Auth = Auth;
window.AUTH_CONFIG = AUTH_CONFIG;
