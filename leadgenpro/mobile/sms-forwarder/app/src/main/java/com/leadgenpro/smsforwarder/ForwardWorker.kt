package com.leadgenpro.smsforwarder

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import java.util.UUID

/**
 * Posts one forwarded SMS to the LeadGenPro Agentic SMS Dispatch webhook
 * (api/sms-webhook.php), using the same form fields Twilio sends
 * (From, To, Body, MessageSid) so it plugs into the existing webhook unmodified.
 * Runs via WorkManager so a flaky connection retries with backoff instead of
 * silently dropping the message (a plain BroadcastReceiver has only ~10s to run).
 */
class ForwardWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val url = inputData.getString(KEY_URL) ?: return@withContext Result.failure()
        val from = inputData.getString(KEY_FROM) ?: ""
        val to = inputData.getString(KEY_TO) ?: ""
        val body = inputData.getString(KEY_BODY) ?: ""
        val secret = inputData.getString(KEY_SECRET) ?: ""

        if (url.isBlank() || from.isBlank()) {
            Log.w(TAG, "Missing dispatch URL or sender, dropping message")
            return@withContext Result.failure()
        }

        try {
            val form = "From=${Uri.encode(from)}" +
                "&To=${Uri.encode(to)}" +
                "&Body=${Uri.encode(body)}" +
                "&MessageSid=${Uri.encode("fwd_" + UUID.randomUUID())}"

            val connection = URL(url).openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
            connection.connectTimeout = 15000
            connection.readTimeout = 15000
            if (secret.isNotBlank()) {
                connection.setRequestProperty("X-Forwarder-Secret", secret)
            }

            connection.outputStream.use { it.write(form.toByteArray(StandardCharsets.UTF_8)) }

            val code = connection.responseCode
            connection.disconnect()

            if (code in 200..299) {
                Log.i(TAG, "Forwarded SMS from $from ($code)")
                Result.success()
            } else {
                Log.w(TAG, "Dispatch webhook returned $code, will retry")
                Result.retry()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Forward failed: ${e.message}, will retry")
            Result.retry()
        }
    }

    companion object {
        private const val TAG = "ForwardWorker"
        const val KEY_URL = "url"
        const val KEY_FROM = "from"
        const val KEY_TO = "to"
        const val KEY_BODY = "body"
        const val KEY_SECRET = "secret"
    }
}
