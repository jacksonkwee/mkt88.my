# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# --- WebView JavaScript bridge (MainActivity.installResultBridge) -----------
#
# The page is handed a native object called "mktNative" with one method,
# get(url, id). It fetches Perdana results that refuse a browser request.
# "mktNative" is a string so it survives shrinking, but R8 renames the Java
# method - the page would then call a method that no longer exists, and Perdana
# results would quietly stop loading on every phone with no visible error.
# Keep the annotated method, and keep the annotation: WebView reads it at
# runtime to decide which methods are exposed to JavaScript.
-keepattributes RuntimeVisibleAnnotations,RuntimeInvisibleAnnotations
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile
