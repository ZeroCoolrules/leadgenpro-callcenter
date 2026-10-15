package com.leadgenpro.smsforwarder

import android.content.Context

/** Thin wrapper around SharedPreferences for the three settings this app needs. */
object Prefs {
    private const val FILE = "sms_forwarder_prefs"
    private const val KEY_URL = "dispatch_url"
    private const val KEY_DEVICE_NUMBER = "device_number"
    private const val KEY_SECRET = "shared_secret"

    fun getUrl(context: Context): String =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(KEY_URL, "") ?: ""

    fun getDeviceNumber(context: Context): String =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(KEY_DEVICE_NUMBER, "") ?: ""

    fun getSecret(context: Context): String =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(KEY_SECRET, "") ?: ""

    fun save(context: Context, url: String, deviceNumber: String, secret: String) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit()
            .putString(KEY_URL, url.trim())
            .putString(KEY_DEVICE_NUMBER, deviceNumber.trim())
            .putString(KEY_SECRET, secret.trim())
            .apply()
    }
}
