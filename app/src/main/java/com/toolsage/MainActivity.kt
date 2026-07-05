package com.toolsage

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.toolsage.ui.navigation.Screen
import com.toolsage.ui.navigation.bottomNavItems
import com.toolsage.ui.screens.*
import com.toolsage.ui.theme.ToolSageTheme
import com.toolsage.ui.viewmodel.ToolSageViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            ToolSageTheme {
                ToolSageMainScreen()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ToolSageMainScreen() {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    // Shared ViewModel
    val viewModel: ToolSageViewModel = viewModel()

    val showBottomBar = currentDestination?.hierarchy?.any { dest ->
        bottomNavItems.any { it.screen.route == dest.route }
    } == true

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    bottomNavItems.forEach { item ->
                        val selected = currentDestination?.hierarchy?.any {
                            it.route == item.screen.route
                        } == true
                        NavigationBarItem(
                            icon = { Icon(item.icon, item.label) },
                            label = { Text(item.label) },
                            selected = selected,
                            onClick = {
                                navController.navigate(item.screen.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Tools.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            // Main screens
            composable(Screen.Tools.route) {
                ToolsScreen(
                    viewModel = viewModel,
                    onAddTool = { navController.navigate(Screen.AddTool.route) },
                    onToolClick = { toolId -> navController.navigate(Screen.ToolDetail.createRoute(toolId)) },
                    onSmartImport = { navController.navigate(Screen.SmartImport.route) }
                )
            }

            composable(Screen.Search.route) {
                SearchScreen()
            }

            composable(Screen.AiAssistant.route) {
                AiAssistantScreen(
                    viewModel = viewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Profile.route) {
                ProfileScreen(
                    viewModel = viewModel,
                    onNavigateToSettings = { navController.navigate(Screen.Settings.route) },
                    onNavigateToAgentManager = { navController.navigate(Screen.AgentManager.route) }
                )
            }

            // Tool detail
            composable(
                route = Screen.ToolDetail.route,
                arguments = listOf(navArgument("toolId") { type = NavType.StringType })
            ) { backStackEntry ->
                val toolId = backStackEntry.arguments?.getString("toolId") ?: ""
                ToolDetailScreen(
                    toolId = toolId,
                    viewModel = viewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            // Add tool
            composable(Screen.AddTool.route) {
                AddToolScreen(
                    viewModel = viewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(
                route = Screen.EditTool.route,
                arguments = listOf(navArgument("toolId") { type = NavType.StringType })
            ) { backStackEntry ->
                val toolId = backStackEntry.arguments?.getString("toolId") ?: ""
                AddToolScreen(
                    viewModel = viewModel,
                    existingToolId = toolId,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            // Smart Import
            composable(Screen.SmartImport.route) {
                SmartImportScreen(
                    viewModel = viewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onImportComplete = { navController.navigate(Screen.SmartImportReview.route) }
                )
            }

            composable(Screen.SmartImportReview.route) {
                SmartImportReviewScreen(
                    viewModel = viewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            // Settings and Agent manager
            composable(Screen.Settings.route) {
                SettingsScreen(onNavigateBack = { navController.popBackStack() })
            }

            composable(Screen.AgentManager.route) {
                AgentManagerScreen(onNavigateBack = { navController.popBackStack() })
            }
        }
    }
}
