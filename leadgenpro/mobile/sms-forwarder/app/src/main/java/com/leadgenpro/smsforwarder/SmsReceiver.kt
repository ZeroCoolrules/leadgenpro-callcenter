package com.leadgenpro.smsforwarder

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import androidx.work.BackoffPolicy
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/**
 * Fires on every inbound SMS. Groups multipart messages by sender+timestamp
 * (long texts arrive as several PDUs) and enqueues one ForwardWorker per
 * logical message so a slow network doesn't drop anything.
 */
class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val dispatchUrl = Prefs.getUrl(context)
        val deviceNumber = Prefs.getDeviceNumber(context)
        val secret = Prefs.getSecret(context)
        if (dispatchUrl.isBlank()) return // not configured yet

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) return

        val from = messages[0].originatingAddress ?: return
        val body = messages.joinToString(separator = "") { it.messageBody ?: "" }

        val data = Data.Builder()
            .putString(ForwardWorker.KEY_URL, dispatchUrl)
            .putString(ForwardWorker.KEY_FROM, from)
            .putString(ForwardWorker.KEY_TO, deviceNumber)
            .putString(ForwardWorker.KEY_BODY, body)
            .putString(ForwardWorker.KEY_SECRET, secret)
            .build()

        val request = OneTimeWorkRequestBuilder<ForwardWorker>()
            .setInputData(data)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()

        // Unique-enqueue per sender+timestamp so Android redelivering the same
        // broadcast (rare, but happens on some OEM ROMs) doesn't double-forward.
        val workName = "forward_${from}_${System.currentTimeMillis() / 1000}"
        WorkManager.getInstance(context)
            .enqueueUniqueWork(workName, ExistingWorkPolicy.KEEP, request)
    }
}
