---
title: 'How to Detect Network Connection Type on Android'
excerpt: "Learn how to detect WiFi, cellular, and other network types in Android apps using ConnectivityManager, NetworkCapabilities, and handle network changes with callbacks."
category:
  name: 'Android'
  slug: 'android'
date: '2024-11-05'
publishedAt: '2024-11-05T12:00:00Z'
updatedAt: '2024-11-05T12:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Android
  - Mobile
  - Networking
  - Java
  - Kotlin
  - Development
---

**TLDR:** Use `ConnectivityManager` and `NetworkCapabilities` (Android 6.0+) to detect network type. Call `getActiveNetwork()` and `getNetworkCapabilities()` to check for WiFi, cellular, or Ethernet. For older devices, use the deprecated `getActiveNetworkInfo()`. Register a `NetworkCallback` to monitor connection changes in real-time. Always request `ACCESS_NETWORK_STATE` permission in your manifest.

Android apps often need to know what type of network connection is available - WiFi, cellular, or none. This helps optimize data usage, adjust quality settings, or warn users about expensive mobile data.

## Required Permission

First, add the network state permission to your `AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.yourapp">

    <!-- Required to check network connectivity -->
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application>
        ...
    </application>
</manifest>
```

This permission is normal-level (not dangerous), so you don't need to request it at runtime - just declare it in the manifest.

## Modern Approach (Android 6.0+)

For apps targeting Android M (API 23) and higher, use `NetworkCapabilities`:

```kotlin
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities

fun getNetworkType(context: Context): String {
    val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE)
        as ConnectivityManager

    // Get the currently active network
    val network = connectivityManager.activeNetwork ?: return "No connection"

    // Get the capabilities of the active network
    val capabilities = connectivityManager.getNetworkCapabilities(network)
        ?: return "No connection"

    return when {
        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "WiFi"
        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "Cellular"
        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "Ethernet"
        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_BLUETOOTH) -> "Bluetooth"
        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> "VPN"
        else -> "Unknown"
    }
}

// Usage
val networkType = getNetworkType(context)
Log.d("Network", "Connected via: $networkType")
```

This API is cleaner and more reliable than the older methods. It correctly handles VPN connections and provides more detailed transport information.

### Checking for Internet Connectivity

Having a network connection doesn't guarantee internet access. Check for validated internet:

```kotlin
fun hasInternetConnection(context: Context): Boolean {
    val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE)
        as ConnectivityManager

    val network = connectivityManager.activeNetwork ?: return false
    val capabilities = connectivityManager.getNetworkCapabilities(network)
        ?: return false

    return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
           capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
}
```

`NET_CAPABILITY_VALIDATED` means Android has verified the connection can reach the internet (by contacting a server).

### Checking for Metered Connections

Cellular connections and some WiFi networks (like hotspots) are metered - they have data limits:

```kotlin
fun isMeteredConnection(context: Context): Boolean {
    val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE)
        as ConnectivityManager

    val network = connectivityManager.activeNetwork ?: return false
    val capabilities = connectivityManager.getNetworkCapabilities(network)
        ?: return false

    return !capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)
}

// Use this to adjust behavior
if (isMeteredConnection(context)) {
    // User is on cellular or metered WiFi
    // Reduce video quality, defer large downloads, etc.
    downloadQuality = Quality.LOW
} else {
    // User is on unlimited WiFi
    downloadQuality = Quality.HIGH
}
```

## Legacy Approach (Pre-Android 6.0)

For compatibility with older devices, use the deprecated but still functional `NetworkInfo`:

```kotlin
@Suppress("DEPRECATION")
fun getNetworkTypeLegacy(context: Context): String {
    val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE)
        as ConnectivityManager

    val networkInfo = connectivityManager.activeNetworkInfo

    return when {
        networkInfo == null -> "No connection"
        !networkInfo.isConnected -> "No connection"
        networkInfo.type == ConnectivityManager.TYPE_WIFI -> "WiFi"
        networkInfo.type == ConnectivityManager.TYPE_MOBILE -> "Cellular"
        networkInfo.type == ConnectivityManager.TYPE_ETHERNET -> "Ethernet"
        else -> "Unknown"
    }
}
```

Note the `@Suppress("DEPRECATION")` annotation - this API is deprecated but still works. Use it only if you need to support very old Android versions.

## Monitoring Network Changes

To respond when the network changes (WiFi to cellular, or vice versa), register a `NetworkCallback`:

```kotlin
class NetworkMonitor(private val context: Context) {

    private val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE)
        as ConnectivityManager

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            Log.d("Network", "Network available")
            // Network connection is available
        }

        override fun onLost(network: Network) {
            Log.d("Network", "Network lost")
            // Network connection lost
        }

        override fun onCapabilitiesChanged(
            network: Network,
            capabilities: NetworkCapabilities
        ) {
            Log.d("Network", "Network capabilities changed")

            when {
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> {
                    Log.d("Network", "Connected to WiFi")
                    // Switch to high quality
                }
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> {
                    Log.d("Network", "Connected to cellular")
                    // Switch to lower quality to save data
                }
            }
        }

        override fun onUnavailable() {
            Log.d("Network", "Network unavailable")
            // No network available
        }
    }

    fun startMonitoring() {
        connectivityManager.registerDefaultNetworkCallback(networkCallback)
    }

    fun stopMonitoring() {
        connectivityManager.unregisterNetworkCallback(networkCallback)
    }
}

// Usage in Activity or Service
class MainActivity : AppCompatActivity() {
    private lateinit var networkMonitor: NetworkMonitor

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        networkMonitor = NetworkMonitor(this)
        networkMonitor.startMonitoring()
    }

    override fun onDestroy() {
        super.onDestroy()
        networkMonitor.stopMonitoring()
    }
}
```

The callback runs whenever the network state changes, letting you adjust your app's behavior dynamically.

## Real-World Example: Adaptive Video Quality

Here's how you might use network detection for adaptive streaming:

```kotlin
class VideoPlayer(private val context: Context) {

    private var currentQuality = VideoQuality.AUTO

    enum class VideoQuality {
        LOW,      // 360p
        MEDIUM,   // 720p
        HIGH,     // 1080p
        AUTO
    }

    fun determineOptimalQuality(): VideoQuality {
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE)
            as ConnectivityManager

        val network = connectivityManager.activeNetwork ?: return VideoQuality.LOW
        val capabilities = connectivityManager.getNetworkCapabilities(network)
            ?: return VideoQuality.LOW

        // No internet? Use lowest quality (if cached)
        if (!capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) {
            return VideoQuality.LOW
        }

        // Get connection type and bandwidth
        return when {
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> {
                // WiFi - check if metered
                if (capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)) {
                    VideoQuality.HIGH  // Unlimited WiFi - go HD
                } else {
                    VideoQuality.MEDIUM  // Metered WiFi - be careful
                }
            }

            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> {
                // Cellular - check bandwidth estimate
                val downstreamBandwidth = capabilities.linkDownstreamBandwidthKbps

                when {
                    downstreamBandwidth > 5000 -> VideoQuality.MEDIUM  // 5+ Mbps - 4G/5G
                    downstreamBandwidth > 1000 -> VideoQuality.LOW     // 1-5 Mbps - 3G
                    else -> VideoQuality.LOW                            // <1 Mbps - 2G
                }
            }

            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> {
                VideoQuality.HIGH  // Wired connection - full quality
            }

            else -> VideoQuality.LOW  // Unknown connection type - be conservative
        }
    }

    fun setQuality(quality: VideoQuality) {
        currentQuality = quality
        Log.d("VideoPlayer", "Video quality set to: $quality")

        // Apply quality to video player
        when (quality) {
            VideoQuality.LOW -> loadVideoUrl(lowQualityUrl)
            VideoQuality.MEDIUM -> loadVideoUrl(mediumQualityUrl)
            VideoQuality.HIGH -> loadVideoUrl(highQualityUrl)
            VideoQuality.AUTO -> setQuality(determineOptimalQuality())
        }
    }

    private fun loadVideoUrl(url: String) {
        // Load video from URL
        Log.d("VideoPlayer", "Loading: $url")
    }
}
```

## Java Version

If you're using Java instead of Kotlin:

```java
import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;

public class NetworkUtils {

    public static String getNetworkType(Context context) {
        ConnectivityManager connectivityManager =
            (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);

        if (connectivityManager == null) {
            return "No connection";
        }

        Network network = connectivityManager.getActiveNetwork();
        if (network == null) {
            return "No connection";
        }

        NetworkCapabilities capabilities =
            connectivityManager.getNetworkCapabilities(network);

        if (capabilities == null) {
            return "No connection";
        }

        if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
            return "WiFi";
        } else if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
            return "Cellular";
        } else if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) {
            return "Ethernet";
        } else {
            return "Unknown";
        }
    }

    public static boolean isConnectedToWiFi(Context context) {
        return "WiFi".equals(getNetworkType(context));
    }

    public static boolean isConnectedToCellular(Context context) {
        return "Cellular".equals(getNetworkType(context));
    }

    public static boolean hasInternet(Context context) {
        ConnectivityManager connectivityManager =
            (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);

        if (connectivityManager == null) return false;

        Network network = connectivityManager.getActiveNetwork();
        if (network == null) return false;

        NetworkCapabilities capabilities =
            connectivityManager.getNetworkCapabilities(network);

        return capabilities != null &&
               capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
               capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }
}
```

## Common Use Cases

### Download Large Files Only on WiFi

```kotlin
fun downloadLargeFile(context: Context, url: String) {
    val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE)
        as ConnectivityManager

    val network = connectivityManager.activeNetwork
    val capabilities = connectivityManager.getNetworkCapabilities(network)

    val isWiFi = capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true

    if (isWiFi) {
        // Start download
        startDownload(url)
    } else {
        // Show dialog asking user if they want to download on cellular
        showDataWarningDialog {
            startDownload(url)
        }
    }
}
```

### Sync Data Based on Connection Type

```kotlin
fun syncData(context: Context) {
    val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE)
        as ConnectivityManager

    val network = connectivityManager.activeNetwork ?: return
    val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return

    when {
        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> {
            // Full sync with images and videos
            syncAll()
        }
        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> {
            // Sync only essential data, no media
            syncEssentialDataOnly()
        }
        else -> {
            // No suitable connection
            deferSync()
        }
    }
}
```

### Show Network Status in UI

```kotlin
class NetworkStatusViewModel(application: Application) : AndroidViewModel(application) {

    private val _networkStatus = MutableLiveData<String>()
    val networkStatus: LiveData<String> = _networkStatus

    private val connectivityManager =
        application.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onCapabilitiesChanged(
            network: Network,
            capabilities: NetworkCapabilities
        ) {
            val status = when {
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ->
                    "Connected via WiFi"
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ->
                    "Connected via Cellular"
                else -> "Connected"
            }
            _networkStatus.postValue(status)
        }

        override fun onLost(network: Network) {
            _networkStatus.postValue("No connection")
        }
    }

    init {
        connectivityManager.registerDefaultNetworkCallback(networkCallback)
    }

    override fun onCleared() {
        super.onCleared()
        connectivityManager.unregisterNetworkCallback(networkCallback)
    }
}
```

## Testing Network Detection

During development, you can simulate different network conditions:

1. **Android Emulator:** Use the Extended Controls (three dots) → Cellular → Network type
2. **Physical Device:** Toggle WiFi and cellular in settings
3. **Network Speed:** Use Android Studio's Network Profiler to throttle bandwidth

The key to good network detection in Android is using the modern `NetworkCapabilities` API, monitoring changes with callbacks, and adapting your app's behavior to save users' data and provide a better experience on different connection types.
