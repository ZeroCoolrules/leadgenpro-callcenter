package com.leadgenpro.smsforwarder

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.work.Data
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

class MainActivity : AppCompatActivity() {

    private lateinit var editUrl: EditText
    private lateinit var editDeviceNumber: EditText
    private lateinit var editSecret: EditText
    private lateinit var textStatus: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        editUrl = findViewById(R.id.edit_url)
        editDeviceNumber = findViewById(R.id.edit_device_number)
        editSecret = findViewById(R.id.edit_secret)
        textStatus = findViewById(R.id.text_status)

        editUrl.setText(Prefs.getUrl(this))
        editDeviceNumber.setText(Prefs.getDeviceNumber(this))
        editSecret.setText(Prefs.getSecret(this))

        findViewById<Button>(R.id.button_save).setOnClickListener { saveSettings() }
        findViewById<Button>(R.id.button_request_permission).setOnClickListener { requestSmsPermission() }
        findViewById<Button>(R.id.button_test).setOnClickListener { sendTestForward() }

        updateStatus()
    }

    override fun onResume() {
        super.onResume()
        updateStatus()
    }

    private fun saveSettings() {
        Prefs.save(this, editUrl.text.toString(), editDeviceNumber.text.toString(), editSecret.text.toString())
        Toast.makeText(this, "Settings saved", Toast.LENGTH_SHORT).show()
        updateStatus()
    }

    private fun requestSmsPermission() {
        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS),
            REQUEST_SMS_PERMISSION
        )
    }

    private fun hasSmsPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED

    private fun updateStatus() {
        val permissionState = if (hasSmsPermission()) "granted" else "NOT granted"
        val urlState = if (Prefs.getUrl(this).isBlank()) "not set" else Prefs.getUrl(this)
        textStatus.text = "SMS permission: $permissionState\nForwarding to: $urlState\n\n" +
            "Leave this app installed and this permission granted. It runs in the " +
            "background via a broadcast receiver — no need to keep it open."
    }

    private fun sendTestForward() {
        val url = editUrl.text.toString().trim()
        if (url.isBlank()) {
            Toast.makeText(this, "Enter a dispatch URL first", Toast.LENGTH_SHORT).show()
            return
        }

        val data = Data.Builder()
            .putString(ForwardWorker.KEY_URL, url)
            .putString(ForwardWorker.KEY_FROM, "+15550001111")
            .putString(ForwardWorker.KEY_TO, editDeviceNumber.text.toString().trim())
            .putString(ForwardWorker.KEY_BODY, "Test message from SMS Forwarder app")
            .putString(ForwardWorker.KEY_SECRET, editSecret.text.toString().trim())
            .build()

        val request = OneTimeWorkRequestBuilder<ForwardWorker>().setInputData(data).build()
        WorkManager.getInstance(this).enqueue(request)
        Toast.makeText(this, "Test forward queued — check your dispatch dashboard", Toast.LENGTH_LONG).show()
    }

    companion object {
        private const val REQUEST_SMS_PERMISSION = 1001
    }
}
