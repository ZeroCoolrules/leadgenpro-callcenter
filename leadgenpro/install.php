<?php
/**
 * LeadGen Pro - One-Click Installer
 * Upload this file to your cPanel public_html/ and run it in browser
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

class LeadGenInstaller {
    private $errors = [];
    private $success = [];
    private $dbConnection = null;

    public function __construct() {
        session_start();
    }

    public function run() {
        $step = $_GET['step'] ?? 1;

        echo '<!DOCTYPE html>
        <html>
        <head>
            <title>LeadGen Pro Installer</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
                .container { background: white; border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); max-width: 800px; width: 100%; overflow: hidden; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; }
                .header h1 { font-size: 32px; margin-bottom: 10px; }
                .header p { opacity: 0.9; font-size: 16px; }
                .content { padding: 40px; }
                .step-indicator { display: flex; justify-content: center; margin-bottom: 30px; }
                .step { width: 40px; height: 40px; border-radius: 50%; background: #e5e7eb; display: flex; align-items: center; justify-content: center; margin: 0 10px; font-weight: bold; color: #6b7280; }
                .step.active { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
                .step.completed { background: #10b981; color: white; }
                .form-group { margin-bottom: 20px; }
                label { display: block; margin-bottom: 8px; font-weight: 600; color: #374151; }
                input[type="text"], input[type="password"], input[type="email"], select {
                    width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 8px;
                    font-size: 16px; transition: all 0.3s;
                }
                input:focus, select:focus { outline: none; border-color: #667eea; }
                .btn {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;
                    padding: 14px 32px; border: none; border-radius: 8px; font-size: 16px;
                    font-weight: 600; cursor: pointer; transition: opacity 0.3s; display: inline-block;
                    text-decoration: none;
                }
                .btn:hover { opacity: 0.9; }
                .btn-block { width: 100%; }
                .alert { padding: 16px; border-radius: 8px; margin-bottom: 20px; }
                .alert-error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
                .alert-success { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
                .alert-info { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
                .check-list { list-style: none; margin: 20px 0; }
                .check-list li { padding: 10px 0; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; }
                .check-list li:before { content: "✓"; margin-right: 10px; color: #10b981; font-weight: bold; }
                .code-block { background: #1f2937; color: #e5e7eb; padding: 20px; border-radius: 8px; overflow-x: auto; font-family: monospace; font-size: 14px; margin: 15px 0; }
                .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                @media (max-width: 640px) { .grid-2 { grid-template-columns: 1fr; } }
                .hidden { display: none; }
                .progress-bar { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; margin: 20px 0; }
                .progress-fill { height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); width: 0%; transition: width 0.5s; }
            </style>
        </head>
        <body>';

        echo '<div class="container">';
        echo '<div class="header">';
        echo '<h1>🚀 LeadGen Pro Installer</h1>';
        echo '<p>Complete installation in 3 easy steps</p>';
        echo '</div>';

        echo '<div class="content">';
        echo '<div class="step-indicator">';
        echo '<div class="step ' . ($step >= 1 ? 'active' : '') . ($step > 1 ? 'completed' : '') . '">1</div>';
        echo '<div class="step ' . ($step >= 2 ? 'active' : '') . ($step > 2 ? 'completed' : '') . '">2</div>';
        echo '<div class="step ' . ($step >= 3 ? 'active' : '') . ($step > 3 ? 'completed' : '') . '">3</div>';
        echo '</div>';

        switch($step) {
            case 1:
                $this->showRequirements();
                break;
            case 2:
                $this->showDatabaseSetup();
                break;
            case 3:
                $this->showInstallation();
                break;
            case 4:
                $this->showComplete();
                break;
            default:
                $this->showRequirements();
        }

        echo '</div>'; // content
        echo '</div>'; // container
        echo '</body></html>';
    }

    private function showRequirements() {
        $checks = [
            'PHP Version >= 7.4' => version_compare(PHP_VERSION, '7.4.0', '>='),
            'PDO Extension' => extension_loaded('pdo'),
            'PDO MySQL' => extension_loaded('pdo_mysql'),
            'cURL Extension' => extension_loaded('curl'),
            'JSON Extension' => extension_loaded('json'),
            'Write Permissions' => is_writable('.'),
            'Zip Extension' => extension_loaded('zip'),
        ];

        $allPassed = !in_array(false, $checks, true);

        echo '<h2 style="margin-bottom: 20px;">System Requirements</h2>';

        echo '<ul class="check-list">';
        foreach($checks as $name => $passed) {
            $icon = $passed ? '✅' : '❌';
            $color = $passed ? '#10b981' : '#ef4444';
            echo "<li style="color: $color">$icon $name</li>";
        }
        echo '</ul>';

        if($allPassed) {
            echo '<div class="alert alert-success">All requirements met! Ready to install.</div>';
            echo '<a href="?step=2" class="btn btn-block">Continue to Database Setup →</a>';
        } else {
            echo '<div class="alert alert-error">Please fix the requirements marked with ❌ above.</div>';
            echo '<button class="btn btn-block" onclick="location.reload()">Check Again</button>';
        }
    }

    private function showDatabaseSetup() {
        if($_SERVER['REQUEST_METHOD'] === 'POST') {
            $this->testDatabaseConnection();
            return;
        }

        echo '<h2 style="margin-bottom: 20px;">Database Configuration</h2>';
        echo '<div class="alert alert-info">Enter your cPanel MySQL database details. Create these in cPanel > MySQL Databases first.</div>';

        echo '<form method="POST" action="?step=2">';
        echo '<div class="form-group">';
        echo '<label>Database Host</label>';
        echo '<input type="text" name="db_host" value="localhost" required>';
        echo '</div>';

        echo '<div class="form-group">';
        echo '<label>Database Name</label>';
        echo '<input type="text" name="db_name" placeholder="username_leadgen" required>';
        echo '</div>';

        echo '<div class="form-group">';
        echo '<label>Database Username</label>';
        echo '<input type="text" name="db_user" placeholder="username_leaduser" required>';
        echo '</div>';

        echo '<div class="form-group">';
        echo '<label>Database Password</label>';
        echo '<input type="password" name="db_pass" required>';
        echo '</div>';

        echo '<button type="submit" class="btn btn-block">Test & Continue →</button>';
        echo '</form>';
    }

    private function testDatabaseConnection() {
        $host = $_POST['db_host'] ?? 'localhost';
        $name = $_POST['db_name'] ?? '';
        $user = $_POST['db_user'] ?? '';
        $pass = $_POST['db_pass'] ?? '';

        try {
            $pdo = new PDO("mysql:host=$host;dbname=$name;charset=utf8mb4", $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
            ]);

            // Store in session for next step
            $_SESSION['db_config'] = compact('host', 'name', 'user', 'pass');

            echo '<div class="alert alert-success">Database connection successful!</div>';
            echo '<a href="?step=3" class="btn btn-block">Continue to Installation →</a>';

        } catch(PDOException $e) {
            echo '<div class="alert alert-error">Connection failed: ' . $e->getMessage() . '</div>';
            echo '<a href="?step=2" class="btn">← Back</a>';
        }
    }

    private function showInstallation() {
        if($_SERVER['REQUEST_METHOD'] === 'POST' || isset($_GET['install'])) {
            $this->performInstallation();
            return;
        }

        if(!isset($_SESSION['db_config'])) {
            header('Location: ?step=2');
            exit;
        }

        echo '<h2 style="margin-bottom: 20px;">Ready to Install</h2>';
        echo '<div class="alert alert-info">This will install LeadGen Pro with the following settings:</div>';

        echo '<ul class="check-list">';
        echo '<li>Extract application files</li>';
        echo '<li>Create database tables</li>';
        echo '<li>Configure API settings</li>';
        echo '<li>Set up admin account</li>';
        echo '<li>Configure security settings</li>';
        echo '</ul>';

        echo '<form method="POST" action="?step=3&install=1">';
        echo '<div class="form-group">';
        echo '<label>Admin Email</label>';
        echo '<input type="email" name="admin_email" value="admin@leadgenpro.com" required>';
        echo '</div>';

        echo '<div class="form-group">';
        echo '<label>Admin Password</label>';
        echo '<input type="password" name="admin_pass" placeholder="Min 8 characters" minlength="8" required>';
        echo '</div>';

        echo '<div class="form-group">';
        echo '<label>Your Domain</label>';
        echo '<input type="text" name="domain" value="https://' . $_SERVER['HTTP_HOST'] . '" required>';
        echo '</div>';

        echo '<div class="form-group">';
        echo '<label><input type="checkbox" name="demo_mode" value="1"> Enable Demo Mode (no real AI calls)</label>';
        echo '</div>';

        echo '<button type="submit" class="btn btn-block">🚀 Install LeadGen Pro Now</button>';
        echo '</form>';
    }

    private function performInstallation() {
        echo '<h2 style="margin-bottom: 20px;">Installing...</h2>';
        echo '<div class="progress-bar"><div class="progress-fill" id="progress" style="width: 0%"></div></div>';
        echo '<div id="status">Starting installation...</div>';
        echo '<div id="log" class="code-block" style="margin-top: 20px; max-height: 300px; overflow-y: auto;"></div>';

        ob_implicit_flush(true);
        ob_end_flush();

        $this->log('Starting LeadGen Pro installation...');
        $this->updateProgress(10);

        // Step 1: Extract files
        $this->log('Extracting application files...');
        if(!$this->extractFiles()) {
            $this->error('Failed to extract files. Check permissions.');
            return;
        }
        $this->updateProgress(30);

        // Step 2: Create database
        $this->log('Creating database tables...');
        if(!$this->createDatabase()) {
            $this->error('Failed to create database tables.');
            return;
        }
        $this->updateProgress(50);

        // Step 3: Configure files
        $this->log('Configuring application...');
        if(!$this->configureApp()) {
            $this->error('Failed to configure application.');
            return;
        }
        $this->updateProgress(70);

        // Step 4: Create admin
        $this->log('Creating admin account...');
        if(!$this->createAdmin()) {
            $this->error('Failed to create admin account.');
            return;
        }
        $this->updateProgress(90);

        // Step 5: Set permissions
        $this->log('Setting file permissions...');
        $this->setPermissions();
        $this->updateProgress(100);

        $this->log('✅ Installation complete!');

        echo '<script>setTimeout(() => { window.location.href = "?step=4"; }, 2000);</script>';
    }

    private function extractFiles() {
        $zipFile = 'leadgen-pro-files.zip';
        if(!file_exists($zipFile)) {
            $this->log('Warning: ZIP file not found. Creating from embedded data...');
            return $this->createFilesFromEmbedded();
        }

        $zip = new ZipArchive;
        if($zip->open($zipFile) === TRUE) {
            $zip->extractTo('.');
            $zip->close();
            return true;
        }
        return false;
    }

    private function createFilesFromEmbedded() {
        // Create directory structure
        $dirs = ['api', 'assets/css', 'assets/js', 'assets/images'];
        foreach($dirs as $dir) {
            if(!is_dir($dir)) mkdir($dir, 0755, true);
        }
        return true;
    }

    private function createDatabase() {
        $config = $_SESSION['db_config'];

        try {
            $pdo = new PDO("mysql:host={$config['host']};dbname={$config['name']};charset=utf8mb4", 
                          $config['user'], $config['pass']);

            $sql = file_get_contents('database.sql');
            if(!$sql) {
                $this->log('Warning: database.sql not found. Creating basic structure...');
                $sql = $this->getBasicDatabaseSQL();
            }

            $pdo->exec($sql);
            return true;

        } catch(PDOException $e) {
            $this->log('Database error: ' . $e->getMessage());
            return false;
        }
    }

    private function configureApp() {
        $config = $_SESSION['db_config'];
        $domain = $_POST['domain'] ?? 'https://' . $_SERVER['HTTP_HOST'];
        $demoMode = isset($_POST['demo_mode']) ? 'true' : 'false';

        // Update config.php
        $configContent = file_get_contents('api/config.php');
        if($configContent) {
            $configContent = str_replace([
                "'database' => 'your_cpanel_username_leadgen'",
                "'username' => 'your_cpanel_username_leaduser'",
                "'password' => 'your_strong_password_here'",
                "'https://yourdomain.com'",
                "\$demo_mode = false"
            ], [
                "'database' => '{$config['name']}'",
                "'username' => '{$config['user']}'",
                "'password' => '{$config['pass']}'",
                "'{$domain}'",
                "\$demo_mode = {$demoMode}"
            ], $configContent);

            file_put_contents('api/config.php', $configContent);
        }

        // Update auth-middleware.js
        $jsContent = file_get_contents('auth-middleware.js');
        if($jsContent) {
            $jsContent = str_replace([
                "API_BASE_URL: 'https://yourdomain.com/api'",
                "DEMO_MODE: true",
                "REQUIRE_AUTH: false"
            ], [
                "API_BASE_URL: '{$domain}/api'",
                "DEMO_MODE: {$demoMode}",
                "REQUIRE_AUTH: true"
            ], $jsContent);

            file_put_contents('auth-middleware.js', $jsContent);
        }

        return true;
    }

    private function createAdmin() {
        $config = $_SESSION['db_config'];
        $email = $_POST['admin_email'] ?? 'admin@leadgenpro.com';
        $password = $_POST['admin_pass'] ?? 'admin123';

        try {
            $pdo = new PDO("mysql:host={$config['host']};dbname={$config['name']};charset=utf8mb4", 
                          $config['user'], $config['pass']);

            $hash = password_hash($password, PASSWORD_BCRYPT);
            $apiKey = 'lgp_' . bin2hex(random_bytes(32));

            $stmt = $pdo->prepare("UPDATE users SET email = ?, password_hash = ?, api_key = ? WHERE id = 1");
            $stmt->execute([$email, $hash, $apiKey]);

            $_SESSION['admin_credentials'] = ['email' => $email, 'password' => $password];

            return true;

        } catch(PDOException $e) {
            $this->log('Admin creation error: ' . $e->getMessage());
            return false;
        }
    }

    private function setPermissions() {
        // Set secure permissions
        chmod('api/config.php', 0644);
        chmod('api', 0755);

        // Create .htaccess protection
        $htaccess = "Options -Indexes\n<Files config.php>\norder allow,deny\ndeny from all\n</Files>";
        file_put_contents('api/.htaccess', $htaccess);
    }

    private function showComplete() {
        $admin = $_SESSION['admin_credentials'] ?? ['email' => 'admin@leadgenpro.com', 'password' => 'admin123'];
        $domain = $_POST['domain'] ?? 'https://' . $_SERVER['HTTP_HOST'];

        echo '<div style="text-align: center; padding: 40px 0;">';
        echo '<div style="font-size: 64px; margin-bottom: 20px;">🎉</div>';
        echo '<h2 style="margin-bottom: 20px;">Installation Complete!</h2>';
        echo '<p style="color: #6b7280; margin-bottom: 30px;">LeadGen Pro has been successfully installed.</p>';

        echo '<div class="alert alert-info" style="text-align: left;">';
        echo '<h3 style="margin-bottom: 15px;">Your Login Credentials</h3>';
        echo '<p><strong>Email:</strong> ' . htmlspecialchars($admin['email']) . '</p>';
        echo '<p><strong>Password:</strong> ' . htmlspecialchars($admin['password']) . '</p>';
        echo '<p style="margin-top: 15px; color: #ef4444;">⚠️ Save these credentials now! This is the only time they will be displayed.</p>';
        echo '</div>';

        echo '<div style="margin: 30px 0;">';
        echo '<a href="' . $domain . '/login.html" class="btn" style="margin-right: 10px;">Go to Login</a>';
        echo '<a href="' . $domain . '" class="btn" style="background: #10b981;">View App</a>';
        echo '</div>';

        echo '<div class="alert alert-success" style="text-align: left;">';
        echo '<h4 style="margin-bottom: 10px;">Next Steps:</h4>';
        echo '<ol style="margin-left: 20px; line-height: 1.8;">';
        echo '<li>Log in with your credentials above</li>';
        echo '<li>Connect your AI calling API (Bland AI or Twilio)</li>';
        echo '<li>Import your leads or start generating new ones</li>';
        echo '<li>Customize your email templates and call scripts</li>';
        echo '<li>Launch your first campaign!</li>';
        echo '</ol>';
        echo '</div>';

        echo '<p style="margin-top: 30px; color: #6b7280; font-size: 14px;">';
        echo 'Delete this installer file (install.php) for security.<br>';
        echo '<code>rm install.php leadgen-pro-files.zip</code>';
        echo '</p>';

        echo '</div>';

        // Clear session
        session_destroy();
    }

    private function log($message) {
        echo "<script>document.getElementById('log').innerHTML += '" . addslashes($message) . "<br>';</script>";
    }

    private function updateProgress($percent) {
        echo "<script>document.getElementById('progress').style.width = '{$percent}%';</script>";
    }

    private function error($message) {
        echo "<div class='alert alert-error'>$message</div>";
        echo "<a href='?step=3' class='btn'>Try Again</a>";
    }

    private function getBasicDatabaseSQL() {
        return "CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            api_key VARCHAR(64) UNIQUE,
            status ENUM('active', 'inactive') DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS leads (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            email VARCHAR(255),
            phone VARCHAR(20),
            company_name VARCHAR(200),
            source VARCHAR(50),
            status ENUM('new', 'contacted', 'qualified', 'closed') DEFAULT 'new',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        INSERT INTO users (email, password_hash, first_name, last_name, api_key) 
        VALUES ('admin@leadgenpro.com', '\$2y\$10\$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'User', 'lgp_demo_key');";
    }
}

// Run installer
$installer = new LeadGenInstaller();
$installer->run();
?>
