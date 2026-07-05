package com.toolsage.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.vector.ImageVector
import com.toolsage.data.model.*
import com.toolsage.data.remote.HttpClient
import kotlinx.coroutines.launch

// ─── Barevné schéma pro oprávnění ─────────────────────────
private val permissionColors = mapOf(
    "read" to Color(0xFF4CAF50),
    "create" to Color(0xFF2196F3),
    "update" to Color(0xFFFF9800),
    "delete" to Color(0xFFE53935)
)

private val actionIcons = mapOf(
    "agent_created" to Icons.Filled.AddCircle,
    "agent_updated" to Icons.Filled.Edit,
    "agent_deleted" to Icons.Filled.Delete,
    "key_generated" to Icons.Filled.VpnKey,
    "key_revoked" to Icons.Filled.Lock,
    "permissions_updated" to Icons.Filled.Security,
    "create_tool" to Icons.Filled.AddBox,
    "update_tool" to Icons.Filled.Edit,
    "delete_tool" to Icons.Filled.DeleteForever,
    "list_tools" to Icons.Filled.List,
    "get_tool" to Icons.Filled.Visibility,
    "search_tools" to Icons.Filled.Search
)

private fun actionIcon(action: String): ImageVector =
    actionIcons.entries.firstOrNull { (k, _) -> action.startsWith(k) }?.value
        ?: Icons.Filled.Circle

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AgentManagerScreen(onNavigateBack: () -> Unit = {}) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbarState = remember { SnackbarHostState() }

    // State
    var agents by remember { mutableStateOf<List<Agent>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var isRefreshing by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // Dialogs
    var showCreateDialog by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf<String?>(null) }
    var showApiKeyDialog by remember { mutableStateOf<Pair<String, String>?>(null) } // (agentName, key)
    var showRevokeConfirm by remember { mutableStateOf<String?>(null) }

    // Expanded agent IDs
    var expandedAgentId by remember { mutableStateOf<String?>(null) }

    // Load agents
    fun loadAgents() {
        scope.launch {
            isLoading = true
            errorMessage = null
            try {
                val response = HttpClient.apiService.getAgents()
                if (response.isSuccessful) {
                    agents = response.body()?.agents ?: emptyList()
                } else {
                    errorMessage = "Chyba serveru: ${response.code()}"
                }
            } catch (e: Exception) {
                errorMessage = "Nelze se připojit k serveru: ${e.message}"
            } finally {
                isLoading = false
                isRefreshing = false
            }
        }
    }

    LaunchedEffect(Unit) { loadAgents() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Agent Hub") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Zpět",
                            tint = MaterialTheme.colorScheme.onPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showCreateDialog = true },
                containerColor = MaterialTheme.colorScheme.tertiary
            ) {
                Icon(Icons.Filled.Add, null)
                Spacer(Modifier.width(8.dp))
                Text("Nový agent")
            }
        },
        snackbarHost = { SnackbarHost(snackbarState) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Header stats
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    StatItem("Celkem agentů", "${agents.size}", Icons.Filled.SmartToy)
                    StatItem("Aktivních", "${agents.count { it.active }}", Icons.Filled.CheckCircle)
                    StatItem("Neaktivních", "${agents.count { !it.active }}", Icons.Filled.Cancel)
                }
            }

            // Content
            when {
                isLoading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator()
                            Spacer(Modifier.height(16.dp))
                            Text(
                                "Načítám agenty...",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                errorMessage != null -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(32.dp)
                        ) {
                            Icon(
                                Icons.Filled.CloudOff,
                                null,
                                modifier = Modifier.size(64.dp),
                                tint = MaterialTheme.colorScheme.error.copy(alpha = 0.6f)
                            )
                            Spacer(Modifier.height(16.dp))
                            Text(
                                errorMessage!!,
                                style = MaterialTheme.typography.bodyMedium,
                                textAlign = TextAlign.Center,
                                color = MaterialTheme.colorScheme.error
                            )
                            Spacer(Modifier.height(16.dp))
                            OutlinedButton(onClick = { loadAgents() }) {
                                Icon(Icons.Filled.Refresh, null)
                                Spacer(Modifier.width(8.dp))
                                Text("Zkusit znovu")
                            }
                        }
                    }
                }

                agents.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(32.dp)
                        ) {
                            Icon(
                                Icons.Filled.SmartToy,
                                null,
                                modifier = Modifier.size(72.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f)
                            )
                            Spacer(Modifier.height(16.dp))
                            Text(
                                "Žádní agenti",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                "Vytvoř prvního AI agenta pro připojení\nOpenCode, Claude nebo Gemini.",
                                style = MaterialTheme.typography.bodySmall,
                                textAlign = TextAlign.Center,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(Modifier.height(16.dp))
                            FilledTonalButton(onClick = { showCreateDialog = true }) {
                                Icon(Icons.Filled.Add, null)
                                Spacer(Modifier.width(8.dp))
                                Text("Vytvořit agenta")
                            }
                        }
                    }
                }

                else -> {
                    LazyColumn(
                        contentPadding = PaddingValues(
                            start = 16.dp, end = 16.dp, top = 0.dp, bottom = 88.dp
                        ),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // MCP info banner
                        item {
                            MCPInfoCard(context = context)
                            Spacer(Modifier.height(4.dp))
                        }

                        items(agents, key = { it.id }) { agent ->
                            AgentCard(
                                agent = agent,
                                isExpanded = expandedAgentId == agent.id,
                                onAgentChanged = { loadAgents() },
                                onToggleExpand = {
                                    expandedAgentId = if (expandedAgentId == agent.id) null else agent.id
                                },
                                onToggleActive = { newActive ->
                                    scope.launch {
                                        try {
                                            val resp = HttpClient.apiService.updateAgent(
                                                agent.id,
                                                mapOf("active" to newActive)
                                            )
                                            if (resp.isSuccessful) {
                                                snackbarState.showSnackbar(
                                                    if (newActive) "Agent aktivován" else "Agent deaktivován"
                                                )
                                                loadAgents()
                                            }
                                        } catch (e: Exception) {
                                            snackbarState.showSnackbar("Chyba: ${e.message}")
                                        }
                                    }
                                },
                                onGenerateKey = {
                                    scope.launch {
                                        try {
                                            val resp = HttpClient.apiService.generateAgentKey(agent.id)
                                            if (resp.isSuccessful) {
                                                val key = resp.body()?.api_key ?: ""
                                                showApiKeyDialog = Pair(agent.name, key)
                                                loadAgents()
                                            } else {
                                                snackbarState.showSnackbar("Chyba při generování klíče")
                                            }
                                        } catch (e: Exception) {
                                            snackbarState.showSnackbar("Chyba: ${e.message}")
                                        }
                                    }
                                },
                                onRevokeKey = {
                                    showRevokeConfirm = agent.id
                                },
                                onDelete = {
                                    showDeleteConfirm = agent.id
                                },
                                onCopyToClipboard = { text, label ->
                                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                    clipboard.setPrimaryClip(ClipData.newPlainText(label, text))
                                    scope.launch {
                                        snackbarState.showSnackbar("Zkopírováno: $label")
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    // ─── DIALOG: Create Agent ────────────────────────────────────────
    if (showCreateDialog) {
        CreateAgentDialog(
            onDismiss = { showCreateDialog = false },
            onCreated = { newAgent, apiKey ->
                showCreateDialog = false
                showApiKeyDialog = Pair(newAgent.name, apiKey)
                loadAgents()
            },
            snackbarState = snackbarState
        )
    }

    // ─── DIALOG: API Key Display ─────────────────────────────────────
    showApiKeyDialog?.let { (agentName, key) ->
        AlertDialog(
            onDismissRequest = { showApiKeyDialog = null },
            icon = {
                Icon(Icons.Filled.VpnKey, null, tint = MaterialTheme.colorScheme.primary)
            },
            title = {
                Text(
                    "API klíč pro $agentName",
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        "Toto je jediná možnost klíč zkopírovat. Po zavření dialogu ho už nezobrazíš.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(12.dp))
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            key,
                            modifier = Modifier
                                .padding(16.dp)
                                .clickable {
                                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                    clipboard.setPrimaryClip(ClipData.newPlainText("API Key", key))
                                    scope.launch { snackbarState.showSnackbar("Klíč zkopírován") }
                                },
                            style = MaterialTheme.typography.bodyMedium,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Medium
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Klepnutím na klíč ho zkopíruješ",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            },
            confirmButton = {
                Button(onClick = {
                    showApiKeyDialog = null
                }) {
                    Text("Hotovo")
                }
            }
        )
    }

    // ─── DIALOG: Delete confirmation ─────────────────────────────────
    showDeleteConfirm?.let { agentId ->
        val agent = agents.find { it.id == agentId }
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = null },
            icon = {
                Icon(Icons.Filled.Warning, null, tint = MaterialTheme.colorScheme.error)
            },
            title = { Text("Smazat agenta?") },
            text = {
                Text("Agent '${agent?.name ?: agentId}' bude nenávratně smazán včetně historie aktivit.")
            },
            confirmButton = {
                Button(
                    onClick = {
                        scope.launch {
                            try {
                                HttpClient.apiService.deleteAgent(agentId)
                                snackbarState.showSnackbar("Agent smazán")
                                loadAgents()
                            } catch (e: Exception) {
                                snackbarState.showSnackbar("Chyba: ${e.message}")
                            }
                        }
                        showDeleteConfirm = null
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) { Text("Smazat") }
            },
            dismissButton = {
                OutlinedButton(onClick = { showDeleteConfirm = null }) {
                    Text("Zrušit")
                }
            }
        )
    }

    // ─── DIALOG: Revoke Key ──────────────────────────────────────────
    showRevokeConfirm?.let { agentId ->
        val agent = agents.find { it.id == agentId }
        AlertDialog(
            onDismissRequest = { showRevokeConfirm = null },
            title = { Text("Zneplatnit klíč?") },
            text = { Text("Všichni agenti používající tento klíč ztratí přístup k ToolSage API.") },
            confirmButton = {
                Button(
                    onClick = {
                        scope.launch {
                            try {
                                HttpClient.apiService.revokeAgentKey(agentId)
                                snackbarState.showSnackbar("Klíč zneplatněn")
                                loadAgents()
                            } catch (e: Exception) {
                                snackbarState.showSnackbar("Chyba: ${e.message}")
                            }
                        }
                        showRevokeConfirm = null
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) { Text("Zneplatnit") }
            },
            dismissButton = {
                OutlinedButton(onClick = { showRevokeConfirm = null }) {
                    Text("Zrušit")
                }
            }
        )
    }
}

// ═══════════════════════════════════════════════════════════════
// AGENT CARD
// ═══════════════════════════════════════════════════════════════

@Composable
fun AgentCard(
    agent: Agent,
    isExpanded: Boolean,
    onAgentChanged: () -> Unit = {},
    onToggleExpand: () -> Unit,
    onToggleActive: (Boolean) -> Unit,
    onGenerateKey: () -> Unit,
    onRevokeKey: () -> Unit,
    onDelete: () -> Unit,
    onCopyToClipboard: (String, String) -> Unit
) {
    val scope = rememberCoroutineScope()
    val snackbarState = remember { SnackbarHostState() }
    var activityLog by remember { mutableStateOf<List<AgentActivity>>(emptyList()) }
    var loadingActivity by remember { mutableStateOf(false) }
    var showWebhookDialog by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (agent.active)
                MaterialTheme.colorScheme.surface
            else
                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // ── Agent header (always visible) ──────────────
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onToggleExpand() },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Status indicator
                Box(
                    modifier = Modifier
                        .size(12.dp)
                        .clip(CircleShape)
                        .background(
                            if (agent.active) Color(0xFF4CAF50)
                            else Color(0xFF9E9E9E)
                        )
                )

                // Agent info
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        agent.name,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (agent.description.isNotBlank()) {
                        Text(
                            agent.description,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                // Permissions chips
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    agent.permissions.forEach { perm ->
                        perm.actions.forEach { action ->
                            Surface(
                                color = (permissionColors[action] ?: Color.Gray).copy(alpha = 0.15f),
                                shape = RoundedCornerShape(4.dp)
                            ) {
                                Text(
                                    action.take(1).uppercase(),
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = permissionColors[action] ?: Color.Gray
                                )
                            }
                        }
                    }
                }

                Icon(
                    if (isExpanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                    null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // ── Expanded details ──────────────────────────
            AnimatedVisibility(visible = isExpanded) {
                Column(modifier = Modifier.padding(top = 16.dp)) {
                    HorizontalDivider()
                    Spacer(Modifier.height(12.dp))

                    // Activity toggle
                    Button(
                        onClick = {
                            if (activityLog.isEmpty() && !loadingActivity) {
                                loadingActivity = true
                                scope.launch {
                                    try {
                                        val resp = HttpClient.apiService.getAgentDetailActivity(agent.id)
                                        if (resp.isSuccessful) {
                                            activityLog = resp.body()?.activity ?: emptyList()
                                        }
                                    } catch (_: Exception) { }
                                    loadingActivity = false
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        contentPadding = PaddingValues(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.secondaryContainer,
                            contentColor = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                    ) {
                        Icon(Icons.Filled.History, null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(
                            if (loadingActivity) "Načítám..."
                            else if (activityLog.isNotEmpty()) "Aktivita (${activityLog.size})"
                            else "Zobrazit aktivitu",
                            style = MaterialTheme.typography.labelLarge
                        )
                    }

                    // Activity log
                    if (activityLog.isNotEmpty()) {
                        Spacer(Modifier.height(8.dp))
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
                            ),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(8.dp)) {
                                activityLog.take(5).forEach { activity ->
                                    ActivityRow(activity)
                                }
                                if (activityLog.size > 5) {
                                    Text(
                                        "... a ${activityLog.size - 5} dalších",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.padding(start = 8.dp, top = 4.dp)
                                    )
                                }
                            }
                        }
                    }

                    Spacer(Modifier.height(12.dp))

                    // ── Details grid ──────────────────────
                    DetailsGrid(
                        items = listOf(
                            "ID" to agent.id,
                            "Vytvořen" to (agent.created_at.take(10) ?: "?"),
                            "Poslední aktivita" to (agent.last_activity_at.take(19).replace("T", " ") ?: "nikdy"),
                            "Rate limit" to "${agent.rate_limit}/min",
                            "Webhook" to (if (agent.webhook_url.isNotBlank()) "✓ #{agent.webhook_url.take(30)}..." else "✗ nenastaven")
                        )
                    )

                    Spacer(Modifier.height(12.dp))
                    HorizontalDivider()
                    Spacer(Modifier.height(12.dp))

                    // ── Action buttons ────────────────────
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Toggle active
                        FilledTonalButton(
                            onClick = { onToggleActive(!agent.active) },
                            modifier = Modifier.weight(1f),
                            contentPadding = PaddingValues(8.dp)
                        ) {
                            Icon(
                                if (agent.active) Icons.Filled.PauseCircle else Icons.Filled.PlayCircle,
                                null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(Modifier.width(4.dp))
                            Text(
                                if (agent.active) "Deaktivovat" else "Aktivovat",
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                    }

                    Spacer(Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Generate key
                        OutlinedButton(
                            onClick = onGenerateKey,
                            modifier = Modifier.weight(1f),
                            contentPadding = PaddingValues(8.dp)
                        ) {
                            Icon(Icons.Filled.VpnKey, null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Klíč", style = MaterialTheme.typography.labelSmall)
                        }

                        // Revoke key
                        OutlinedButton(
                            onClick = onRevokeKey,
                            modifier = Modifier.weight(1f),
                            contentPadding = PaddingValues(8.dp),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = MaterialTheme.colorScheme.error
                            )
                        ) {
                            Icon(Icons.Filled.Lock, null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Zneplatnit", style = MaterialTheme.typography.labelSmall)
                        }

                        // Copy ID
                        OutlinedButton(
                            onClick = { onCopyToClipboard(agent.id, "Agent ID") },
                            modifier = Modifier.weight(1f),
                            contentPadding = PaddingValues(8.dp)
                        ) {
                            Icon(Icons.Filled.ContentCopy, null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("ID", style = MaterialTheme.typography.labelSmall)
                        }

                        // Delete
                        OutlinedButton(
                            onClick = onDelete,
                            contentPadding = PaddingValues(8.dp),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = MaterialTheme.colorScheme.error
                            )
                        ) {
                            Icon(Icons.Filled.Delete, null, modifier = Modifier.size(18.dp))
                        }
                    }

                    // Webhook button
                    Spacer(Modifier.height(8.dp))
                    TextButton(
                        onClick = { showWebhookDialog = true },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Filled.Link, null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(
                            if (agent.webhook_url.isNotBlank()) "Změnit webhook URL"
                            else "Nastavit webhook URL"
                        )
                    }
                }
            }
        }
    }

    // ─── Webhook Dialog ────────────────────────────────────
    if (showWebhookDialog) {
        WebhookDialog(
            currentUrl = agent.webhook_url,
            agentId = agent.id,
            onDismiss = { showWebhookDialog = false },
            onSaved = {
                showWebhookDialog = false
                scope.launch {
                    onAgentChanged()
                    snackbarState.showSnackbar("Webhook aktualizován")
                }
            }
        )
    }
}

// ─── Activity Row ──────────────────────────────────────────────
@Composable
fun ActivityRow(activity: AgentActivity) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Icon(
            actionIcon(activity.action),
            null,
            modifier = Modifier.size(16.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                activity.action.replace("_", " "),
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Medium
            )
            if (activity.resource_id.isNotBlank()) {
                Text(
                    activity.resource_id,
                    style = MaterialTheme.typography.labelSmall,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
        Text(
            activity.created_at.take(19).replace("T", " ").drop(11),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
        )
    }
}

// ─── Details Grid ──────────────────────────────────────────────
@Composable
fun DetailsGrid(items: List<Pair<String, String>>) {
    Column {
        items.forEach { (label, value) ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 3.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    label,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    value,
                    style = MaterialTheme.typography.labelSmall,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// CREATE AGENT DIALOG
// ═══════════════════════════════════════════════════════════════

@Composable
fun CreateAgentDialog(
    onDismiss: () -> Unit,
    onCreated: (Agent, String) -> Unit,
    snackbarState: SnackbarHostState
) {
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var selectedActions by remember { mutableStateOf(setOf("read")) } // default read
    var webhookUrl by remember { mutableStateOf("") }
    var rateLimit by remember { mutableStateOf("100") }
    var isCreating by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    val actions = listOf("read", "create", "update", "delete")

    AlertDialog(
        onDismissRequest = { if (!isCreating) onDismiss() },
        title = {
            Text(
                "Nový AI agent",
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center
            )
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Agent name
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Název agenta *") },
                    placeholder = { Text("např. OpenCode Agent") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // Description
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Popis (volitelný)") },
                    placeholder = { Text("např. Hlavní MCP agent pro OpenCode") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // Permissions
                Text(
                    "Oprávnění:",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold
                )

                actions.forEach { action ->
                    val label = when (action) {
                        "read" -> "Čtení nástrojů"
                        "create" -> "Vytváření nástrojů"
                        "update" -> "Úprava nástrojů"
                        "delete" -> "Mazání nástrojů"
                        else -> action
                    }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Checkbox(
                            checked = action in selectedActions,
                            onCheckedChange = {
                                selectedActions = if (it) selectedActions + action
                                else selectedActions - action
                            }
                        )
                        Text(label, style = MaterialTheme.typography.bodySmall)
                    }
                }

                // Webhook URL
                OutlinedTextField(
                    value = webhookUrl,
                    onValueChange = { webhookUrl = it },
                    label = { Text("Webhook URL (volitelný)") },
                    placeholder = { Text("https://...") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // Rate limit
                OutlinedTextField(
                    value = rateLimit,
                    onValueChange = { rateLimit = it.filter { c -> c.isDigit() } },
                    label = { Text("Rate limit (requests/min)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isBlank()) {
                        scope.launch {
                            snackbarState.showSnackbar("Zadej název agenta")
                        }
                        return@Button
                    }
                    isCreating = true
                    scope.launch {
                        try {
                            val permissions = listOf(
                                Permission("tools", selectedActions.toList())
                            )
                            val request = CreateAgentRequest(
                                name = name.trim(),
                                description = description.trim(),
                                permissions = permissions,
                                webhook_url = webhookUrl.trim(),
                                rate_limit = rateLimit.toIntOrNull() ?: 100
                            )
                            val response = HttpClient.apiService.createAgent(request)
                            if (response.isSuccessful) {
                                val agent = response.body()!!
                                val apiKey = agent.api_key ?: "key-not-returned"
                                onCreated(agent, apiKey)
                            } else {
                                snackbarState.showSnackbar("Chyba: ${response.code()} ${response.message()}")
                                isCreating = false
                            }
                        } catch (e: Exception) {
                            snackbarState.showSnackbar("Chyba: ${e.message}")
                            isCreating = false
                        }
                    }
                },
                enabled = name.isNotBlank() && !isCreating
            ) {
                if (isCreating) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(8.dp))
                }
                Text("Vytvořit")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !isCreating) { Text("Zrušit") }
        }
    )
}

// ═══════════════════════════════════════════════════════════════
// WEBHOOK DIALOG
// ═══════════════════════════════════════════════════════════════

@Composable
fun WebhookDialog(
    currentUrl: String,
    agentId: String,
    onDismiss: () -> Unit,
    onSaved: () -> Unit
) {
    var url by remember { mutableStateOf(currentUrl) }
    var saving by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                "Webhook URL",
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center
            )
        },
        text = {
            Column {
                Text(
                    "ToolSage pošle HTTP POST notifikace na tuto URL když agent provede akci.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = url,
                    onValueChange = { url = it },
                    label = { Text("Webhook URL") },
                    placeholder = { Text("https://hooks.example.com/toolsage") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "Nech prázdné pro odstranění webhooku.",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    saving = true
                    scope.launch {
                        try {
                            HttpClient.apiService.updateAgentWebhook(
                                agentId, mapOf("webhook_url" to url.trim())
                            )
                            onSaved()
                        } catch (e: Exception) {
                            saving = false
                        }
                    }
                },
                enabled = !saving
            ) {
                Text("Uložit")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Zrušit") }
        }
    )
}

// ═══════════════════════════════════════════════════════════════
// MCP INFO BANNER
// ═══════════════════════════════════════════════════════════════

@Composable
fun MCPInfoCard(context: Context) {
    val scope = rememberCoroutineScope()
    val snackbar = SnackbarHostState()
    val mcpUrl = "${HttpClient.BASE_URL.removeSuffix("/")}/mcp"

    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.tertiaryContainer
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    Icons.Filled.Api,
                    null,
                    tint = MaterialTheme.colorScheme.onTertiaryContainer
                )
                Text(
                    "MCP Endpoint",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onTertiaryContainer
                )
            }

            Spacer(Modifier.height(8.dp))

            Surface(
                color = MaterialTheme.colorScheme.surface.copy(alpha = 0.6f),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        clipboard.setPrimaryClip(ClipData.newPlainText("MCP URL", mcpUrl))
                        scope.launch { snackbar.showSnackbar("MCP URL zkopírována") }
                    }
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        mcpUrl,
                        style = MaterialTheme.typography.bodySmall,
                        fontFamily = FontFamily.Monospace,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.weight(1f)
                    )
                    Icon(
                        Icons.Filled.ContentCopy,
                        null,
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(Modifier.height(8.dp))

            Text(
                "👆 Klepnutím zkopíruješ MCP URL. Použij pro připojení OpenCode, Claude Desktop nebo jiných MCP klientů.",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onTertiaryContainer.copy(alpha = 0.7f)
            )
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// STAT ITEM
// ═══════════════════════════════════════════════════════════════

@Composable
fun StatItem(label: String, value: String, icon: ImageVector) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            icon,
            null,
            tint = MaterialTheme.colorScheme.onPrimaryContainer,
            modifier = Modifier.size(24.dp)
        )
        Spacer(Modifier.height(4.dp))
        Text(
            value,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onPrimaryContainer
        )
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
        )
    }
}
