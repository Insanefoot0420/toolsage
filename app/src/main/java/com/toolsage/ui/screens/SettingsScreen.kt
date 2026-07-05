package com.toolsage.ui.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.toolsage.data.remote.HttpClient
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onNavigateBack: () -> Unit = {}, onOpenAgentHub: () -> Unit = {}) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    // Server status
    var serverStatus by remember { mutableStateOf<ServerStatus>(ServerStatus.Checking) }
    var mcpStatus by remember { mutableStateOf<ServerStatus>(ServerStatus.Checking) }
    var showQrDialog by remember { mutableStateOf(false) }

    // Check server health on launch
    LaunchedEffect(Unit) {
        checkServerHealth(
            onStatus = { serverStatus = it },
            onMcpStatus = { mcpStatus = it }
        )
    }

    val baseUrl = remember { HttpClient.BASE_URL }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Nastavení") },
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
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(scrollState)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // ═══════════════════════════════════════════
            // HEADER
            // ═══════════════════════════════════════════
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Icon(
                        Icons.Filled.Handyman,
                        null,
                        tint = MaterialTheme.colorScheme.onPrimaryContainer,
                        modifier = Modifier.size(40.dp)
                    )
                    Column {
                        Text(
                            "ToolSage v1.0",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                        Text(
                            "Smart Tool Database",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                        )
                    }
                }
            }

            // ═══════════════════════════════════════════
            // SERVER CONNECTION
            // ═══════════════════════════════════════════
            Text(
                "Připojení",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            // Main server card
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            StatusIndicator(status = serverStatus)
                            Column {
                                Text(
                                    "Backend API",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    when (serverStatus) {
                                        is ServerStatus.Online -> "Online · ${(serverStatus as ServerStatus.Online).latency}ms"
                                        is ServerStatus.Offline -> "Offline"
                                        is ServerStatus.Checking -> "Kontroluji..."
                                    },
                                    style = MaterialTheme.typography.bodySmall,
                                    color = serverStatus.color
                                )
                            }
                        }

                        IconButton(onClick = {
                            serverStatus = ServerStatus.Checking
                            scope.launch {
                                checkServerHealth(
                                    onStatus = { serverStatus = it },
                                    onMcpStatus = { }
                                )
                            }
                        }) {
                            Icon(Icons.Filled.Refresh, "Zkontrolovat",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }

                    HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp))

                    // Server URL
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.Filled.Link,
                            null,
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            "URL: ${baseUrl.removeSuffix("/")}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
            }

            // MCP Server card
            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            StatusIndicator(status = mcpStatus)
                            Column {
                                Text(
                                    "MCP Server",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    when (mcpStatus) {
                                        is ServerStatus.Online -> "MCP v0.1.0 · ready"
                                        is ServerStatus.Offline -> "Nedostupný"
                                        is ServerStatus.Checking -> "Kontroluji..."
                                    },
                                    style = MaterialTheme.typography.bodySmall,
                                    color = mcpStatus.color
                                )
                            }
                        }

                        // QR Code button
                        OutlinedButton(
                            onClick = { showQrDialog = true },
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)
                        ) {
                            Icon(
                                Icons.Filled.QrCodeScanner,
                                null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(Modifier.width(4.dp))
                            Text("QR", style = MaterialTheme.typography.labelSmall)
                        }
                    }

                    Spacer(Modifier.height(8.dp))

                    // MCP endpoint URL
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            "${baseUrl.removeSuffix("/")}/mcp",
                            modifier = Modifier.padding(12.dp),
                            style = MaterialTheme.typography.bodySmall,
                            fontFamily = FontFamily.Monospace,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    Spacer(Modifier.height(8.dp))

                    // MCP info chips
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        AssistChip(
                            onClick = {},
                            label = { Text("3 nástroje", style = MaterialTheme.typography.labelSmall) },
                            leadingIcon = {
                                Icon(Icons.Filled.Build, null, modifier = Modifier.size(16.dp))
                            },
                            modifier = Modifier.height(32.dp)
                        )
                        AssistChip(
                            onClick = {},
                            label = { Text("JSON-RPC 2.0", style = MaterialTheme.typography.labelSmall) },
                            leadingIcon = {
                                Icon(Icons.Filled.Api, null, modifier = Modifier.size(16.dp))
                            },
                            modifier = Modifier.height(32.dp)
                        )
                    }
                }
            }

            // ═══════════════════════════════════════════
            // AGENT HUB
            // ═══════════════════════════════════════════
            Text(
                "AI Agent Hub",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onOpenAgentHub() },
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.secondaryContainer
                )
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(
                            Icons.Filled.SmartToy,
                            null,
                            tint = MaterialTheme.colorScheme.onSecondaryContainer,
                            modifier = Modifier.size(32.dp)
                        )
                        Column {
                            Text(
                                "Správa AI agentů",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onSecondaryContainer
                            )
                            Text(
                                "OpenCode, Claude, Gemini a další",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.7f)
                            )
                        }
                    }
                    Icon(
                        Icons.Filled.ChevronRight,
                        null,
                        tint = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                }
            }

            // ═══════════════════════════════════════════
            // ABOUT & INFO
            // ═══════════════════════════════════════════
            Text(
                "O aplikaci",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    InfoRow("Verze", "1.0.0")
                    InfoRow("Android SDK", "26+")
                    InfoRow("Backend", "Node.js + Supabase")
                    InfoRow("API protokol", "REST + MCP (JSON-RPC 2.0)")
                }
            }

            Spacer(Modifier.height(80.dp))
        }
    }

    // ─── QR Dialog ──────────────────────────────────────
    if (showQrDialog) {
        AlertDialog(
            onDismissRequest = { showQrDialog = false },
            title = {
                Text(
                    "MCP Endpoint",
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center
                )
            },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // QR Code placeholder - barevný blok
                    Surface(
                        modifier = Modifier.size(200.dp),
                        shape = RoundedCornerShape(16.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant
                    ) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(
                                    Icons.Filled.QrCodeScanner,
                                    null,
                                    modifier = Modifier.size(80.dp),
                                    tint = MaterialTheme.colorScheme.primary
                                )
                                Spacer(Modifier.height(8.dp))
                                Text(
                                    "${HttpClient.BASE_URL.removeSuffix("/")}/mcp",
                                    style = MaterialTheme.typography.bodySmall,
                                    fontFamily = FontFamily.Monospace,
                                    textAlign = TextAlign.Center,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }

                    Spacer(Modifier.height(16.dp))

                    Text(
                        "Připojení pro AI agenty:",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold
                    )

                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth().padding(top = 4.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(
                                "MCP Endpoint:",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                "${HttpClient.BASE_URL.removeSuffix("/")}/mcp",
                                style = MaterialTheme.typography.bodySmall,
                                fontFamily = FontFamily.Monospace
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "API klíč:",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                "Vytvoř v Agent Hub",
                                style = MaterialTheme.typography.bodySmall,
                                fontFamily = FontFamily.Monospace,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }
            },
            confirmButton = {
                Button(onClick = { showQrDialog = false }) {
                    Text("Zavřít")
                }
            }
        )
    }
}

// ─── Helper: Server Status indicator ─────────────────────
sealed class ServerStatus(val color: Color) {
    data class Online(val latency: Long) : ServerStatus(Color(0xFF4CAF50))
    data object Offline : ServerStatus(Color(0xFFE53935))
    data object Checking : ServerStatus(Color(0xFFFFC107))
}

@Composable
fun StatusIndicator(status: ServerStatus) {
    val color = when (status) {
        is ServerStatus.Online -> Color(0xFF4CAF50)
        is ServerStatus.Offline -> Color(0xFFE53935)
        is ServerStatus.Checking -> Color(0xFFFFC107)
    }
    val pulse = rememberInfiniteTransition().animateFloat(
        initialValue = 0.6f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        )
    )

    Box(
        modifier = Modifier
            .size(12.dp)
            .clip(CircleShape)
            .background(if (status is ServerStatus.Checking) color.copy(alpha = pulse.value) else color)
    )
}

// ─── InfoRow helper ─────────────────────────────────────
@Composable
fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            value,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium
        )
    }
}

// ─── Health check logic ──────────────────────────────────
private suspend fun checkServerHealth(
    onStatus: (ServerStatus) -> Unit,
    onMcpStatus: (ServerStatus) -> Unit = {}
) {
    try {
        val startTime = System.currentTimeMillis()
        val url = java.net.URL(HttpClient.BASE_URL)
        val connection = url.openConnection() as java.net.HttpURLConnection
        connection.connectTimeout = 5000
        connection.readTimeout = 5000
        connection.requestMethod = "GET"

        val responseCode = connection.responseCode
        val latency = System.currentTimeMillis() - startTime

        if (responseCode in 200..399) {
            onStatus(ServerStatus.Online(latency))
        } else {
            onStatus(ServerStatus.Offline)
        }

        // Check MCP endpoint
        val mcpUrl = java.net.URL("${HttpClient.BASE_URL.removeSuffix("/")}/mcp")
        val mcpConn = mcpUrl.openConnection() as java.net.HttpURLConnection
        mcpConn.connectTimeout = 3000
        mcpConn.readTimeout = 3000
        mcpConn.requestMethod = "GET"

        if (mcpConn.responseCode in 200..399) {
            onMcpStatus(ServerStatus.Online(latency))
        } else {
            onMcpStatus(ServerStatus.Offline)
        }
    } catch (e: Exception) {
        onStatus(ServerStatus.Offline)
        onMcpStatus(ServerStatus.Offline)
    }
}
