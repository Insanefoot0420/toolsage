package com.toolsage.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.toolsage.ui.viewmodel.ToolSageViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    onNavigateToSettings: () -> Unit = {},
    onNavigateToAgentManager: () -> Unit = {},
    viewModel: ToolSageViewModel = viewModel()
) {
    val tools by viewModel.tools.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Můj profil") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // User info
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(24.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Icon(Icons.Filled.Person, "Profil", modifier = Modifier.size(64.dp), tint = MaterialTheme.colorScheme.onPrimaryContainer)
                        Column {
                            Text("ToolSage Uživatel", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                            Text("Místní režim", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f))
                            Spacer(Modifier.height(4.dp))
                            SuggestionChip(
                                onClick = {},
                                label = { Text("Backend připojen") },
                                icon = { Icon(Icons.Filled.CloudDone, null, modifier = Modifier.size(14.dp)) }
                            )
                        }
                    }
                }
            }

            // Stats from backend data
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Card(modifier = Modifier.weight(1f)) {
                        Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("${tools.size}", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                            Text("Nástrojů", style = MaterialTheme.typography.labelMedium)
                        }
                    }
                    Card(modifier = Modifier.weight(1f)) {
                        Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("✓", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                            Text("Backend", style = MaterialTheme.typography.labelMedium)
                        }
                    }
                    Card(modifier = Modifier.weight(1f)) {
                        Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("MCP", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                            Text("Protokol", style = MaterialTheme.typography.labelMedium)
                        }
                    }
                }
            }

            item { Spacer(Modifier.height(8.dp)) }

            // Menu
            item {
                NavigationDrawerItem(
                    icon = { Icon(Icons.Filled.Settings, null) },
                    label = { Text("Nastavení") }, selected = false,
                    onClick = onNavigateToSettings, modifier = Modifier.fillMaxWidth()
                )
            }
            item { HorizontalDivider() }
            item {
                NavigationDrawerItem(
                    icon = { Icon(Icons.Filled.Android, null) },
                    label = { Text("Správa AI agentů") }, selected = false,
                    onClick = onNavigateToAgentManager, modifier = Modifier.fillMaxWidth()
                )
            }
            item { HorizontalDivider() }
            item {
                NavigationDrawerItem(
                    icon = { Icon(Icons.Filled.Download, null) },
                    label = { Text("Export dat") }, selected = false, onClick = {},
                    modifier = Modifier.fillMaxWidth()
                )
            }
            item { HorizontalDivider() }
            item {
                NavigationDrawerItem(
                    icon = { Icon(Icons.Filled.Info, null) },
                    label = { Text("O aplikaci") }, selected = false, onClick = {},
                    modifier = Modifier.fillMaxWidth()
                )
            }

            item { Spacer(Modifier.height(80.dp)) }
        }
    }
}
