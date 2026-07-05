package com.toolsage.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// ToolSage brand colors (Material 3)
private val LightPrimary = Color(0xFF1B6B4A)
private val LightOnPrimary = Color(0xFFFFFFFF)
private val LightPrimaryContainer = Color(0xFFA7F5CA)
private val LightOnPrimaryContainer = Color(0xFF002115)
private val LightSecondary = Color(0xFF4D6356)
private val LightOnSecondary = Color(0xFFFFFFFF)
private val LightSecondaryContainer = Color(0xFFCFE9D8)
private val LightOnSecondaryContainer = Color(0xFF0A1F15)
private val LightTertiary = Color(0xFF3E6470)
private val LightOnTertiary = Color(0xFFFFFFFF)
private val LightTertiaryContainer = Color(0xFFC1E8F8)
private val LightOnTertiaryContainer = Color(0xFF001F27)
private val LightError = Color(0xFFBA1A1A)
private val LightOnError = Color(0xFFFFFFFF)
private val LightErrorContainer = Color(0xFFFFDAD6)
private val LightOnErrorContainer = Color(0xFF410002)
private val LightBackground = Color(0xFFFBFDF8)
private val LightOnBackground = Color(0xFF191C1A)
private val LightSurface = Color(0xFFFBFDF8)
private val LightOnSurface = Color(0xFF191C1A)
private val LightSurfaceVariant = Color(0xFFDCE5DC)
private val LightOnSurfaceVariant = Color(0xFF414942)
private val LightOutline = Color(0xFF717972)

private val DarkPrimary = Color(0xFF8CD8B0)
private val DarkOnPrimary = Color(0xFF003A28)
private val DarkPrimaryContainer = Color(0xFF005239)
private val DarkOnPrimaryContainer = Color(0xFFA7F5CA)
private val DarkSecondary = Color(0xFFB4CCBC)
private val DarkOnSecondary = Color(0xFF1F352A)
private val DarkSecondaryContainer = Color(0xFF354B3F)
private val DarkOnSecondaryContainer = Color(0xFFCFE9D8)
private val DarkTertiary = Color(0xFFA6CCDB)
private val DarkOnTertiary = Color(0xFF073543)
private val DarkTertiaryContainer = Color(0xFF254C59)
private val DarkOnTertiaryContainer = Color(0xFFC1E8F8)
private val DarkError = Color(0xFFFFB4AB)
private val DarkOnError = Color(0xFF690005)
private val DarkErrorContainer = Color(0xFF93000A)
private val DarkOnErrorContainer = Color(0xFFFFDAD6)
private val DarkBackground = Color(0xFF191C1A)
private val DarkOnBackground = Color(0xFFE1E3DF)
private val DarkSurface = Color(0xFF191C1A)
private val DarkOnSurface = Color(0xFFE1E3DF)
private val DarkSurfaceVariant = Color(0xFF414942)
private val DarkOnSurfaceVariant = Color(0xFFC1C9C0)
private val DarkOutline = Color(0xFF8B938B)

private val ToolSageLightColorScheme = lightColorScheme(
    primary = LightPrimary,
    onPrimary = LightOnPrimary,
    primaryContainer = LightPrimaryContainer,
    onPrimaryContainer = LightOnPrimaryContainer,
    secondary = LightSecondary,
    onSecondary = LightOnSecondary,
    secondaryContainer = LightSecondaryContainer,
    onSecondaryContainer = LightOnSecondaryContainer,
    tertiary = LightTertiary,
    onTertiary = LightOnTertiary,
    tertiaryContainer = LightTertiaryContainer,
    onTertiaryContainer = LightOnTertiaryContainer,
    error = LightError,
    onError = LightOnError,
    errorContainer = LightErrorContainer,
    onErrorContainer = LightOnErrorContainer,
    background = LightBackground,
    onBackground = LightOnBackground,
    surface = LightSurface,
    onSurface = LightOnSurface,
    surfaceVariant = LightSurfaceVariant,
    onSurfaceVariant = LightOnSurfaceVariant,
    outline = LightOutline
)

private val ToolSageDarkColorScheme = darkColorScheme(
    primary = DarkPrimary,
    onPrimary = DarkOnPrimary,
    primaryContainer = DarkPrimaryContainer,
    onPrimaryContainer = DarkOnPrimaryContainer,
    secondary = DarkSecondary,
    onSecondary = DarkOnSecondary,
    secondaryContainer = DarkSecondaryContainer,
    onSecondaryContainer = DarkOnSecondaryContainer,
    tertiary = DarkTertiary,
    onTertiary = DarkOnTertiary,
    tertiaryContainer = DarkTertiaryContainer,
    onTertiaryContainer = DarkOnTertiaryContainer,
    error = DarkError,
    onError = DarkOnError,
    errorContainer = DarkErrorContainer,
    onErrorContainer = DarkOnErrorContainer,
    background = DarkBackground,
    onBackground = DarkOnBackground,
    surface = DarkSurface,
    onSurface = DarkOnSurface,
    surfaceVariant = DarkSurfaceVariant,
    onSurfaceVariant = DarkOnSurfaceVariant,
    outline = DarkOutline
)

@Composable
fun ToolSageTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) ToolSageDarkColorScheme else ToolSageLightColorScheme
    val view = LocalView.current

    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.primary.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography(),
        content = content
    )
}
