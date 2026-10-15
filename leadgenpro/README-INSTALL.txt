# LeadGen Pro - One-Click Installer

## 🚀 QUICK INSTALL (3 Steps)

### Step 1: Upload Files
Upload these 3 files to your cPanel `public_html/` directory (or a subdirectory like `public_html/leadgen/`):
- `install.php`
- `leadgen-pro-files.zip`
- `database.sql`

### Step 2: Run Installer
1. Open your browser
2. Go to: `https://yourdomain.com/install.php`
3. Follow the 3-step wizard

### Step 3: Done! 🎉
- Delete `install.php` for security
- Login with your credentials
- Start generating leads!

---

## 📋 DETAILED INSTRUCTIONS

### Prerequisites
Before running the installer, create in cPanel:

1. **MySQL Database**
   - cPanel → MySQL Database Wizard
   - Database name: `username_leadgen`
   - Username: `username_leaduser`
   - Password: (generate strong password)
   - Add user to database with ALL PRIVILEGES

2. **Optional: SSL Certificate**
   - cPanel → SSL/TLS
   - Install Let's Encrypt certificate
   - Ensures HTTPS for security

### Installation Steps

#### 1. Upload Files
Using cPanel File Manager:
```
1. Log into cPanel
2. Open File Manager
3. Navigate to public_html/ (or create subdirectory)
4. Click "Upload"
5. Select: install.php, leadgen-pro-files.zip, database.sql
```

Or using FTP:
```bash
ftp yourdomain.com
# Upload the 3 files to public_html/
```

#### 2. Run Web Installer
```
https://yourdomain.com/install.php
```

The installer will:
- ✅ Check system requirements
- ✅ Test database connection
- ✅ Extract application files
- ✅ Create database tables
- ✅ Configure API settings
- ✅ Create admin account
- ✅ Set secure permissions

#### 3. Post-Installation
```bash
# Delete installer files (SECURITY!)
rm install.php
rm leadgen-pro-files.zip
# Keep database.sql as backup
```

---

## 🔧 MANUAL INSTALL (If Auto-Installer Fails)

### 1. Extract Files
```bash
cd public_html
unzip leadgen-pro-files.zip
```

### 2. Import Database
```bash
mysql -u username -p database_name < database.sql
```

### 3. Configure
Edit `api/config.php`:
```php
$db_config = [
    'database' => 'your_db_name',
    'username' => 'your_db_user',
    'password' => 'your_db_pass'
];
```

Edit `auth-middleware.js`:
```javascript
API_BASE_URL: 'https://yourdomain.com/api',
DEMO_MODE: false,
REQUIRE_AUTH: true
```

---

## ⚙️ CONFIGURATION OPTIONS

### Demo Mode vs Live Mode

During installation, you can choose:

**Demo Mode** (Recommended for testing)
- No real API calls (simulated)
- No database required
- Instant setup
- Good for demonstrations

**Live Mode** (Production)
- Real database storage
- Real AI calling (requires API keys)
- User authentication required
- Full functionality

### AI Service Integration (Optional)

After installation, connect AI calling:

1. **Bland AI** (Recommended)
   - Sign up: bland.ai
   - Get API key
   - Add to `api/config.php`
   - Cost: ~$0.07/minute

2. **Twilio + OpenAI**
   - Sign up: twilio.com
   - Get SID, Token, Phone number
   - Add to config
   - Cost: ~$0.05/minute

---

## 🛡️ SECURITY CHECKLIST

After installation:

- [ ] Delete `install.php`
- [ ] Delete `leadgen-pro-files.zip`
- [ ] Change default admin password
- [ ] Enable HTTPS (SSL)
- [ ] Set file permissions (644 for PHP, 755 for dirs)
- [ ] Configure firewall rules
- [ ] Set up automated backups
- [ ] Enable 2FA if available

---

## 🐛 TROUBLESHOOTING

### "500 Internal Server Error"
→ Check PHP version (need 7.4+)
→ Check file permissions
→ Check .htaccess syntax

### "Database connection failed"
→ Verify credentials in config.php
→ Check database exists
→ Verify user has privileges

### "404 Not Found"
→ Check mod_rewrite enabled
→ Check .htaccess uploaded
→ Check file paths

### "Permission denied"
→ Set permissions: `chmod -R 755 .`
→ Check ownership: `chown -R user:user .`

### "CORS errors"
→ Update domain in config.php
→ Check HTTPS vs HTTP
→ Verify allowed_origins array

---

## 📞 SUPPORT

If installer fails:

1. Check cPanel Error Logs
2. Enable debug mode in install.php
3. Try manual installation steps
4. Contact hosting provider for PHP/MySQL issues

---

## 🎉 SUCCESS!

Your LeadGen Pro is now ready at:
```
https://yourdomain.com/login.html
```

Default credentials (if not changed):
- Email: admin@leadgenpro.com
- Password: (what you set during install)

**Start generating leads! 🚀**
