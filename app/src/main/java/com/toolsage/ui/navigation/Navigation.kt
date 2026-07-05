package com.toolsage.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * Navigation destinations for ToolSage app
 */
sealed class Screen(
    val route: String,
    val title: String,
    val icon: ImageVector? = null
) {
    data object Tools : Screen("tools", "Nástroje", Icons.Filled.Handyman)
    data object Search : Screen("search", "Vyhledávání", Icons.Filled.Search)
    data object AiAssistant : Screen("ai_assistant", "AI Asistent", Icons.Filled.SmartToy)
    data object Profile : Screen("profile", "Profil", Icons.Filled.Person)

    data object ToolDetail : Screen("tool/{toolId}", "Detail nástroje") {
        fun createRoute(toolId: String) = "tool/$toolId"
    }

    data object AddTool : Screen("add_tool", "Přidat nástroj")
    data object EditTool : Screen("edit_tool/{toolId}", "Upravit nástroj") {
        fun createRoute(toolId: String) = "edit_tool/$toolId"
    }

    data object SmartImport : Screen("smart_import", "Smart Import")
    data object SmartImportReview : Screen("smart_import_review", "Revize importu")
    data object Settings : Screen("settings", "Nastavení")
    data object AgentManager : Screen("agent_manager", "Správa agentů")
    data object CategoryManager : Screen("category_manager", "Správa kategorií")
}

/**
 * Bottom navigation items (main sections)
 */
data class BottomNavItem(
    val screen: Screen,
    val icon: ImageVector,
    val label: String
)

val bottomNavItems = listOf(
    BottomNavItem(Screen.Tools, Icons.Filled.Handyman, "Nástroje"),
    BottomNavItem(Screen.Search, Icons.Filled.Search, "Hledat"),
    BottomNavItem(Screen.AiAssistant, Icons.Filled.SmartToy, "AI"),
    BottomNavItem(Screen.Profile, Icons.Filled.Person, "Profil")
)
