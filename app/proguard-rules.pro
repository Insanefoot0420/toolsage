# ToolSage ProGuard Rules
-keepattributes Signature
-keepattributes *Annotation*

# Retrofit
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }

# Gson
-keep class com.toolsage.data.model.** { *; }

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
