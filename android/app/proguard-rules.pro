# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ==== v1.0.5-beta (vc127) R8 ON — Capacitor·플러그인 리플렉션 보호 ====
# Capacitor 브릿지: JS→네이티브 호출이 리플렉션 기반이라 전면 보존
-keep class com.getcapacitor.** { *; }
-dontwarn com.getcapacitor.**
# 플러그인 등록(@CapacitorPlugin)·플러그인 메서드(@PluginMethod) 보존
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
}
# Cordova 호환 레이어(capacitor-cordova-android-plugins)
-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**
# 난독화 후에도 스택트레이스 라인 복원(Crashlytics 매핑용)
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# @capacitor-firebase/authentication — Facebook SDK는 미포함 선택 의존성(구글 로그인만 사용)
#  → R8이 감지한 누락 클래스 참조 허용(missing_rules.txt 그대로 반영, 커밋 1회차)
-dontwarn com.facebook.CallbackManager$Factory
-dontwarn com.facebook.CallbackManager
-dontwarn com.facebook.FacebookCallback
-dontwarn com.facebook.login.LoginManager
