@rem Gradle wrapper - downloads and runs gradle-wrapper.jar if not present
@echo off
setlocal enabledelayedexpansion

set WRAPPER_JAR=%~dp0gradle\wrapper\gradle-wrapper.jar
set WRAPPER_PROPS=%~dp0gradle\wrapper\gradle-wrapper.properties

if not exist "%WRAPPER_JAR%" (
    echo Downloading Gradle Wrapper...
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/gradle/gradle/raw/v8.11.1/gradle/wrapper/gradle-wrapper.jar' -OutFile '%WRAPPER_JAR%'}" 2>nul
    if exist "%WRAPPER_JAR%" (
        echo Gradle Wrapper downloaded successfully.
    ) else (
        echo Failed to download Gradle Wrapper. Please ensure you have internet access.
        exit /b 1
    )
)

"%JAVA_HOME%\bin\java.exe" -Dorg.gradle.appname=gradlew -classpath "%WRAPPER_JAR%" org.gradle.wrapper.GradleWrapperMain %*
