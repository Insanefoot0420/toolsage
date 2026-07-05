package com.toolsage.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * Reprezentace AI agenta v UI.
 */
private data class AgentInfo(
    val name: String,
    val description: String,
    val permissions: List<String>,
    val active: Boolean
)

/**
 * Správa AI agentů - zobrazení a správa API klíčů pro agenty.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AgentManagerScreen(onNavigateBack: () -> Unit = {}) {
    var showNewAgentDialog by remember { mutableStateOf(false) }
    var newAgentName by remember { mutableStateOf("") }
    var generatedKey by remember { mutableStateOf<String?>(null) }

    // Mock agents for display
    val agents = remember {
        mutableStateOf(listOf(
            AgentInfo("OpenCode Agent", "Hlavní MCP agent pro OpenCode IDE", listOf("čtení", "vytváření", "mazání"), true),
            AgentInfo("AI Asistent", "Vestavěný AI asistent v aplikaci", listOf("čtení"), true)
        ))
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Správa AI agentů") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Zpět", tint = MaterialTheme.colorScheme.onPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showNewAgentDialog = true }) {
                Icon(Icons.Filled.Add, "Nový agent")
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item {
                Text("Registrovaní AI agenti", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                Text("AI agenti mohou přistupovat k databázi nástrojů přes MCP endpoint.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            items(agents.value.size) { index ->
                val agent = agents.value[index]
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                Icon(
                                    if (agent.active) Icons.Filled.CheckCircle else Icons.Filled.Cancel,
                                    null,
                                    tint = if (agent.active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error,
                                    modifier = Modifier.size(24.dp)
                                )
                                Column {
                                    Text(agent.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                                    Text(agent.description, style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        Text("Oprávnění: ${agent.permissions.joinToString(", ")}",
                            style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                    }
                }
            }

            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Filled.Info, null, tint = MaterialTheme.colorScheme.onPrimaryContainer)
                            Text("MCP endpoint", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        }
                        Spacer(Modifier.height(8.dp))
                        Text("http://10.0.2.2:3001/mcp",
                            style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
                        Spacer(Modifier.height(4.dp))
                        Text("Pro připojení AI agentů použij výše uvedený endpoint s API klíčem.",
                            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f))
                    }
                }
            }

            item { Spacer(Modifier.height(80.dp)) }
        }
    }

    // New agent dialog
    if (showNewAgentDialog) {
        AlertDialog(
            onDismissRequest = { showNewAgentDialog = false; newAgentName = "" },
            title = { Text("Nový AI agent") },
            text = {
                Column {
                    Text("Zadej název nového agenta:")
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = newAgentName,
                        onValueChange = { newAgentName = it },
                        label = { Text("Název agenta") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        generatedKey = "agent-${System.currentTimeMillis()}-key"
                        showNewAgentDialog = false
                    },
                    enabled = newAgentName.isNotBlank()
                ) { Text("Vytvořit") }
            },
            dismissButton = {
                TextButton(onClick = { showNewAgentDialog = false; newAgentName = "" }) { Text("Zrušit") }
            }
        )
    }

    // Show generated API key
    if (generatedKey != null) {
        AlertDialog(
            onDismissRequest = { generatedKey = null },
            title = { Text("API klíč vygenerován") },
            text = {
                Column {
                    Text("Toto je jediná příležitost klíč zkopírovat. Po zavření dialogu ho už nebudeš moct zobrazit.")
                    Spacer(Modifier.height(8.dp))
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                        Text(generatedKey!!, modifier = Modifier.padding(12.dp),
                            style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                    }
                }
            },
            confirmButton = {
                Button(onClick = { generatedKey = null }) { Text("Zkopírováno") }
            }
        )
    }
}
